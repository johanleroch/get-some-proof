import { importOAuthScope } from "../importOAuthOptions";

type JwtVerifier = (args: { body: { token: string } }) => Promise<{
  payload: Record<string, unknown> | null;
}>;

/** Internal verified identity, never accepted as a public function argument. */
export type ImportAccessGrant = {
  actorId: string;
  clientId: string;
  issuedAt: number;
  generation?: number;
  scope?: string;
  verifiedAt: number;
  expiresAt: number;
};

/** Signature, issuer and audience are checked by the configured JWT plugin.
 * Current consent, client status and Project ownership must also be checked
 * inside each private operation; this result alone does not authorize a write.
 */
export async function verifyImportAccessToken(
  authorization: string | null,
  verifyJwt: JwtVerifier,
  requiredScope = importOAuthScope,
): Promise<ImportAccessGrant | null> {
  if (!authorization || authorization.length > 8192) return null;
  const match =
    /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(
      authorization,
    );
  if (!match) return null;
  const { payload } = await verifyJwt({ body: { token: match[1] } });
  if (!payload) return null;
  const verifiedAt = Date.now();
  const now = Math.floor(verifiedAt / 1000);
  if (
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.length > 256 ||
    typeof payload.azp !== "string" ||
    !payload.azp ||
    payload.azp.length > 256 ||
    typeof payload.scope !== "string" ||
    !payload.scope.split(" ").includes(requiredScope) ||
    (payload.import_grant_generation !== undefined &&
      (typeof payload.import_grant_generation !== "number" ||
        !Number.isSafeInteger(payload.import_grant_generation) ||
        payload.import_grant_generation < 0)) ||
    typeof payload.iat !== "number" ||
    !Number.isSafeInteger(payload.iat) ||
    typeof payload.exp !== "number" ||
    !Number.isSafeInteger(payload.exp) ||
    payload.iat > now ||
    payload.exp <= now ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > 900
  )
    return null;
  return {
    scope: requiredScope,
    actorId: payload.sub,
    clientId: payload.azp,
    issuedAt: payload.iat * 1000,
    ...(typeof payload.import_grant_generation === "number"
      ? { generation: payload.import_grant_generation }
      : {}),
    verifiedAt,
    expiresAt: payload.exp * 1000,
  };
}
