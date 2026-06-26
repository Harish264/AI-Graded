import { prisma } from "../../db";
import { requireAuth, GQLContext } from "../../context";
import { generatePracticeQuestions, generateLearningInsights, explainGrade, generateAssignmentOverview, reviewCode } from "../../services/ai.service";

// ── Achievements definition ─────────────────────────────────
const ACHIEVEMENT_DEFS = [
  { id: "first_submit", title: "First Step", description: "Submit your first assignment", icon: "🎯" },
  { id: "five_submits", title: "Consistent Learner", description: "Submit 5 assignments", icon: "📚" },
  { id: "ten_submits", title: "Dedicated Student", description: "Submit 10 assignments", icon: "🏆" },
  { id: "perfect_score", title: "Perfect Score", description: "Score 100% on an assignment", icon: "⭐" },
  { id: "above_90", title: "Excellence", description: "Score above 90% on any assignment", icon: "🌟" },
  { id: "five_graded", title: "Feedback Champion", description: "Receive grades on 5 assignments", icon: "✅" },
  { id: "above_avg", title: "Above Average", description: "Maintain 70%+ overall average", icon: "📈" },
  { id: "streak_3", title: "3-Week Streak", description: "Submit assignments 3 weeks in a row", icon: "🔥" },
];

function computeAchievements(
  submissions: { submittedAt: Date }[],
  graded: { finalScore: number | null; maxMarks: number }[]
) {
  const earned = new Set<string>();
  const totalSubs = submissions.length;
  const totalGraded = graded.length;
  const avgPct = totalGraded > 0
    ? graded.reduce((s, g) => s + (g.finalScore ?? 0) / g.maxMarks * 100, 0) / totalGraded
    : 0;
  const best = totalGraded > 0
    ? Math.max(...graded.map((g) => ((g.finalScore ?? 0) / g.maxMarks) * 100))
    : 0;

  if (totalSubs >= 1) earned.add("first_submit");
  if (totalSubs >= 5) earned.add("five_submits");
  if (totalSubs >= 10) earned.add("ten_submits");
  if (best >= 99) earned.add("perfect_score");
  if (best >= 90) earned.add("above_90");
  if (totalGraded >= 5) earned.add("five_graded");
  if (avgPct >= 70) earned.add("above_avg");

  // Streak: count weeks with at least 1 submission
  if (submissions.length >= 3) {
    const weeks = new Set(submissions.map((s) => {
      const d = new Date(s.submittedAt);
      const week = Math.floor(d.getTime() / (7 * 24 * 3600 * 1000));
      return week;
    }));
    const sortedWeeks = Array.from(weeks).sort((a, b) => a - b);
    let maxStreak = 1, cur = 1;
    for (let i = 1; i < sortedWeeks.length; i++) {
      if (sortedWeeks[i] - sortedWeeks[i - 1] === 1) { cur++; maxStreak = Math.max(maxStreak, cur); }
      else cur = 1;
    }
    if (maxStreak >= 3) earned.add("streak_3");
  }

  return ACHIEVEMENT_DEFS.map((def) => ({ ...def, earned: earned.has(def.id), earnedAt: null }));
}

function computeWeeklyStreak(submissions: { submittedAt: Date }[]) {
  if (!submissions.length) return 0;
  const weeks = new Set(submissions.map((s) => {
    const d = new Date(s.submittedAt);
    return Math.floor(d.getTime() / (7 * 24 * 3600 * 1000));
  }));
  const sorted = Array.from(weeks).sort((a, b) => b - a); // descending
  const currentWeek = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  if (!sorted.includes(currentWeek) && !sorted.includes(currentWeek - 1)) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] === 1) streak++;
    else break;
  }
  return streak;
}

