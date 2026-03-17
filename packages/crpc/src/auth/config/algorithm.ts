import type { JwtOptions } from "better-auth/plugins";

interface JwkDoc {
	alg?: string;
	createdAt: number;
	crv?: string;
	id: string;
	privateKey: string;
	publicKey: string;
}

/**
 * Converts a JWK document to a data URI.
 * @param jwks - The JWK document.
 * @returns The data URI.
 */
function toJwkDataUri(jwks: JwkDoc[]) {
	return `data:text/plain;charset=utf-8;base64,${btoa(JSON.stringify(createPublicJwks(jwks)))}`;
}

/**
 * Creates a public JWKS from a JWK document.
 * @param jwks - The JWK document.
 * @param options - The options for the JWKS.
 * @returns The public JWKS.
 */
const createPublicJwks = (jwks: JwkDoc[], options?: JwtOptions) => {
	const keyPairConfig = options?.jwks?.keyPairConfig;
	const defaultAlg = keyPairConfig?.alg ?? "EdDSA";
	const defaultCrv =
		keyPairConfig && "crv" in keyPairConfig ? keyPairConfig.crv : undefined;

	return {
		keys: jwks.map((key) => ({
			...JSON.parse(key.publicKey),
			alg: key.alg ?? defaultAlg,
			crv: key.crv ?? defaultCrv,
			kid: key.id,
		})),
	};
};

export { createPublicJwks, toJwkDataUri };
