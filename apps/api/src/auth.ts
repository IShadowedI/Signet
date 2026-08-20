import { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "dev-only-secret-change-in-production";
const TOKEN_TTL = "7d";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface InternalTokenPayload {
  scope: "internal";
  userId: string;
  role: string;
  tenantId?: string | null;
}

interface BuyerTokenPayload {
  scope: "buyer";
  userId: string;
  tenantId: string;
  role: string;
}

export type TokenPayload = InternalTokenPayload | BuyerTokenPayload;

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export const INTERNAL_COOKIE = "signet_admin_session";
export const BUYER_COOKIE = "signet_buyer_session";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export function setSessionCookie(res: Response, name: string, token: string) {
  res.cookie(name, token, cookieOptions);
}

export function clearSessionCookie(res: Response, name: string) {
  res.clearCookie(name, { ...cookieOptions, maxAge: undefined });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      internalUser?: InternalTokenPayload;
      buyerUser?: BuyerTokenPayload;
    }
  }
}

/** Requires a valid Signet staff session; optionally restricts by role. */
export function requireInternalAuth(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[INTERNAL_COOKIE];
    const payload = token ? verifyToken(token) : null;
    if (!payload || payload.scope !== "internal") {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (roles.length > 0 && !roles.includes(payload.role)) {
      return res.status(403).json({ error: "Insufficient role" });
    }
    req.internalUser = payload;
    next();
  };
}

/** Requires a valid buyer session scoped to the :slug tenant in the route. */
export function requireBuyerAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[BUYER_COOKIE];
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.scope !== "buyer") {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.buyerUser = payload;
  next();
}
