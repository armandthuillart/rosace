import { httpMiddleware } from "@repo/better-auth/http";
import { betterAuth } from "better-auth";
import { createAdapterFactory } from "better-auth/adapters";
import { Hono } from "hono";
import { describe, it, expect, beforeEach, vi, afterEach } from "vite-plus/test";

import authDefinition from "../../../../../packages/convex/src/auth";
import { handler } from "../../lib/auth";

const AUTH_ENDPOINTS = {
  SIGN_UP: "/api/auth/sign-up/email",
  SIGN_IN: "/api/auth/sign-in/email",
  SIGN_OUT: "/api/auth/sign-out",
  GET_SESSION: "/api/auth/get-session",
} as const;

const AUTH_COOKIE = {
  NAME: "better-auth.session_token",
} as const;

const TEST_USER = {
  EMAIL: "test@example.com",
  PASSWORD: "Password123!",
  NAME: "Test User",
} as const;

interface WhereClause {
  field: string;
  value: unknown;
  operator?: string;
  connector?: "AND" | "OR";
}

interface DatabaseRecord {
  id: string;
  _id: string;
  createdAt: number;
  _creationTime: number;
  [key: string]: unknown;
}

interface MockCtx {
  scheduler: { runAfter: () => Promise<void> };
  env: Record<string, string>;
}

type AdapterInput<K extends string = string> = {
  model: K;
  where?: WhereClause[];
};

type AdapterCountInput<K extends string = string> = AdapterInput<K>;

type AdapterCreateInput<T, K extends string = string> = AdapterInput<K> & {
  data: T;
  select?: string[];
};

type AdapterUpdateInput<
  T = Record<string, unknown>,
  K extends string = string,
> = AdapterInput<K> & {
  update: T;
  select?: string[];
};

interface BetterAuthPlugin {
  id: string;
}

interface AuthDefinitionOptions {
  plugins?: BetterAuthPlugin[];
  [key: string]: unknown;
}

vi.mock("$env/dynamic/public", () => ({
  env: {
    PUBLIC_CONVEX_SITE_URL: "http://localhost:3000",
  },
}));

process.env.DASHBOARD_URL = "http://localhost:3000";
process.env.APPLE_CLIENT_ID = "mock";
process.env.APPLE_CLIENT_SECRET = "mock";
process.env.DEPLOY_ENV = "development";
process.env.GOOGLE_CLIENT_ID = "mock";
process.env.GOOGLE_CLIENT_SECRET = "mock";
process.env.JWKS =
  '[{"kty":"RSA","n":"7dYDJ3Uz4dLY7UfPW4R7_FgmS31Q1JIBel062pHs7sgoUYz65aBmo4yEXZFZwCU72cY3qnyHo1nzFpQMcq_2tNoO5vzJbOIdE9BJWjRC9LPra0ya7fqjGaGQfSJ7F6_ROMrYz7WV-DrZ02B-UTcWL1K-B5aoGatzs7m3_0N2DZ2VOLPhzVaH1r46lJtXLLA7PyK42cUVbyZCYXzdgM1nZ1jXzyRuDT0q7vJrLj6JqyazLLWVjF0pKvrI9-JCWKPlmQ1zZLlPkvzemx8-grOFRVehmGGy2ncNcz3hxZGCVk5rV4X9FtbrkX-umV0TlmV25fSlmIEd8uXB78LzFVuihw","e":"AQAB","d":"EWCsPVNSdaMWx4uSKpEtD_yO28AtykJaykqKlNLJuY61Z3QCFwoXxcZsG3wVzzTJQTm68oGD1ZsqaFFr8WtK_t7Z7OW2f_argjmbSnR8Ge4VevMPdOj1xtcnvATrcokdo-UqX07YxNjj9o5b3GpGfDGzAdHvuWRuIUkmGQggVZE0eTObEMw_j7E7lp0Xgz-H9qARtFvpNOZzHSTAeY9FZtH4mOysh_0M_ll6focT2ANxvarHIbXMuDyBygwyNuV2jJyu2RK_7SLfVXcucPT6rBPqO15XOAEsgdPCOTbWyrLc1INKziyPmlZwMW0_JrZdcXUAPeV5oXgkFLyTt9hwzQ","p":"-MIgsM8gIpQMwJYRMmp7YytvEKd6nvhBXXRcSNNi5dhdVyBUljwVIo5qWV5y_SCniRdMRaRGwhMPcnXpeU0MP_UGmVYF1yO3YBEGf6pR5jeG7wBe40Rn1a5LtYyCIkVeXsppZ0220dW9thb3GGUxVb6T1PrhvVHx7wjaCdFz00M","q":"9MJ8Zwwz3RjzbtQ99E3s7Vijd6FuVPRHjnlj9mo6hsr5ExewTZxOLav3klv-bKV6tqeMEqP0YNYmTfNxx_9yd6_GnrpwzdhqApIx-_iRwaP0-zuSgrCwYG06cyrqij7FyUbUgIlaYqkEa_CV57wD7PwoWVlJiy_d9JbXx3tWJW0","dp":"JAJ-Fvo0zaye1_YhUSoG6IkuD7wezQpk8_FXNpebFmimwmkEtabG7HSvQnagsLHcbsT3npE0SP3XW5tkC9IydsOyi9nfCJC8B-UPCsYOCwR4vPpRwhZx7YXIoeRQJkPicFhev7yJPYDycHyMknR7msz2u3sB2JUXL6IZZhhy6t8","dq":"V0ppbaLneEnmv7cIJXIJNpivLAIxxDCeuIxIf2BhYSNQc2O2Z-d_5j_3eoY-lebqfewBQ8Cfbk3RuWlCQg6zd0YEMyXRB0jQffw_wVpkOUhNHbCgTuXO8YTjHKHIpec_SMpvDSxvRNJ8ljZmcBAY4lMH3N3AIdi_cvS9HhK5pX0","qi":"Vo7d9yb62oCSJPDx2Obof5bXzhUS0ZhZA1xExPCWyL6K5BFHhrEHkyzfLBd3qxAWzbzXWx-eLtaS8Ou_TiweE872zoDHvWbGe8apdYZXUj1NKpSABJPxzyPNmC6B_rzwdnB92D75Pc9ZXkUzDVedvQi949G_vlDvK_YxP4TrXdQ","kid":"test-key","alg":"RS256","createdAt":"2026-04-17T08:53:16.164Z"}]';