export const studentResolvers = {
  Query: {
    studentDashboard: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireAuth(ctx);

      const submissions = await prisma.submission.findMany({
        where: { studentId: userId },
        include: {
          assignment: { include: { rubric: true } },
          grade: true,
        },
        orderBy: { submittedAt: "desc" },
      });

      const graded = submissions.filter((s) => s.grade?.status === "PUBLISHED" || s.grade?.status === "APPROVED");
      const pending = submissions.filter((s) => s.grade == null || (s.grade.status !== "PUBLISHED" && s.grade.status !== "APPROVED"));

      const avgPct = graded.length > 0
        ? graded.reduce((sum, s) => sum + ((s.grade?.finalScore ?? 0) / s.assignment.rubric.totalMarks) * 100, 0) / graded.length
        : null;

      const now = new Date();
      const oneWeekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

      const upcoming = await prisma.assignment.findMany({
        where: {
          isActive: true,
          dueDate: { gte: now, lte: oneWeekLater },
        },
        include: { rubric: true },
        orderBy: { dueDate: "asc" },
        take: 5,
      });

      const recentGraded = graded.slice(0, 5).map((s) => ({
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
        criterionScores: [],
      }));

      return {
        totalSubmissions: submissions.length,
        gradedCount: graded.length,
        pendingCount: pending.length,
        avgScorePercent: avgPct != null ? Math.round(avgPct * 10) / 10 : null,
        upcomingDeadlines: upcoming.map((a) => ({ ...a, submissionCount: 0, pendingReviewCount: 0 })),
        recentGrades: recentGraded,
        weeklyStreak: computeWeeklyStreak(submissions),
        achievementCount: computeAchievements(
          submissions,
          graded.map((s) => ({ finalScore: s.grade?.finalScore ?? null, maxMarks: s.assignment.rubric.totalMarks }))
        ).filter((a) => a.earned).length,
      };
    },

    studentNotifications: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireAuth(ctx);
      const notifications: {
        id: string; type: string; title: string; message: string; isRead: boolean; link: string | null; createdAt: Date;
      }[] = [];

      // New assignments published in last 7 days
      const newAssignments = await prisma.assignment.findMany({
        where: {
          isActive: true,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      for (const a of newAssignments) {
        notifications.push({
          id: `new_assignment_${a.id}`,
          type: "NEW_ASSIGNMENT",
          title: "New Assignment Available",
          message: `"${a.title}" has been published${a.subject ? ` for ${a.subject}` : ""}.`,
          isRead: false,
          link: `/student/assignment/${a.id}`,
          createdAt: a.createdAt,
        });
      }

      // Due soon (within 48h)
      const dueSoon = await prisma.assignment.findMany({
        where: {
          isActive: true,
          dueDate: { gte: new Date(), lte: new Date(Date.now() + 48 * 3600 * 1000) },
        },
        orderBy: { dueDate: "asc" },
      });
      for (const a of dueSoon) {
        // Check if student already submitted
        const sub = await prisma.submission.findUnique({
          where: { assignmentId_studentId: { assignmentId: a.id, studentId: userId } },
        });
        if (!sub) {
          const hoursLeft = Math.round((a.dueDate!.getTime() - Date.now()) / 3600000);
          notifications.push({
            id: `due_soon_${a.id}`,
            type: "DUE_SOON",
            title: "Assignment Due Soon",
            message: `"${a.title}" is due in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}!`,
            isRead: false,
            link: `/student/assignment/${a.id}`,
            createdAt: new Date(),
          });
        }
      }

      // Grades released
      const recentGrades = await prisma.grade.findMany({
        where: {
          submission: { studentId: userId },
          status: { in: ["PUBLISHED", "APPROVED"] },
          reviewedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
        },
        include: { submission: { include: { assignment: true } } },
        orderBy: { reviewedAt: "desc" },
        take: 10,
      });
      for (const g of recentGrades) {
        notifications.push({
          id: `grade_released_${g.id}`,
          type: "GRADE_RELEASED",
          title: "Grade Released",
          message: `Your grade for "${g.submission.assignment.title}" has been published${g.finalScore != null ? ` — ${g.finalScore} marks` : ""}.`,
          isRead: false,
          link: `/student/grades`,
          createdAt: g.reviewedAt ?? new Date(),
        });
      }

      return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    studentAnalytics: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireAuth(ctx);

      const submissions = await prisma.submission.findMany({
        where: { studentId: userId },
        include: {
          assignment: { include: { rubric: true } },
          grade: true,
        },
        orderBy: { submittedAt: "asc" },
      });

      const graded = submissions.filter((s) => s.grade?.status === "PUBLISHED" || s.grade?.status === "APPROVED");

      const avgPct = graded.length > 0
        ? graded.reduce((s, sub) => s + ((sub.grade?.finalScore ?? 0) / sub.assignment.rubric.totalMarks) * 100, 0) / graded.length
        : null;

      const best = graded.length > 0
        ? graded.reduce((b, s) => {
            const pct = ((s.grade?.finalScore ?? 0) / s.assignment.rubric.totalMarks) * 100;
            return pct > b.pct ? { pct, title: s.assignment.title } : b;
          }, { pct: 0, title: "" })
        : null;

      // Weekly scores - group by ISO week
      const weekMap = new Map<string, { total: number; max: number; count: number }>();
      for (const s of graded) {
        const d = new Date(s.submittedAt);
        const year = d.getFullYear();
        const week = Math.ceil((((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
        const key = `${year}-W${week.toString().padStart(2, "0")}`;
        const existing = weekMap.get(key) ?? { total: 0, max: 0, count: 0 };
        weekMap.set(key, {
          total: existing.total + (s.grade?.finalScore ?? 0),
          max: existing.max + s.assignment.rubric.totalMarks,
          count: existing.count + 1,
        });
      }

      const weeklyScores = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([week, v]) => ({
          week,
          avgPercent: Math.round((v.total / v.max) * 100),
          count: v.count,
        }));

      // Subject breakdown
      const subjectMap = new Map<string, { total: number; max: number; count: number }>();
      for (const s of graded) {
        const subj = s.assignment.subject ?? "General";
        const existing = subjectMap.get(subj) ?? { total: 0, max: 0, count: 0 };
        subjectMap.set(subj, {
          total: existing.total + (s.grade?.finalScore ?? 0),
          max: existing.max + s.assignment.rubric.totalMarks,
          count: existing.count + 1,
        });
      }

      return {
        avgScorePercent: avgPct != null ? Math.round(avgPct * 10) / 10 : null,
        bestScore: best?.pct ? Math.round(best.pct * 10) / 10 : null,
        bestAssignment: best?.title ?? null,
        totalSubmissions: submissions.length,
        gradedCount: graded.length,
        weeklyScores,
        subjectBreakdown: Array.from(subjectMap.entries()).map(([subject, v]) => ({
          subject,
          avgPercent: Math.round((v.total / v.max) * 100),
          count: v.count,
        })),
      };
    },

    learningInsights: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireAuth(ctx);

      const submissions = await prisma.submission.findMany({
        where: { studentId: userId },
        include: {
          assignment: true,
          grade: { include: { criterionScores: { include: { criterion: true } } } },
        },
      });

      const graded = submissions.filter((s) => s.grade?.status === "PUBLISHED" || s.grade?.status === "APPROVED");
      if (!graded.length) return [];

      const data = graded.map((s) => ({
        assignmentTitle: s.assignment.title,
        subject: s.assignment.subject,
        criterionScores: (s.grade?.criterionScores ?? []).map((cs) => ({
          name: cs.criterion.name,
          score: cs.finalScore ?? cs.aiScore ?? 0,
          maxMarks: cs.criterion.maxMarks,
          comment: cs.comment,
        })),
      }));

      return generateLearningInsights(data);
    },

    studentAchievements: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireAuth(ctx);

      const submissions = await prisma.submission.findMany({
        where: { studentId: userId },
        include: {
          assignment: { include: { rubric: true } },
          grade: true,
        },
      });

      const graded = submissions
        .filter((s) => s.grade?.status === "PUBLISHED" || s.grade?.status === "APPROVED")
        .map((s) => ({ finalScore: s.grade?.finalScore ?? null, maxMarks: s.assignment.rubric.totalMarks }));

      return computeAchievements(submissions, graded);
    },

    explainMyGrade: async (_: unknown, args: { submissionId: string }, ctx: GQLContext) => {
      const userId = requireAuth(ctx);

      const submission = await prisma.submission.findUnique({
        where: { id: args.submissionId },
        include: {
          assignment: true,
          grade: { include: { criterionScores: { include: { criterion: true } } } },
        },
      });

      if (!submission || submission.studentId !== userId) throw new Error("Not found");
      if (!submission.grade) throw new Error("Not graded yet");
      if (submission.grade.status !== "PUBLISHED" && submission.grade.status !== "APPROVED")
        throw new Error("Grade not published yet");

      const studentAnswer = submission.answerText ?? submission.ocrText ?? "";
      const criterionScores = submission.grade.criterionScores.map((cs) => ({
        criterionName: cs.criterion.name,
        maxMarks: cs.criterion.maxMarks,
        aiScore: cs.finalScore ?? cs.aiScore ?? 0,
        comment: cs.comment,
      }));

      return explainGrade(
        submission.assignment.question,
        submission.assignment.modelAnswer,
        studentAnswer,
        criterionScores
      );
    },

    assignmentOverview: async (_: unknown, args: { assignmentId: string }, ctx: GQLContext) => {
      requireAuth(ctx);
      const assignment = await prisma.assignment.findUnique({
        where: { id: args.assignmentId },
        include: { rubric: { include: { criteria: true } } },
      });
      if (!assignment) throw new Error("Assignment not found");
      return generateAssignmentOverview(
        assignment.title,
        assignment.question,
        assignment.modelAnswer,
        assignment.rubric.criteria.map((c) => ({ name: c.name, maxMarks: c.maxMarks }))
      );
    },
  },

  Mutation: {
    generatePracticeQuestions: async (
      _: unknown,
      args: { topic: string; subject?: string; difficulty?: string; count?: number },
      ctx: GQLContext
    ) => {
      requireAuth(ctx);
      return generatePracticeQuestions(
        args.topic,
        args.subject ?? args.topic,
        args.difficulty ?? "Mixed",
        args.count ?? 5
      );
    },

    reviewCode: async (
      _: unknown,
      args: { assignmentId: string; code: string; language: string },
      ctx: GQLContext
    ) => {
      requireAuth(ctx);
      const assignment = await prisma.assignment.findUnique({ where: { id: args.assignmentId } });
      if (!assignment) throw new Error("Assignment not found");
      return reviewCode(assignment.question, args.code, args.language);
    },
  },
};
