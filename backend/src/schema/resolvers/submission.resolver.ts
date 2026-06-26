import { prisma } from "../../db";
import { requireAuth, GQLContext } from "../../context";
import { gradeSubmission } from "../../services/ai.service";

async function runAIGrading(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: { rubric: { include: { criteria: { orderBy: { order: "asc" } } } } },
      },
    },
  });
  if (!submission) return;

  const text = submission.answerText ?? submission.ocrText ?? "";
  if (!text) return;

  await prisma.submission.update({ where: { id: submissionId }, data: { status: "AI_GRADING" } });

  try {
    const { assignment } = submission;
    const result = await gradeSubmission(
      assignment.question,
      assignment.modelAnswer,
      text,
      assignment.rubric.totalMarks,
      assignment.rubric.criteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        maxMarks: c.maxMarks,
      }))
    );

    await prisma.grade.create({
      data: {
        submissionId,
        aiScore: result.totalScore,
        finalScore: result.totalScore,
        aiFeedback: result.feedback,
        finalFeedback: result.feedback,
        confidence: result.confidence,
        needsReview: result.needsReview,
        criterionScores: {
          create: result.criteriaScores.map((cs) => ({
            criterionId: cs.criterionId,
            aiScore: cs.score,
            finalScore: cs.score,
            comment: cs.comment,
          })),
        },
      },
    });

    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "PENDING_REVIEW" },
    });
  } catch {
    await prisma.submission.update({ where: { id: submissionId }, data: { status: "SUBMITTED" } });
  }
}

export const submissionResolvers = {
  Query: {
    mySubmission: async (_: unknown, args: { assignmentId: string }, ctx: GQLContext) => {
      const userId = requireAuth(ctx);
      return prisma.submission.findUnique({
        where: { assignmentId_studentId: { assignmentId: args.assignmentId, studentId: userId } },
      });
    },

    mySubmissions: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireAuth(ctx);
      const submissions = await prisma.submission.findMany({
        where: { studentId: userId },
        include: {
          assignment: { include: { rubric: true } },
          grade: { include: { criterionScores: { include: { criterion: true } } } },
        },
        orderBy: { submittedAt: "desc" },
      });
      return submissions.map((s) => ({
        submissionId: s.id,
        assignmentId: s.assignmentId,
        assignmentTitle: s.assignment.title,
        subject: s.assignment.subject,
        maxMarks: s.assignment.rubric.totalMarks,
        submissionStatus: s.status,
        submittedAt: s.submittedAt,
        gradeStatus: s.grade?.status ?? null,
        aiScore: s.grade?.aiScore ?? null,
        finalScore: s.grade?.finalScore ?? null,
        aiFeedback: s.grade?.aiFeedback ?? null,
        finalFeedback: s.grade?.finalFeedback ?? null,
        criterionScores: (s.grade?.criterionScores ?? []).map((cs) => ({
          criterionName: cs.criterion.name,
          maxMarks: cs.criterion.maxMarks,
          finalScore: cs.finalScore ?? cs.aiScore ?? 0,
          comment: cs.comment,
        })),
      }));
    },
  },
  Mutation: {
    submitAnswer: async (
      _: unknown,
      args: { assignmentId: string; answerText: string },
      ctx: GQLContext
    ) => {
      const userId = requireAuth(ctx);

      // Enforce the faculty-controlled submission window
      const assignment = await prisma.assignment.findUnique({ where: { id: args.assignmentId } });
      if (!assignment) throw new Error("Assignment not found");
      if (!assignment.isActive || assignment.status === "DRAFT" || assignment.status === "ARCHIVED") {
        throw new Error("This assignment is not open for submissions");
      }
      const now = new Date();
      if (assignment.openDate && now < assignment.openDate) {
        throw new Error(`This assignment opens on ${assignment.openDate.toLocaleString("en-IN")}`);
      }
      if (assignment.dueDate && now > assignment.dueDate && !assignment.lateSubmissionPenalty) {
        throw new Error("The submission deadline set by your faculty has passed");
      }

      const existing = await prisma.submission.findUnique({
        where: { assignmentId_studentId: { assignmentId: args.assignmentId, studentId: userId } },
      });
      if (existing) throw new Error("Already submitted");

      const submission = await prisma.submission.create({
        data: {
          assignmentId: args.assignmentId,
          studentId: userId,
          answerText: args.answerText,
          status: "SUBMITTED",
        },
      });

      // Fire and forget — don't await so the response is instant
      runAIGrading(submission.id).catch(console.error);

      return submission;
    },
  },
};