process.env.MARKETING_URL = "mock";
process.env.RESEND_API_KEY = "mock";
process.env.STRIPE_SECRET_KEY = "mock";
process.env.STRIPE_WEBHOOK_SECRET = "mock";
process.env.BETTER_AUTH_SECRET = "supersecret";

vi.mock("../../../../../packages/convex/src/_crpc", () => ({
  defineAuth: (def: unknown) => def,
  httpMiddleware: () => {},
}));

let memoryDB: Record<string, Map<string, DatabaseRecord>> = {};

function getTable(name: string): Map<string, DatabaseRecord> {
  memoryDB[name] ??= new Map();
  return memoryDB[name];
}

const generateId = () => Math.random().toString(36).substring(2, 15);

function evaluateOperator(fieldVal: unknown, value: unknown, op: string = "eq"): boolean {
  if (op === "eq") return fieldVal === value;
  if (op === "ne") return fieldVal !== value;
  if (op === "in") return Array.isArray(value) && value.includes(fieldVal);
  return false;
}

function evaluateWhere(row: DatabaseRecord, where?: WhereClause[]): boolean {
  if (!where?.length) return true;
  let result = true;
  for (let i = 0; i < where.length; i++) {
    const clause = where[i];
    const fieldVal = row[clause.field === "id" ? "_id" : clause.field];
    const clauseResult = evaluateOperator(fieldVal, clause.value, clause.operator);

    if (i === 0) {
      result = clauseResult;
    } else {
      const connector = clause.connector || "AND";
      if (connector === "AND") result = result && clauseResult;
      if (connector === "OR") result = result || clauseResult;
    }
  }
  return result;
}

function findRows(model: string, where?: WhereClause[]): DatabaseRecord[] {
  return Array.from(getTable(model).values()).filter((r) => evaluateWhere(r, where));
}

function getUser(email: string): DatabaseRecord | undefined {
  const users = findRows("users", [{ field: "email", value: email }]);
  return users[0];
}

