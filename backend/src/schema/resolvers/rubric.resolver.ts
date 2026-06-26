import { prisma } from "../../db";
import { requireRole, GQLContext } from "../../context";

const FACULTY_ROLES = ["FACULTY", "HOD", "ADMIN"];

export const rubricResolvers = {
  Query: {
    rubrics: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);
      return prisma.rubric.findMany({
        where: { OR: [{ createdById: userId }, { isTemplate: true }] },
        include: { criteria: { orderBy: { order: "asc" } } },
      });
    },
    rubric: async (_: unknown, args: { id: string }, ctx: GQLContext) => {
      requireRole(ctx, ...FACULTY_ROLES);
      return prisma.rubric.findUnique({
        where: { id: args.id },
        include: { criteria: { orderBy: { order: "asc" } } },
      });
    },
  },
  Mutation: {
    createRubric: async (
      _: unknown,
      args: { input: { name: string; description?: string; totalMarks: number; department?: string; isTemplate?: boolean; criteria: { name: string; description?: string; maxMarks: number; order: number }[] } },
      ctx: GQLContext
    ) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);
      const { criteria, ...rest } = args.input;
      return prisma.rubric.create({
        data: {
          ...rest,
          createdById: userId,
          criteria: { create: criteria },
        },
        include: { criteria: { orderBy: { order: "asc" } } },
      });
    },
    deleteRubric: async (_: unknown, args: { id: string }, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);
      await prisma.rubric.deleteMany({ where: { id: args.id, createdById: userId } });
      return true;
    },
  },
};
