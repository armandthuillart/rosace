import { requireEnv } from '@repo/utils';
import { SignJWT, importJWK, type JWK } from 'jose';

import { Id } from './_generated/dataModel';

export type JWKS = {
  kid: string;
  public: { keys: JWK[] };
  private: JWK;
};

export async function signJWT(userId: Id<'users'>) {
  const jwks = JSON.parse(requireEnv('JWKS')) as JWKS;
  const jwk = await importJWK(jwks.private, 'RS256');

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: jwks.kid })
    .setSubject(userId)
    .setAudience('convex')
    .setIssuer(requireEnv('CONVEX_SITE_URL'))
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(jwk);
}

export function randomToken() {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}