const mockAdapter = createAdapterFactory({
  adapter: () => ({
    count: async (input: AdapterCountInput) => {
      return findRows(input.model, input.where).length;
    },
    create: async <T extends { id?: string } & Record<string, unknown>>({
      model,
      data,
    }: AdapterCreateInput<T>) => {
      const id = data.id || generateId();
      const record: DatabaseRecord = {
        ...data,
        _id: id,
        id,
        createdAt: Date.now(),
        _creationTime: Date.now(),
      };
      getTable(model).set(id, record);
      return record as unknown as T;
    },
    delete: async (input: AdapterInput): Promise<void> => {
      const rows = findRows(input.model, input.where);
      for (const row of rows) {
        getTable(input.model).delete(row._id);
      }
    },
    deleteMany: async (input: AdapterInput): Promise<number> => {
      const rows = findRows(input.model, input.where);
      for (const row of rows) {
        getTable(input.model).delete(row._id);
      }
      return rows.length;
    },
    findMany: async <T>(input: AdapterInput): Promise<T[]> => {
      const rows = findRows(input.model, input.where);
      return rows as unknown as T[];
    },
    findOne: async <T>(input: AdapterInput): Promise<T | null> => {
      const rows = findRows(input.model, input.where);
      return (rows[0] || null) as unknown as T | null;
    },
    update: async <T>(input: AdapterUpdateInput<T>): Promise<T | null> => {
      const rows = findRows(input.model, input.where);
      if (!rows.length) return null;
      const row = rows[0];
      const updated = { ...row, ...input.update };
      getTable(input.model).set(row._id, updated as DatabaseRecord);
      return updated as unknown as T;
    },
    updateMany: async (input: AdapterUpdateInput<Record<string, unknown>>): Promise<number> => {
      const rows = findRows(input.model, input.where);
      for (const row of rows) {
        getTable(input.model).set(row._id, {
          ...row,
          ...input.update,
        } as DatabaseRecord);
      }
      return rows.length;
    },
  }),
  config: {
    adapterId: "Convex Adapter Mock",
    supportsJSON: true,
    supportsNumericIds: false,
    usePlural: true,
  },
});

function getAuth(ctx: any) {
  const options = authDefinition(ctx) as AuthDefinitionOptions;

  options.plugins = options.plugins?.filter((p: BetterAuthPlugin) => p.id !== "convex") || [];

  return {
    handler: betterAuth({
      ...options,
      plugins: options.plugins as never[],
      secret: "supersecret",
      baseURL: "http://localhost:3000",
      trustedOrigins: ["http://localhost:3000", "http://localhost:5173"],
      advanced: {
        crossSubDomainCookies: {
          enabled: true,
        },
      },
      database: mockAdapter,
    }).handler,
  };
}

const mockCtx: MockCtx = {
  scheduler: { runAfter: async () => {} },
  env: {
    DASHBOARD_URL: "http://localhost:3000",
    APPLE_CLIENT_ID: "mock",
    APPLE_CLIENT_SECRET: "mock",
    GOOGLE_CLIENT_ID: "mock",
    GOOGLE_CLIENT_SECRET: "mock",
  },
};

const app = new Hono();
app.use("*", async (c, next) => {
  c.env = mockCtx as unknown as Record<string, unknown>;
  return next();
});

app.use("*", httpMiddleware({ getAuth }));

