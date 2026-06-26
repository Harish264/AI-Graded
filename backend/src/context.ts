import { Request } from "express";
import { verifyAccess, TokenPayload } from "./auth/jwt";
import { prisma } from "./db";

export interface GQLContext {
  userId: string | null;
  role: string | null;
  prisma: typeof prisma;
}

export async function buildContext({ req }: { req: Request }): Promise<GQLContext> {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    return { userId: null, role: null, prisma };
  }

  try {
    const payload: TokenPayload = verifyAccess(auth.slice(7));
    return { userId: payload.userId, role: payload.role, prisma };
  } catch {
    return { userId: null, role: null, prisma };
  }
}

export function requireAuth(ctx: GQLContext): string {
  if (!ctx.userId) throw new Error("UNAUTHENTICATED");
  return ctx.userId;
}

export function requireRole(ctx: GQLContext, ...roles: string[]): string {
  const userId = requireAuth(ctx);
  if (!roles.includes(ctx.role ?? "")) throw new Error("FORBIDDEN");
  return userId;
}
