import { $Enums } from "@prisma/client";
import { prisma } from "../../db";
import { requireRole, requireAuth, GQLContext } from "../../context";
import { generateAssignment } from "../../services/ai.service";

const FACULTY_ROLES = ["FACULTY", "HOD", "ADMIN"];

const VALID_STATUSES = new Set(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]);
const VALID_TYPES    = new Set(["ASSIGNMENT", "INTERNAL_ASSESSMENT", "LAB_RECORD", "DESCRIPTIVE_EXAM"]);

async function withCounts(a: { id: string; rubricId: string; [key: string]: unknown }) {
  const [submissionCount, pendingReviewCount] = await Promise.all([
    prisma.submission.count({ where: { assignmentId: a.id } }),
    prisma.grade.count({ where: { submission: { assignmentId: a.id }, status: "AI_DRAFT" } }),
  ]);
  const rubric = await prisma.rubric.findUnique({
    where: { id: a.rubricId as string },
    include: { criteria: { orderBy: { order: "asc" } } },
  });
  return { ...a, rubric, submissionCount, pendingReviewCount };
}

function toStatus(raw?: string | null): $Enums.AssignmentStatus {
  return (raw && VALID_STATUSES.has(raw) ? raw : "DRAFT") as $Enums.AssignmentStatus;
}

function toAssignmentType(raw?: string | null): $Enums.AssignmentType | undefined {
  return (raw && VALID_TYPES.has(raw) ? raw : undefined) as $Enums.AssignmentType | undefined;
}

function statusToIsActive(status: string): boolean {
  return status === "ACTIVE";
}

function normalizeDateArg(raw?: string | null): Date | undefined {
  if (!raw) return undefined;
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00` : raw);
}

export const assignmentResolvers = {
  Query: {
    assignments: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);
      const list = await prisma.assignment.findMany({
        where: { createdById: userId },
        orderBy: { createdAt: "desc" },
      });
      return Promise.all(list.map(withCounts));
    },

    studentAssignments: async (_: unknown, __: unknown, ctx: GQLContext) => {
      requireAuth(ctx);
      const list = await prisma.assignment.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });
      return Promise.all(list.map(withCounts));
    },

    assignment: async (_: unknown, args: { id: string }, ctx: GQLContext) => {
      requireAuth(ctx);
      const a = await prisma.assignment.findUnique({ where: { id: args.id } });
      if (!a) return null;
      return withCounts(a);
    },
  },

  Mutation: {
    generateAssignment: async (
      _: unknown,
      args: { input: { topic: string; subject?: string; assignmentType: string; totalMarks: number; criteriaCount: number } },
      ctx: GQLContext
    ) => {
      requireRole(ctx, ...FACULTY_ROLES);
      const { topic, subject, assignmentType, totalMarks, criteriaCount } = args.input;
      return generateAssignment(topic, subject ?? topic, assignmentType, totalMarks, criteriaCount);
    },

    createAssignment: async (
      _: unknown,
      args: {
        input: {
          title: string; question: string; modelAnswer: string; assignmentType: string;
          status?: string; subject?: string; semester?: string; section?: string;
          rubricId: string; openDate?: string; dueDate?: string;
          lateSubmissionPenalty?: number; instructions?: string;
          submissionGuidelines?: string; referenceMaterials?: string; notesForStudents?: string;
        };
      },
      ctx: GQLContext
    ) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);
      const { status: rawStatus, assignmentType: rawType, openDate, dueDate, ...rest } = args.input;
      const status = toStatus(rawStatus);
      const assignmentType = toAssignmentType(rawType) ?? ("ASSIGNMENT" as $Enums.AssignmentType);

      const a = await prisma.assignment.create({
        data: {
          ...rest,
          assignmentType,
          status,
          isActive: statusToIsActive(status),
          openDate: normalizeDateArg(openDate),
          dueDate: normalizeDateArg(dueDate),
          createdById: userId,
        },
      });
      return withCounts(a);
    },

    updateAssignment: async (
      _: unknown,
      args: {
        id: string;
        input: {
          title?: string; question?: string; modelAnswer?: string; assignmentType?: string;
          subject?: string; semester?: string; section?: string; rubricId?: string;
          openDate?: string; dueDate?: string; lateSubmissionPenalty?: number;
          instructions?: string; submissionGuidelines?: string;
          referenceMaterials?: string; notesForStudents?: string;
        };
      },
      ctx: GQLContext
    ) => {
      requireRole(ctx, ...FACULTY_ROLES);
      const { assignmentType: rawType, openDate, dueDate, ...rest } = args.input;
      const assignmentType = toAssignmentType(rawType);

      const a = await prisma.assignment.update({
        where: { id: args.id },
        data: {
          ...rest,
          ...(assignmentType ? { assignmentType } : {}),
          openDate: normalizeDateArg(openDate),
          dueDate: normalizeDateArg(dueDate),
        },
      });
      return withCounts(a);
    },

    updateAssignmentStatus: async (
      _: unknown,
      args: { id: string; status: string },
      ctx: GQLContext
    ) => {
      requireRole(ctx, ...FACULTY_ROLES);
      const status = toStatus(args.status);
      const a = await prisma.assignment.update({
        where: { id: args.id },
        data: { status, isActive: statusToIsActive(status) },
      });
      return withCounts(a);
    },

    cloneAssignment: async (_: unknown, args: { id: string }, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);
      const original = await prisma.assignment.findUnique({ where: { id: args.id } });
      if (!original) throw new Error("Assignment not found");

      const a = await prisma.assignment.create({
        data: {
          title: `Copy of ${original.title}`,
          question: original.question,
          modelAnswer: original.modelAnswer,
          assignmentType: original.assignmentType,
          status: "DRAFT" as $Enums.AssignmentStatus,
          isActive: false,
          subject: original.subject,
          semester: original.semester,
          section: original.section,
          rubricId: original.rubricId,
          openDate: original.openDate,
          dueDate: original.dueDate,
          lateSubmissionPenalty: original.lateSubmissionPenalty,
          instructions: original.instructions,
          submissionGuidelines: original.submissionGuidelines,
          referenceMaterials: original.referenceMaterials,
          notesForStudents: original.notesForStudents,
          createdById: userId,
        },
      });
      return withCounts(a);
    },

    toggleAssignment: async (_: unknown, args: { id: string }, ctx: GQLContext) => {
      requireRole(ctx, ...FACULTY_ROLES);
      const current = await prisma.assignment.findUnique({ where: { id: args.id } });
      if (!current) throw new Error("Not found");
      const status = current.status === ("ACTIVE" as $Enums.AssignmentStatus)
        ? ("CLOSED" as $Enums.AssignmentStatus)
        : ("ACTIVE" as $Enums.AssignmentStatus);
      const a = await prisma.assignment.update({
        where: { id: args.id },
        data: { status, isActive: statusToIsActive(status) },
      });
      return withCounts(a);
    },
  },
};