describe("Auth Integration Flow", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    memoryDB = {};

    originalFetch = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, {
        ...init,
        duplex: "half",
      } as RequestInit);
      return app.fetch(request, mockCtx);
    }) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const { POST, GET } = handler();

  function createMockRequest(path: string, options: RequestInit = {}): Request {
    const headers = new Headers(options.headers);
    if (!headers.has("Origin")) headers.set("Origin", "http://localhost:3000");
    if (!headers.has("Host")) headers.set("Host", "localhost:3000");
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }
    return new Request(`http://localhost:3000${path}`, { ...options, headers });
  }

  function extractSessionToken(setCookie: string | null): string {
    if (!setCookie) return "";
    const match = setCookie.match(new RegExp(`${AUTH_COOKIE.NAME}=([^;]+)`));
    return match ? match[1] : "";
  }

  async function registerUser(
    email: string,
    password: string,
    name: string,
  ): Promise<{ status: number; token: string; setCookie: string | null }> {
    const req = createMockRequest(AUTH_ENDPOINTS.SIGN_UP, {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    const res = await POST({ request: req } as any);
    const setCookie = res.headers.get("Set-Cookie");
    const token = extractSessionToken(setCookie);
    return { status: res.status, token, setCookie };
  }

  async function signInUser(
    email: string,
    password: string,
  ): Promise<{ status: number; token: string; setCookie: string | null }> {
    const req = createMockRequest(AUTH_ENDPOINTS.SIGN_IN, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const res = await POST({ request: req } as any);
    const setCookie = res.headers.get("Set-Cookie");
    const token = extractSessionToken(setCookie);
    return { status: res.status, token, setCookie };
  }

  async function getSession(token: string): Promise<{
    status: number;
    body: { user: { email: string; name?: string }; session: { token: string } } | null;
  }> {
    const req = createMockRequest(AUTH_ENDPOINTS.GET_SESSION, {
      method: "GET",
      headers: { Cookie: `${AUTH_COOKIE.NAME}=${token}` },
    });
    const res = await GET({ request: req } as any);
    const body = res.status === 200 ? await res.json() : null;
    return { status: res.status, body };
  }

  async function signOutUser(token: string): Promise<{ status: number; setCookie: string | null }> {
    const req = createMockRequest(AUTH_ENDPOINTS.SIGN_OUT, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE.NAME}=${token}` },
    });
    const res = await POST({ request: req } as any);
    const setCookie = res.headers.get("Set-Cookie");
    return { status: res.status, setCookie };
  }

  describe("Registration", () => {
    it("Successfully registers a new user with valid credentials", async () => {
      const { status, token, setCookie } = await registerUser(
        TEST_USER.EMAIL,
        TEST_USER.PASSWORD,
        TEST_USER.NAME,
      );

      expect(status).toBe(200);
      expect(token).toBeTruthy();
      expect(setCookie).toContain(AUTH_COOKIE.NAME);
      expect(getTable("users").size).toBe(1);
      expect(getTable("sessions").size).toBe(1);

      const user = getUser(TEST_USER.EMAIL);
      expect(user).toBeDefined();
      expect(user?.email).toBe(TEST_USER.EMAIL);
      expect(user?.name).toBe(TEST_USER.NAME);
    });

    it("Rejects registration with duplicate email", async () => {
      await registerUser(TEST_USER.EMAIL, TEST_USER.PASSWORD, TEST_USER.NAME);

      const { status, token, setCookie } = await registerUser(
        TEST_USER.EMAIL,
        "AnotherPassword456!",
        "Another User",
      );

      expect(status).toBe(422);
      expect(token).toBe("");
      expect(setCookie).toBeNull();
      expect(getTable("users").size).toBe(1);
    });

    it("Rejects registration with weak password", async () => {
      const { status, token } = await registerUser("new@example.com", "weak", TEST_USER.NAME);

      expect(status).toBe(400);
      expect(token).toBe("");
      expect(getTable("users").size).toBe(0);
    });

    it("Rejects registration with missing email", async () => {
      const req = createMockRequest(AUTH_ENDPOINTS.SIGN_UP, {
        method: "POST",
        body: JSON.stringify({ password: TEST_USER.PASSWORD, name: TEST_USER.NAME }),
      });
      const res = await POST({ request: req } as any);

      expect(res.status).toBe(400);
      expect(getTable("users").size).toBe(0);
    });

    it("Rejects registration with missing password", async () => {
      const req = createMockRequest(AUTH_ENDPOINTS.SIGN_UP, {
        method: "POST",
        body: JSON.stringify({ email: "new2@example.com", name: TEST_USER.NAME }),
      });
      const res = await POST({ request: req } as any);

      expect(res.status).toBe(400);
      expect(getTable("users").size).toBe(0);
    });
  });

  describe("Sign In", () => {
    beforeEach(async () => {
      await registerUser(TEST_USER.EMAIL, TEST_USER.PASSWORD, TEST_USER.NAME);
    });

    it("Successfully signs in with correct credentials", async () => {
      getTable("sessions").clear();

      const { status, token, setCookie } = await signInUser(TEST_USER.EMAIL, TEST_USER.PASSWORD);

      expect(status).toBe(200);
      expect(token).toBeTruthy();
      expect(setCookie).toContain(AUTH_COOKIE.NAME);
      expect(getTable("sessions").size).toBe(1);
    });

    it("Rejects sign-in with wrong password", async () => {
      const initialSessions = getTable("sessions").size;

      const { status, token, setCookie } = await signInUser(TEST_USER.EMAIL, "WrongPassword456!");

      expect(status).toBe(401);
      expect(token).toBe("");
      expect(setCookie).toBeNull();
      expect(getTable("sessions").size).toBe(initialSessions);
    });

    it("Rejects sign-in with non-existent email", async () => {
      const { status, token, setCookie } = await signInUser(
        "nonexistent@example.com",
        TEST_USER.PASSWORD,
      );

      expect(status).toBe(401);
      expect(token).toBe("");
      expect(setCookie).toBeNull();
    });

    it("Rejects sign-in with empty password", async () => {
      const { status, token } = await signInUser(TEST_USER.EMAIL, "");

      expect(status).toBe(401);
      expect(token).toBe("");
    });
  });

  describe("Session Validation", () => {
    let validToken = "";

    beforeEach(async () => {
      const result = await registerUser(TEST_USER.EMAIL, TEST_USER.PASSWORD, TEST_USER.NAME);
      validToken = result.token;
    });

    it("Successfully validates a valid session token", async () => {
      const { status, body } = await getSession(validToken);

      expect(status).toBe(200);
      expect(body?.user?.email).toBe(TEST_USER.EMAIL);
      expect(body?.session?.token).toBeTruthy();
    });

    it("Returns null session for invalid/malformed token", async () => {
      const { status, body } = await getSession("invalid-token-123");

      expect(status).toBe(200);
      expect(body?.user).toBeFalsy();
      expect(body?.session).toBeFalsy();
    });

    it("Returns null session for empty token", async () => {
      const { status, body } = await getSession("");

      expect(status).toBe(200);
      expect(body?.user).toBeFalsy();
      expect(body?.session).toBeFalsy();
    });

    it("Returns null session for manipulated token", async () => {
      const tamperedToken = validToken.slice(0, -5) + "xxxxx";
      const { status, body } = await getSession(tamperedToken);

      expect(status).toBe(200);
      expect(body?.user).toBeFalsy();
    });
  });

  describe("Sign Out", () => {
    let validToken = "";

    beforeEach(async () => {
      const result = await registerUser(TEST_USER.EMAIL, TEST_USER.PASSWORD, TEST_USER.NAME);
      validToken = result.token;
    });

    it("Successfully signs out and clears session", async () => {
      const { status, setCookie } = await signOutUser(validToken);

      expect(status).toBe(200);
      expect(setCookie).toMatch(/Max-Age=0|Expires=/i);
      expect(getTable("sessions").size).toBe(0);
    });

    it("Handles sign-out with invalid token gracefully", async () => {
      const { status, setCookie } = await signOutUser("invalid-token");

      expect(status).toBe(200);
      expect(setCookie).toMatch(/Max-Age=0|Expires=/i);
    });

    it("Handles sign-out with empty token gracefully", async () => {
      const { status, setCookie } = await signOutUser("");

      expect(status).toBe(200);
    });
  });

  describe("Cookie Security", () => {
    it("Sets secure cookie attributes on registration", async () => {
      const { setCookie } = await registerUser(
        "secure@example.com",
        TEST_USER.PASSWORD,
        TEST_USER.NAME,
      );

      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=");
    });

    it("Clears cookie with secure attributes on sign-out", async () => {
      const { token } = await registerUser(
        "secure@example.com",
        TEST_USER.PASSWORD,
        TEST_USER.NAME,
      );
      const { setCookie } = await signOutUser(token);

      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=/i);
    });
  });

  describe("Concurrent Sessions", () => {
    it("Preserves existing session when signing in again", async () => {
      getTable("sessions").clear();

      await signInUser(TEST_USER.EMAIL, TEST_USER.PASSWORD);
      const firstSessionCount = getTable("sessions").size;

      await signInUser(TEST_USER.EMAIL, TEST_USER.PASSWORD);

      expect(getTable("sessions").size).toBeGreaterThanOrEqual(firstSessionCount);
    });
  });

  describe("Security Headers", () => {
    it("Handles request with X-Forwarded-Host header", async () => {
      const { token } = await registerUser(
        "secure2@example.com",
        TEST_USER.PASSWORD,
        TEST_USER.NAME,
      );

      const req = createMockRequest(AUTH_ENDPOINTS.GET_SESSION, {
        method: "GET",
        headers: {
          Cookie: `${AUTH_COOKIE.NAME}=${token}`,
          "X-Forwarded-Host": "evil-site.com",
        },
      });
      const res = await GET({ request: req } as any);

      expect(res.status).toBe(200);
    });
  });

  describe("Rate Limiting", () => {
    it("Handles rapid failed sign-in attempts", async () => {
      for (let i = 0; i < 5; i++) {
        await signInUser(TEST_USER.EMAIL, "wrong-password-" + i);
      }

      const { status } = await signInUser(TEST_USER.EMAIL, "wrong-password-final");

      expect(status).toBeGreaterThanOrEqual(400);
    });
  });
});
