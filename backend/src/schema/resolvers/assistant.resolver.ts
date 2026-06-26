import { prisma } from "../../db";
import { requireAuth, GQLContext } from "../../context";
import {
  studentChatWithProvider,
  facultyChatWithProvider,
  ChatProvider,
} from "../../services/chat.service";

const FACULTY_ROLES = ["FACULTY", "HOD", "ADMIN"];

const DEFAULT_PROVIDER: ChatProvider = "groq";

interface ChatHistoryItem { role: string; content: string }
interface ChatInput {
  message: string;
  history?: ChatHistoryItem[];
  pageContext?: string;
  provider?: string;
}

function resolveProvider(raw?: string): ChatProvider {
  const lower = raw?.toLowerCase();
  if (lower === "openrouter" || lower === "huggingface" || lower === "groq") return lower;
  return DEFAULT_PROVIDER;
}

export const assistantResolvers = {
  Mutation: {
    askAssistant: async (_: unknown, args: { input: ChatInput }, ctx: GQLContext) => {
      const userId = requireAuth(ctx);
      const { message, history = [], pageContext = "", provider: rawProvider } = args.input;
      const provider = resolveProvider(rawProvider);

      const isFaculty = FACULTY_ROLES.includes(ctx.role ?? "");

      if (isFaculty) {
        const [assignments, rubrics, stats] = await Promise.all([
          prisma.assignment.findMany({
            where: { createdById: userId },
            include: { rubric: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          }),
          prisma.rubric.findMany({
            where: { createdById: userId },
            include: { _count: { select: { criteria: true } } },
            take: 10,
          }),
          (async () => {
            const myAssignments = await prisma.assignment.findMany({
              where: { createdById: userId },
              select: { id: true },
            });
            const ids = myAssignments.map((a) => a.id);
            const [totalSubmissions, pendingReview, published] = await Promise.all([
              prisma.submission.count({ where: { assignmentId: { in: ids } } }),
              prisma.grade.count({ where: { submission: { assignmentId: { in: ids } }, status: "AI_DRAFT" } }),
              prisma.grade.count({ where: { submission: { assignmentId: { in: ids } }, status: "PUBLISHED" } }),
            ]);
            return { totalSubmissions, pendingReview, published };
          })(),
        ]);

        const assignmentsWithStats = await Promise.all(
          assignments.map(async (a) => {
            const grades = await prisma.grade.findMany({
              where: { submission: { assignmentId: a.id }, status: { in: ["APPROVED", "OVERRIDDEN", "PUBLISHED"] } },
            });
            const scores = grades.map((g) => g.finalScore ?? 0);
            const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : null;
            const subCount = await prisma.submission.count({ where: { assignmentId: a.id } });
            const pendingCount = await prisma.grade.count({ where: { submission: { assignmentId: a.id }, status: "AI_DRAFT" } });
            return {
              id: a.id, title: a.title, status: a.status, subject: a.subject,
              submissionCount: subCount, pendingReviewCount: pendingCount,
              avgScore: avg != null ? Math.round(avg * 10) / 10 : null,
              maxMarks: a.rubric.totalMarks,
            };
          })
        );

        const facultyCtx = {
          totalAssignments: assignments.length,
          activeAssignments: assignments.filter((a) => a.status === "ACTIVE").length,
          drafts: assignments.filter((a) => a.status === "DRAFT").length,
          totalSubmissions: stats.totalSubmissions,
          pendingReview: stats.pendingReview,
          published: stats.published,
          assignments: assignmentsWithStats,
          rubrics: rubrics.map((r) => ({
            name: r.name, totalMarks: r.totalMarks, criteriaCount: r._count.criteria,
          })),
        };

        return facultyChatWithProvider(message, history, facultyCtx, pageContext, provider);

      } else {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        const submissions = await prisma.submission.findMany({
          where: { studentId: userId },
          include: {
            assignment: { include: { rubric: { include: { criteria: true } } } },
            grade: { include: { criterionScores: { include: { criterion: true } } } },
          },
          orderBy: { submittedAt: "desc" },
        });

        const studentCtx = {
          studentName: user?.fullName ?? "Student",
          submissions: submissions.map((s) => ({
            assignmentTitle: s.assignment.title,
            subject: s.assignment.subject,
            status: s.status,
            aiScore: s.grade?.aiScore ?? null,
            finalScore: s.grade?.finalScore ?? null,
            maxMarks: s.assignment.rubric.totalMarks,
            aiFeedback: s.grade?.finalFeedback ?? s.grade?.aiFeedback ?? null,
            submittedAt: s.submittedAt.toISOString(),
            criterionScores: (s.grade?.criterionScores ?? []).map((cs) => ({
              name: cs.criterion.name,
              score: cs.finalScore ?? cs.aiScore ?? 0,
              maxMarks: cs.criterion.maxMarks,
              comment: cs.comment,
            })),
          })),
        };

        return studentChatWithProvider(message, history, studentCtx, pageContext, provider);
      }
    },
  },
};
