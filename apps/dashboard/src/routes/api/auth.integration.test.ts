import { handler } from "$lib/auth";
import { httpMiddleware } from "@repo/better-auth/http";
import { betterAuth } from "better-auth";
import { createAdapterFactory } from "better-auth/adapters";
import { Hono } from "hono";
import { describe, it, expect, beforeEach, vi, afterEach } from "vite-plus/test";

import authDefinition from "../../../../../packages/convex/src/auth";

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

interface AdapterInput {
  model: string;
  where?: WhereClause[];
}

interface AdapterCountInput {
  model: string;
  where?: WhereClause[];
}

interface AdapterCreateInput<T> {
  model: string;
  data: T;
  select?: string[];
}

interface AdapterUpdateInput<T = Record<string, unknown>> {
  model: string;
  where?: WhereClause[];
  update: T;
  select?: string[];
}

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

  const seedUser = async () => {
    const req = createMockRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      }),
    });
    const res = await POST({ request: req } as any);
    const cookie = res.headers.get("Set-Cookie") || "";
    const match = cookie.match(/better-auth\.session_token=([^;]+)/);
    return match ? match[1] : "";
  };

  it("Registers a new user.", async () => {
    const token = await seedUser();
    expect(token).toBeTruthy();
    const usersTable = getTable("users");
    const sessionsTable = getTable("sessions");
    expect(usersTable.size).toBe(1);
    expect(sessionsTable.size).toBe(1);
  });

  it("Authenticates an existing user.", async () => {
    await seedUser();

    getTable("sessions").clear();

    const signinReq = createMockRequest("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
      }),
    });

    const response = await POST({ request: signinReq } as any);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("better-auth.session_token");
    expect(getTable("sessions").size).toBe(1);
  });

  it("Validates an active session.", async () => {
    const token = await seedUser();

    const getSessionReq = createMockRequest("/api/auth/get-session", {
      method: "GET",
      headers: { Cookie: `better-auth.session_token=${token}` },
    });

    const response = await GET({ request: getSessionReq } as any);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      user: { email: string };
      session: { token: string };
    };
    expect(body.user.email).toBe("test@example.com");
    expect(token.startsWith(body.session.token)).toBe(true);
  });

  it("Terminates an active session.", async () => {
    const token = await seedUser();

    const signoutReq = createMockRequest("/api/auth/sign-out", {
      method: "POST",
      headers: { Cookie: `better-auth.session_token=${token}` },
    });

    const response = await POST({ request: signoutReq } as any);
    expect(response.status).toBe(200);

    const setCookie = response.headers.get("Set-Cookie") || "";
    expect(setCookie).toMatch(/Max-Age=0|Expires=/i);
    expect(getTable("sessions").size).toBe(0);
  });
});
