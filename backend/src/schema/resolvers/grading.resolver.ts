import { prisma } from "../../db";
import { requireRole, requireAuth, GQLContext } from "../../context";
import { explainGrade, generateFeedback } from "../../services/ai.service";

const FACULTY_ROLES = ["FACULTY", "HOD", "ADMIN"];

async function getGradeWithScores(submissionId: string) {
  const grade = await prisma.grade.findUnique({
    where: { submissionId },
    include: {
      criterionScores: { include: { criterion: true } },
    },
  });
  if (!grade) return null;

  return {
    ...grade,
    criterionScores: grade.criterionScores.map((cs) => ({
      id: cs.id,
      criterionId: cs.criterionId,
      criterionName: cs.criterion.name,
      maxMarks: cs.criterion.maxMarks,
      aiScore: cs.aiScore,
      finalScore: cs.finalScore,
      comment: cs.comment,
    })),
  };
}

export const gradingResolvers = {
  Query: {
    submissionDetail: async (_: unknown, args: { submissionId: string }, ctx: GQLContext) => {
      requireRole(ctx, ...FACULTY_ROLES);
      const submission = await prisma.submission.findUnique({
        where: { id: args.submissionId },
        include: {
          student: true,
          assignment: true,
        },
      });
      if (!submission) return null;
      return {
        submissionId: submission.id,
        studentName: submission.student.fullName,
        studentEmail: submission.student.email,
        answerText: submission.answerText,
        ocrText: submission.ocrText,
        submittedAt: submission.submittedAt,
        assignmentTitle: submission.assignment.title,
        assignmentQuestion: submission.assignment.question,
        modelAnswer: submission.assignment.modelAnswer,
      };
    },

    gradingQueue: async (_: unknown, args: { assignmentId?: string }, ctx: GQLContext) => {
      requireRole(ctx, ...FACULTY_ROLES);
      const grades = await prisma.grade.findMany({
        where: {
          status: "AI_DRAFT",
          ...(args.assignmentId
            ? { submission: { assignmentId: args.assignmentId } }
            : {}),
        },
        include: { submission: { include: { student: true, assignment: true } } },
        orderBy: [{ needsReview: "desc" }, { createdAt: "asc" }],
      });

      return grades.map((g) => ({
        submissionId: g.submissionId,
        studentName: g.submission.student.fullName,
        studentEmail: g.submission.student.email,
        assignmentTitle: g.submission.assignment.title,
        assignmentId: g.submission.assignment.id,
        aiScore: g.aiScore,
        confidence: g.confidence,
        needsReview: g.needsReview,
        status: g.status,
        submittedAt: g.submission.submittedAt,
      }));
    },

    grade: async (_: unknown, args: { submissionId: string }, ctx: GQLContext) => {
      requireRole(ctx, ...FACULTY_ROLES);
      return getGradeWithScores(args.submissionId);
    },

    studentGrade: async (_: unknown, args: { submissionId: string }, ctx: GQLContext) => {
      const userId = requireAuth(ctx);
      const submission = await prisma.submission.findFirst({
        where: { id: args.submissionId, studentId: userId },
      });
      if (!submission) throw new Error("Not found");
      const grade = await prisma.grade.findUnique({ where: { submissionId: args.submissionId } });
      if (grade?.status !== "PUBLISHED") throw new Error("Grade not yet published");
      return getGradeWithScores(args.submissionId);
    },

    explainGrade: async (_: unknown, args: { submissionId: string }, ctx: GQLContext) => {
      requireRole(ctx, ...FACULTY_ROLES);

      const submission = await prisma.submission.findUnique({
        where: { id: args.submissionId },
        include: { assignment: true },
      });
      if (!submission) throw new Error("Submission not found");

      const grade = await prisma.grade.findUnique({
        where: { submissionId: args.submissionId },
        include: { criterionScores: { include: { criterion: true } } },
      });
      if (!grade) throw new Error("Grade not found");

      const studentAnswer = submission.answerText ?? submission.ocrText ?? "";

      const criterionScores = grade.criterionScores.map((cs) => ({
        criterionName: cs.criterion.name,
        maxMarks: cs.criterion.maxMarks,
        aiScore: cs.aiScore ?? 0,
        comment: cs.comment,
      }));

      const result = await explainGrade(
        submission.assignment.question,
        submission.assignment.modelAnswer,
        studentAnswer,
        criterionScores
      );

      return result;
    },
  },

  Mutation: {
    reviewGrade: async (
      _: unknown,
      args: {
        submissionId: string;
        input: {
          action: string;
          finalScore?: number;
          finalFeedback?: string;
          criterionOverrides?: { criterionId: string; finalScore: number }[];
        };
      },
      ctx: GQLContext
    ) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);
      const grade = await prisma.grade.findUnique({ where: { submissionId: args.submissionId } });
      if (!grade) throw new Error("Grade not found");

      const { action, finalScore, finalFeedback, criterionOverrides } = args.input;

      await prisma.grade.update({
        where: { submissionId: args.submissionId },
        data: {
          status: action === "approve" ? "APPROVED" : "OVERRIDDEN",
          finalScore: action === "override" && finalScore != null ? finalScore : undefined,
          finalFeedback: action === "override" && finalFeedback ? finalFeedback : undefined,
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });

      if (action === "override" && criterionOverrides?.length) {
        for (const override of criterionOverrides) {
          await prisma.gradeCriterionScore.updateMany({
            where: { gradeId: grade.id, criterionId: override.criterionId },
            data: { finalScore: override.finalScore },
          });
        }
      }

      await prisma.auditLog.create({
        data: {
          gradeId: grade.id,
          action,
          actorId: userId,
          aiScore: grade.aiScore ?? undefined,
          humanScore: finalScore ?? grade.finalScore ?? undefined,
        },
      });

      return getGradeWithScores(args.submissionId);
    },

    publishGrade: async (_: unknown, args: { submissionId: string }, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);
      const grade = await prisma.grade.findUnique({ where: { submissionId: args.submissionId } });
      if (!grade) throw new Error("Grade not found");
      if (!["APPROVED", "OVERRIDDEN"].includes(grade.status)) {
        throw new Error("Grade must be approved before publishing");
      }

      await prisma.$transaction([
        prisma.grade.update({
          where: { submissionId: args.submissionId },
          data: { status: "PUBLISHED" },
        }),
        prisma.submission.update({
          where: { id: args.submissionId },
          data: { status: "PUBLISHED" },
        }),
        prisma.auditLog.create({
          data: { gradeId: grade.id, action: "published", actorId: userId, humanScore: grade.finalScore ?? undefined },
        }),
      ]);

      return getGradeWithScores(args.submissionId);
    },

    bulkApproveGrades: async (_: unknown, args: { submissionIds: string[] }, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);
      let approved = 0;

      for (const submissionId of args.submissionIds) {
        const grade = await prisma.grade.findUnique({ where: { submissionId } });
        if (!grade || grade.status !== "AI_DRAFT") continue;

        await prisma.grade.update({
          where: { submissionId },
          data: { status: "APPROVED", reviewedById: userId, reviewedAt: new Date() },
        });

        await prisma.auditLog.create({
          data: {
            gradeId: grade.id,
            action: "bulk_approve",
            actorId: userId,
            aiScore: grade.aiScore ?? undefined,
            humanScore: grade.finalScore ?? undefined,
          },
        });

        approved++;
      }

      return approved;
    },

    generateFeedback: async (_: unknown, args: { submissionId: string }, ctx: GQLContext) => {
      requireRole(ctx, ...FACULTY_ROLES);

      const submission = await prisma.submission.findUnique({
        where: { id: args.submissionId },
        include: { assignment: true },
      });
      if (!submission) throw new Error("Submission not found");

      const grade = await prisma.grade.findUnique({
        where: { submissionId: args.submissionId },
        include: { criterionScores: { include: { criterion: true } } },
      });
      if (!grade) throw new Error("Grade not found");

      const studentAnswer = submission.answerText ?? submission.ocrText ?? "";
      const totalScore = grade.finalScore ?? grade.aiScore ?? 0;
      const maxMarks = grade.criterionScores.reduce((s, cs) => s + cs.criterion.maxMarks, 0);
      const comments = grade.criterionScores.map((cs) => cs.comment ?? "").filter(Boolean);

      const feedback = await generateFeedback(
        submission.assignment.question,
        submission.assignment.modelAnswer,
        studentAnswer,
        totalScore,
        maxMarks,
        comments
      );

      return feedback;
    },
  },
};
