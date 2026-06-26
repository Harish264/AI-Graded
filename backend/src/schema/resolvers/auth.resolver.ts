import bcrypt from "bcryptjs";
import { prisma } from "../../db";
import { signAccess, signRefresh, verifyRefresh } from "../../auth/jwt";
import { requireAuth, GQLContext } from "../../context";
import { addDays } from "../../utils";

export const authResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireAuth(ctx);
      return prisma.user.findUnique({ where: { id: userId } });
    },
  },
  Mutation: {
    register: async (
      _: unknown,
      args: { email: string; password: string; fullName: string; role: string; department?: string }
    ) => {
      const existing = await prisma.user.findUnique({ where: { email: args.email } });
      if (existing) throw new Error("Email already registered");

      const user = await prisma.user.create({
        data: {
          email: args.email,
          fullName: args.fullName,
          passwordHash: await bcrypt.hash(args.password, 12),
          role: args.role as never,
          department: args.department,
        },
      });

      const payload = { userId: user.id, role: user.role };
      const refreshToken = signRefresh(payload);
      await prisma.refreshToken.create({
        data: { token: refreshToken, userId: user.id, expiresAt: addDays(7) },
      });

      return { accessToken: signAccess(payload), refreshToken, user };
    },

    login: async (_: unknown, args: { email: string; password: string }) => {
      const user = await prisma.user.findUnique({ where: { email: args.email } });
      if (!user?.passwordHash) throw new Error("Invalid credentials");
      const valid = await bcrypt.compare(args.password, user.passwordHash);
      if (!valid) throw new Error("Invalid credentials");

      const payload = { userId: user.id, role: user.role };
      const refreshToken = signRefresh(payload);
      await prisma.refreshToken.create({
        data: { token: refreshToken, userId: user.id, expiresAt: addDays(7) },
      });

      return { accessToken: signAccess(payload), refreshToken, user };
    },

    refreshToken: async (_: unknown, args: { token: string }) => {
      const stored = await prisma.refreshToken.findUnique({ where: { token: args.token } });
      if (!stored || stored.expiresAt < new Date()) throw new Error("Invalid refresh token");

      const payload = verifyRefresh(args.token);
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) throw new Error("User not found");

      await prisma.refreshToken.delete({ where: { id: stored.id } });
      const newRefresh = signRefresh({ userId: user.id, role: user.role });
      await prisma.refreshToken.create({
        data: { token: newRefresh, userId: user.id, expiresAt: addDays(7) },
      });

      return {
        accessToken: signAccess({ userId: user.id, role: user.role }),
        refreshToken: newRefresh,
        user,
      };
    },
  },
};
