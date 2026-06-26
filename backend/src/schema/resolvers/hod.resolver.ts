import { prisma } from "../../db";
import { requireRole, GQLContext } from "../../context";
import {
  hodAssistant, facultyAllocationAdvice, atRiskAnalysis,
  generateQuestionPaper, validateBlooms, generateCOPOMapping,
  accreditationGapAnalysis, placementReadiness, DepartmentContext,
} from "../../services/hod.ai.service";

const HOD_ROLES = ["HOD", "ADMIN"];
const GRADED = ["APPROVED", "OVERRIDDEN", "PUBLISHED"] as const;
const AT_RISK_THRESHOLD = 40; // percent

// ── Resolve the HOD's department ─────────────────────────────
async function hodDepartment(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.department ?? "";
}

interface DeptData {
  department: string;
  faculty: { id: string; fullName: string; email: string }[];
  students: { id: string; fullName: string; email: string }[];
  facultyIds: string[];
  assignmentCount: number;
  submissionCount: number;
  gradedScores: { pct: number }[];
  subjectPerformance: { subject: string; avgPercent: number; passRate: number; submissions: number; assignments: number }[];
  pendingReviews: number;
}

// ── Aggregate all department data once ───────────────────────
async function loadDeptData(userId: string): Promise<DeptData> {
  const department = await hodDepartment(userId);

  const [faculty, students] = await Promise.all([
    prisma.user.findMany({
      where: { department, role: { in: ["FACULTY", "HOD"] } },
      select: { id: true, fullName: true, email: true },
    }),
    prisma.user.findMany({
      where: { department, role: "STUDENT" },
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  const facultyIds = faculty.map((f) => f.id);

  const assignments = await prisma.assignment.findMany({
    where: { createdById: { in: facultyIds } },
    include: { rubric: { select: { totalMarks: true } } },
  });
  const assignmentIds = assignments.map((a) => a.id);

  const [submissionCount, pendingReviews, grades] = await Promise.all([
    prisma.submission.count({ where: { assignmentId: { in: assignmentIds } } }),
    prisma.grade.count({ where: { submission: { assignmentId: { in: assignmentIds } }, status: "AI_DRAFT" } }),
    prisma.grade.findMany({
      where: { submission: { assignmentId: { in: assignmentIds } }, status: { in: [...GRADED] } },
      include: { submission: { select: { assignmentId: true } } },
    }),
  ]);

  // assignment -> {maxMarks, subject}
  const aMeta = new Map(assignments.map((a) => [a.id, { max: a.rubric.totalMarks, subject: a.subject ?? "General" }]));

  const gradedScores = grades.map((g) => {
    const meta = aMeta.get(g.submission.assignmentId);
    const max = meta?.max ?? 1;
    return { pct: ((g.finalScore ?? 0) / max) * 100 };
  });

  // Subject performance
  const subjMap = new Map<string, { total: number; count: number; pass: number; assignments: Set<string> }>();
  for (const g of grades) {
    const meta = aMeta.get(g.submission.assignmentId);
    if (!meta) continue;
    const pct = ((g.finalScore ?? 0) / meta.max) * 100;
    const e = subjMap.get(meta.subject) ?? { total: 0, count: 0, pass: 0, assignments: new Set<string>() };
    e.total += pct; e.count += 1; if (pct >= AT_RISK_THRESHOLD) e.pass += 1;
    e.assignments.add(g.submission.assignmentId);
    subjMap.set(meta.subject, e);
  }
  const subjectPerformance = Array.from(subjMap.entries()).map(([subject, v]) => ({
    subject,
    avgPercent: Math.round(v.total / v.count),
    passRate: Math.round((v.pass / v.count) * 100),
    submissions: v.count,
    assignments: v.assignments.size,
  })).sort((a, b) => b.submissions - a.submissions);

  return {
    department, faculty, students, facultyIds,
    assignmentCount: assignments.length, submissionCount, gradedScores,
    subjectPerformance, pendingReviews,
  };
}

// ── Per-student performance ──────────────────────────────────
async function loadStudentPerformance(d: DeptData) {
  const studentIds = d.students.map((s) => s.id);
  if (!studentIds.length) return [];

  const subs = await prisma.submission.findMany({
    where: { studentId: { in: studentIds } },
    include: {
      assignment: { include: { rubric: { select: { totalMarks: true } } } },
      grade: { select: { finalScore: true, status: true, createdAt: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const byStudent = new Map<string, { pct: number; at: number }[]>();
  for (const s of subs) {
    if (!s.grade || !GRADED.includes(s.grade.status as typeof GRADED[number])) continue;
    const max = s.assignment.rubric.totalMarks || 1;
    const pct = ((s.grade.finalScore ?? 0) / max) * 100;
    const arr = byStudent.get(s.studentId) ?? [];
    arr.push({ pct, at: s.submittedAt.getTime() });
    byStudent.set(s.studentId, arr);
  }

  return d.students.map((stu) => {
    const scores = byStudent.get(stu.id) ?? [];
    const avg = scores.length ? scores.reduce((a, b) => a + b.pct, 0) / scores.length : null;
    // trend: compare first half vs second half
    let trend = "stable";
    if (scores.length >= 2) {
      const mid = Math.floor(scores.length / 2);
      const firstAvg = scores.slice(0, mid).reduce((a, b) => a + b.pct, 0) / Math.max(1, mid);
      const lastAvg = scores.slice(mid).reduce((a, b) => a + b.pct, 0) / Math.max(1, scores.length - mid);
      if (lastAvg - firstAvg > 8) trend = "improving";
      else if (firstAvg - lastAvg > 8) trend = "declining";
    }
    return {
      id: stu.id, name: stu.fullName, email: stu.email,
      submissions: scores.length,
      avgScorePercent: avg != null ? Math.round(avg * 10) / 10 : null,
      atRisk: avg != null && avg < AT_RISK_THRESHOLD,
      trend,
    };
  });
}

function buildAIContext(d: DeptData, atRiskCount: number, facultyWorkload: { name: string; assignments: number; pendingReviews: number; avgScore: number | null }[]): DepartmentContext {
  const avg = d.gradedScores.length ? d.gradedScores.reduce((a, b) => a + b.pct, 0) / d.gradedScores.length : null;
  const pass = d.gradedScores.length ? (d.gradedScores.filter((s) => s.pct >= AT_RISK_THRESHOLD).length / d.gradedScores.length) * 100 : null;
  return {
    department: d.department || "Department",
    facultyCount: d.faculty.length,
    studentCount: d.students.length,
    assignmentCount: d.assignmentCount,
    submissionCount: d.submissionCount,
    avgScorePercent: avg != null ? Math.round(avg) : null,
    passRatePercent: pass != null ? Math.round(pass) : null,
    pendingReviews: d.pendingReviews,
    atRiskStudentCount: atRiskCount,
    facultyWorkload,
    subjectPerformance: d.subjectPerformance,
  };
}

async function facultyWorkloadData(d: DeptData) {
  const rows = await Promise.all(d.faculty.map(async (f) => {
    const assignments = await prisma.assignment.findMany({
      where: { createdById: f.id },
      include: { rubric: { select: { totalMarks: true } } },
    });
    const ids = assignments.map((a) => a.id);
    const [submissions, graded, pending, grades] = await Promise.all([
      prisma.submission.count({ where: { assignmentId: { in: ids } } }),
      prisma.grade.count({ where: { submission: { assignmentId: { in: ids } }, status: { in: [...GRADED] } } }),
      prisma.grade.count({ where: { submission: { assignmentId: { in: ids } }, status: "AI_DRAFT" } }),
      prisma.grade.findMany({
        where: { submission: { assignmentId: { in: ids } }, status: { in: [...GRADED] } },
        include: { submission: { select: { assignmentId: true } } },
      }),
    ]);
    const aMax = new Map(assignments.map((a) => [a.id, a.rubric.totalMarks]));
    const pcts = grades.map((g) => ((g.finalScore ?? 0) / (aMax.get(g.submission.assignmentId) || 1)) * 100);
    const avg = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : null;
    return {
      id: f.id, name: f.fullName, email: f.email,
      assignments: assignments.length, submissions, graded, pendingReviews: pending,
      avgScorePercent: avg,
    };
  }));
  return rows.sort((a, b) => b.assignments - a.assignments);
}

export const hodResolvers = {
  Query: {
    hodDashboard: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...HOD_ROLES);
      const d = await loadDeptData(userId);
      const avg = d.gradedScores.length ? d.gradedScores.reduce((a, b) => a + b.pct, 0) / d.gradedScores.length : null;
      const pass = d.gradedScores.length ? (d.gradedScores.filter((s) => s.pct >= AT_RISK_THRESHOLD).length / d.gradedScores.length) * 100 : null;

      const students = await loadStudentPerformance(d);
      const atRiskCount = students.filter((s) => s.atRisk).length;

      // Pass trend by week from graded submissions
      const subs = await prisma.submission.findMany({
        where: { assignmentId: { in: (await prisma.assignment.findMany({ where: { createdById: { in: d.facultyIds } }, select: { id: true } })).map((a) => a.id) } },
        include: { assignment: { include: { rubric: { select: { totalMarks: true } } } }, grade: { select: { finalScore: true, status: true } } },
        orderBy: { submittedAt: "asc" },
      });
      const weekMap = new Map<string, { total: number; max: number; count: number }>();
      for (const s of subs) {
        if (!s.grade || !GRADED.includes(s.grade.status as typeof GRADED[number])) continue;
        const dt = new Date(s.submittedAt);
        const yr = dt.getFullYear();
        const wk = Math.ceil((((dt.getTime() - new Date(yr, 0, 1).getTime()) / 86400000) + new Date(yr, 0, 1).getDay() + 1) / 7);
        const key = `${yr}-W${String(wk).padStart(2, "0")}`;
        const e = weekMap.get(key) ?? { total: 0, max: 0, count: 0 };
        e.total += s.grade.finalScore ?? 0; e.max += s.assignment.rubric.totalMarks; e.count += 1;
        weekMap.set(key, e);
      }
      const passTrend = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
        .map(([week, v]) => ({ week, avgPercent: Math.round((v.total / v.max) * 100), count: v.count }));

      return {
        department: d.department || "Department",
        facultyCount: d.faculty.length,
        studentCount: d.students.length,
        assignmentCount: d.assignmentCount,
        submissionCount: d.submissionCount,
        avgScorePercent: avg != null ? Math.round(avg * 10) / 10 : null,
        passRatePercent: pass != null ? Math.round(pass * 10) / 10 : null,
        pendingReviews: d.pendingReviews,
        atRiskStudentCount: atRiskCount,
        subjectPerformance: d.subjectPerformance,
        passTrend,
      };
    },

    hodFacultyWorkload: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...HOD_ROLES);
      const d = await loadDeptData(userId);
      return facultyWorkloadData(d);
    },

    hodDepartmentStudents: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...HOD_ROLES);
      const d = await loadDeptData(userId);
      return loadStudentPerformance(d);
    },

    hodAtRiskStudents: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...HOD_ROLES);
      const d = await loadDeptData(userId);
      const students = await loadStudentPerformance(d);
      return students.filter((s) => s.atRisk || s.trend === "declining");
    },
  },

  Mutation: {
    hodAssistant: async (_: unknown, args: { query: string }, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...HOD_ROLES);
      const d = await loadDeptData(userId);
      const wl = await facultyWorkloadData(d);
      const students = await loadStudentPerformance(d);
      const atRiskCount = students.filter((s) => s.atRisk).length;
      const aiCtx = buildAIContext(d, atRiskCount, wl.map((f) => ({ name: f.name, assignments: f.assignments, pendingReviews: f.pendingReviews, avgScore: f.avgScorePercent })));
      return hodAssistant(args.query, aiCtx);
    },

    hodFacultyAllocation: async (_: unknown, args: { subjects: string[] }, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...HOD_ROLES);
      const d = await loadDeptData(userId);
      const wl = await facultyWorkloadData(d);
      const students = await loadStudentPerformance(d);
      const aiCtx = buildAIContext(d, students.filter((s) => s.atRisk).length, wl.map((f) => ({ name: f.name, assignments: f.assignments, pendingReviews: f.pendingReviews, avgScore: f.avgScorePercent })));
      return facultyAllocationAdvice(aiCtx, args.subjects);
    },

    hodAtRiskAnalysis: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...HOD_ROLES);
      const d = await loadDeptData(userId);
      const students = await loadStudentPerformance(d);
      const atRisk = students.filter((s) => s.atRisk || s.trend === "declining");
      return atRiskAnalysis(atRisk.map((s) => ({
        name: s.name,
        avgPercent: s.avgScorePercent ?? 0,
        submissions: s.submissions,
        trend: s.trend,
        weakSubjects: [],
      })));
    },

    hodGenerateQuestionPaper: async (_: unknown, args: { subject: string; topics: string; totalMarks: number; questionCount: number; examType: string }, ctx: GQLContext) => {
      requireRole(ctx, ...HOD_ROLES);
      return generateQuestionPaper(args.subject, args.topics, args.totalMarks, args.questionCount, args.examType);
    },

    hodValidateBlooms: async (_: unknown, args: { questions: { text: string; marks: number }[] }, ctx: GQLContext) => {
      requireRole(ctx, ...HOD_ROLES);
      return validateBlooms(args.questions);
    },

    hodGenerateCOPO: async (_: unknown, args: { subject: string; topics: string }, ctx: GQLContext) => {
      requireRole(ctx, ...HOD_ROLES);
      return generateCOPOMapping(args.subject, args.topics);
    },

    hodAccreditationAnalysis: async (_: unknown, args: { framework: string }, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...HOD_ROLES);
      const d = await loadDeptData(userId);
      const wl = await facultyWorkloadData(d);
      const students = await loadStudentPerformance(d);
      const aiCtx = buildAIContext(d, students.filter((s) => s.atRisk).length, wl.map((f) => ({ name: f.name, assignments: f.assignments, pendingReviews: f.pendingReviews, avgScore: f.avgScorePercent })));
      return accreditationGapAnalysis(args.framework, aiCtx);
    },

    hodPlacementReadiness: async (_: unknown, __: unknown, ctx: GQLContext) => {
      const userId = requireRole(ctx, ...HOD_ROLES);
      const d = await loadDeptData(userId);
      const wl = await facultyWorkloadData(d);
      const students = await loadStudentPerformance(d);
      const aiCtx = buildAIContext(d, students.filter((s) => s.atRisk).length, wl.map((f) => ({ name: f.name, assignments: f.assignments, pendingReviews: f.pendingReviews, avgScore: f.avgScorePercent })));
      return placementReadiness(aiCtx, students.filter((s) => s.avgScorePercent != null).map((s) => ({ name: s.name, avgPercent: s.avgScorePercent! })));
    },
  },
};
