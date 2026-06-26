import { prisma } from "../../db";
import { requireRole, GQLContext } from "../../context";
import { analyzeTopMissedConcepts } from "../../services/ai.service";

const FACULTY_ROLES = ["FACULTY", "HOD", "ADMIN"];

export const analyticsResolvers = {
  Query: {
    dashboardStats: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);
      const assignments = await prisma.assignment.findMany({ where: { createdById: userId }, select: { id: true } });
      const ids = assignments.map((a) => a.id);

      const [totalSubmissions, pendingReview, published, drafts, active] = await Promise.all([
        prisma.submission.count({ where: { assignmentId: { in: ids } } }),
        prisma.grade.count({ where: { submission: { assignmentId: { in: ids } }, status: "AI_DRAFT" } }),
        prisma.grade.count({ where: { submission: { assignmentId: { in: ids } }, status: "PUBLISHED" } }),
        prisma.assignment.count({ where: { createdById: userId, status: "DRAFT" } }),
        prisma.assignment.count({ where: { createdById: userId, status: "ACTIVE" } }),
      ]);

      return { totalAssignments: ids.length, totalSubmissions, pendingReview, published, drafts, active };
    },

    assignmentAnalytics: async (_: unknown, args: { assignmentId: string }, ctx: GQLContext) => {
      requireRole(ctx, ...FACULTY_ROLES);
      const assignment = await prisma.assignment.findUnique({
        where: { id: args.assignmentId },
        include: { rubric: { include: { criteria: true } } },
      });
      if (!assignment) throw new Error("Not found");

      const totalSubmissions = await prisma.submission.count({ where: { assignmentId: args.assignmentId } });

      const grades = await prisma.grade.findMany({
        where: {
          submission: { assignmentId: args.assignmentId },
          status: { in: ["APPROVED", "OVERRIDDEN", "PUBLISHED"] },
        },
        include: { criterionScores: true },
      });

      const scores = grades.map((g) => g.finalScore ?? 0);
      const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const maxMarks = assignment.rubric.totalMarks;
      const highestScore = scores.length ? Math.max(...scores) : null;
      const lowestScore = scores.length ? Math.min(...scores) : null;
      const passThreshold = maxMarks * 0.4;
      const passCount = scores.filter((s) => s >= passThreshold).length;
      const passRate = scores.length ? (passCount / scores.length) * 100 : null;
      const completionRate = totalSubmissions > 0 ? (grades.length / totalSubmissions) * 100 : null;

      const bands = [
        [0, 40, "< 40%"],
        [40, 60, "40–60%"],
        [60, 75, "60–75%"],
        [75, 90, "75–90%"],
        [90, 101, "> 90%"],
      ] as [number, number, string][];

      const scoreDistribution = bands.map(([lo, hi, label]) => ({
        range: label,
        count: scores.filter((s) => s >= (maxMarks * lo) / 100 && s < (maxMarks * hi) / 100).length,
      }));

      const criterionHeatmap = await Promise.all(
        assignment.rubric.criteria.map(async (c) => {
          const scoreRows = await prisma.gradeCriterionScore.findMany({
            where: { criterionId: c.id, grade: { submission: { assignmentId: args.assignmentId } } },
          });
          const avg = scoreRows.length
            ? scoreRows.reduce((s, r) => s + (r.finalScore ?? 0), 0) / scoreRows.length
            : 0;
          return {
            criterion: c.name,
            avgScore: Math.round(avg * 100) / 100,
            maxMarks: c.maxMarks,
            percent: Math.round((avg / c.maxMarks) * 1000) / 10,
          };
        })
      );

      // AI–human agreement (within ±1 mark)
      const compared = grades.filter((g) => g.aiScore != null);
      const agreed = compared.filter((g) => Math.abs((g.aiScore ?? 0) - (g.finalScore ?? 0)) <= 1);
      const aiHumanAgreementPct =
        compared.length ? Math.round((agreed.length / compared.length) * 1000) / 10 : null;

      // Difficulty estimate based on pass rate
      let difficultyLevel: string | null = null;
      if (passRate !== null) {
        if (passRate >= 80) difficultyLevel = "Easy";
        else if (passRate >= 50) difficultyLevel = "Medium";
        else difficultyLevel = "Hard";
      }

      return {
        totalSubmissions,
        gradedCount: grades.length,
        avgScore: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
        maxMarks,
        highestScore,
        lowestScore,
        passRate: passRate != null ? Math.round(passRate * 10) / 10 : null,
        completionRate: completionRate != null ? Math.round(completionRate * 10) / 10 : null,
        scoreDistribution,
        criterionHeatmap,
        aiHumanAgreementPct,
        difficultyLevel,
      };
    },

    performanceTrends: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);

      const assignments = await prisma.assignment.findMany({
        where: { createdById: userId },
        orderBy: { createdAt: "asc" },
        include: { rubric: true },
      });

      const trends = await Promise.all(
        assignments.map(async (a) => {
          const grades = await prisma.grade.findMany({
            where: {
              submission: { assignmentId: a.id },
              status: { in: ["APPROVED", "OVERRIDDEN", "PUBLISHED"] },
            },
          });

          const scores = grades.map((g) => g.finalScore ?? 0);
          const avg = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : 0;
          const avgPercent = a.rubric.totalMarks > 0 ? Math.round((avg / a.rubric.totalMarks) * 1000) / 10 : 0;
          const passCount = scores.filter((s) => s >= a.rubric.totalMarks * 0.4).length;
          const passRate = scores.length ? Math.round((passCount / scores.length) * 1000) / 10 : 0;

          return {
            assignmentId: a.id,
            assignmentTitle: a.title,
            subject: a.subject,
            avgScorePercent: avgPercent,
            passRate,
            gradedCount: grades.length,
            createdAt: a.createdAt,
          };
        })
      );

      return trends.filter((t) => t.gradedCount > 0);
    },

    topMissedConcepts: async (_: unknown, args: { assignmentId: string }, ctx: GQLContext) => {
      requireRole(ctx, ...FACULTY_ROLES);

      const assignment = await prisma.assignment.findUnique({
        where: { id: args.assignmentId },
        include: { rubric: { include: { criteria: true } } },
      });
      if (!assignment) throw new Error("Assignment not found");

      const totalSubmissions = await prisma.submission.count({ where: { assignmentId: args.assignmentId } });
      if (totalSubmissions === 0) return [];

      const criterionHeatmap = await Promise.all(
        assignment.rubric.criteria.map(async (c) => {
          const scoreRows = await prisma.gradeCriterionScore.findMany({
            where: { criterionId: c.id, grade: { submission: { assignmentId: args.assignmentId } } },
          });
          const avg = scoreRows.length
            ? scoreRows.reduce((s, r) => s + (r.finalScore ?? 0), 0) / scoreRows.length
            : 0;
          return {
            criterion: c.name,
            avgScore: avg,
            maxMarks: c.maxMarks,
            percent: c.maxMarks > 0 ? Math.round((avg / c.maxMarks) * 1000) / 10 : 0,
          };
        })
      );

      return analyzeTopMissedConcepts(
        assignment.question,
        assignment.modelAnswer,
        criterionHeatmap,
        totalSubmissions
      );
    },

    notifications: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);

      const assignments = await prisma.assignment.findMany({
        where: { createdById: userId },
        select: { id: true, title: true, dueDate: true },
      });
      const ids = assignments.map((a) => a.id);

      const [newSubmissions, pendingReviews] = await Promise.all([
        prisma.submission.findMany({
          where: { assignmentId: { in: ids }, status: "PENDING_REVIEW" },
          include: { student: true, assignment: true },
          orderBy: { submittedAt: "desc" },
          take: 10,
        }),
        prisma.grade.findMany({
          where: { submission: { assignmentId: { in: ids } }, status: "AI_DRAFT" },
          include: { submission: { include: { assignment: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

      const now = new Date();
      const notifications: {
        id: string; type: string; title: string; message: string;
        isRead: boolean; link: string | null; createdAt: Date;
      }[] = [];

      // New submissions
      for (const sub of newSubmissions) {
        notifications.push({
          id: `sub-${sub.id}`,
          type: "new_submission",
          title: "New Submission",
          message: `${sub.student.fullName} submitted "${sub.assignment.title}"`,
          isRead: false,
          link: `/grading/${sub.id}`,
          createdAt: sub.submittedAt,
        });
      }

      // Pending reviews
      for (const g of pendingReviews) {
        notifications.push({
          id: `grade-${g.id}`,
          type: "pending_review",
          title: "Pending Review",
          message: `AI graded "${g.submission.assignment.title}" — awaiting your review`,
          isRead: false,
          link: `/grading/${g.submissionId}`,
          createdAt: g.createdAt,
        });
      }

      // Upcoming deadlines (within 48 hours)
      for (const a of assignments) {
        if (a.dueDate && a.dueDate > now) {
          const hoursLeft = (a.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hoursLeft <= 48) {
            notifications.push({
              id: `deadline-${a.id}`,
              type: "deadline",
              title: "Upcoming Deadline",
              message: `"${a.title}" closes in ${Math.round(hoursLeft)} hours`,
              isRead: false,
              link: `/assignments/${a.id}`,
              createdAt: now,
            });
          }
        }
      }

      return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);
    },

    activityLog: async (_: unknown, args: { limit?: number }, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...FACULTY_ROLES);

      const logs = await prisma.auditLog.findMany({
        where: { actorId: userId },
        include: { grade: { include: { submission: { include: { assignment: true } } } } },
        orderBy: { timestamp: "desc" },
        take: args.limit ?? 50,
      });

      return logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: "submission",
        entityTitle: l.grade?.submission?.assignment?.title ?? "Unknown",
        aiScore: l.aiScore,
        humanScore: l.humanScore,
        note: l.note,
        timestamp: l.timestamp,
      }));
    },
  },
};
