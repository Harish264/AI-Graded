import { callWithFallback } from "./ai.service";

function stripCodeFence(raw: string): string {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : raw.trim();
}

async function generateJSON(prompt: string): Promise<unknown> {
  const messages = [
    { role: "system" as const, content: "You are a precise AI assistant. Always respond with only valid JSON when instructed. Never wrap JSON in markdown code blocks." },
    { role: "user" as const, content: prompt },
  ];
  const raw = await callWithFallback(messages, 4096);
  return JSON.parse(stripCodeFence(raw));
}

// ─── Standard HOD structured output ──────────────────────────
export interface HODAdvice {
  summary: string;
  recommendations: string[];
  risks: string[];
  actionItems: string[];
  priority: "High" | "Medium" | "Low";
}

const HOD_PERSONA = `You are an experienced Head of Department with 20+ years of academic and administrative experience at an Indian engineering college. You base recommendations strictly on the data provided, prioritize academic quality, ensure fairness and transparency, provide actionable insights, highlight risks with mitigation, and always explain your reasoning.`;

const HOD_OUTPUT_SPEC = `Return ONLY valid JSON in this exact shape:
{
  "summary": "<2-4 sentence professional summary explaining your reasoning>",
  "recommendations": ["<specific actionable recommendation>", ...],
  "risks": ["<identified risk + brief mitigation>", ...],
  "actionItems": ["<concrete next step with owner if relevant>", ...],
  "priority": "High" | "Medium" | "Low"
}`;

// ─── 1. Natural-language HOD assistant ───────────────────────
export interface DepartmentContext {
  department: string;
  facultyCount: number;
  studentCount: number;
  assignmentCount: number;
  submissionCount: number;
  avgScorePercent: number | null;
  passRatePercent: number | null;
  pendingReviews: number;
  atRiskStudentCount: number;
  facultyWorkload: { name: string; assignments: number; pendingReviews: number; avgScore: number | null }[];
  subjectPerformance: { subject: string; avgPercent: number; passRate: number; submissions: number }[];
}

function ctxToText(ctx: DepartmentContext): string {
  return `DEPARTMENT: ${ctx.department}
Faculty: ${ctx.facultyCount} | Students: ${ctx.studentCount}
Assignments: ${ctx.assignmentCount} | Submissions: ${ctx.submissionCount}
Department avg score: ${ctx.avgScorePercent != null ? ctx.avgScorePercent + "%" : "n/a"} | Pass rate: ${ctx.passRatePercent != null ? ctx.passRatePercent + "%" : "n/a"}
Pending grade reviews: ${ctx.pendingReviews} | At-risk students: ${ctx.atRiskStudentCount}

FACULTY WORKLOAD:
${ctx.facultyWorkload.map((f) => `- ${f.name}: ${f.assignments} assignments, ${f.pendingReviews} pending reviews, avg score ${f.avgScore != null ? f.avgScore + "%" : "n/a"}`).join("\n") || "  none"}

SUBJECT PERFORMANCE:
${ctx.subjectPerformance.map((s) => `- ${s.subject}: avg ${s.avgPercent}%, pass ${s.passRate}%, ${s.submissions} submissions`).join("\n") || "  none"}`;
}

export async function hodAssistant(query: string, ctx: DepartmentContext): Promise<HODAdvice> {
  const prompt = `${HOD_PERSONA}

CURRENT DEPARTMENT DATA:
${ctxToText(ctx)}

HOD QUERY: "${query}"

Answer the query using ONLY the data above. ${HOD_OUTPUT_SPEC}`;
  const raw = (await generateJSON(prompt)) as Partial<HODAdvice>;
  return normalizeAdvice(raw);
}

// ─── 2. Faculty subject-allocation recommendation ───────────
export async function facultyAllocationAdvice(
  ctx: DepartmentContext,
  subjects: string[]
): Promise<HODAdvice> {
  const prompt = `${HOD_PERSONA}

Recommend how to allocate the upcoming subjects across faculty for a balanced, high-quality workload. Consider current workload, pending reviews, and demonstrated performance.

${ctxToText(ctx)}

SUBJECTS TO ALLOCATE: ${subjects.join(", ") || "(infer from subject performance above)"}

${HOD_OUTPUT_SPEC}`;
  return normalizeAdvice((await generateJSON(prompt)) as Partial<HODAdvice>);
}

// ─── 3. At-risk student analysis ────────────────────────────
export async function atRiskAnalysis(
  students: { name: string; avgPercent: number; submissions: number; trend: string; weakSubjects: string[] }[]
): Promise<HODAdvice> {
  const prompt = `${HOD_PERSONA}

Analyze these academically at-risk students and produce an intervention plan.

AT-RISK STUDENTS:
${students.map((s) => `- ${s.name}: avg ${s.avgPercent}%, ${s.submissions} submissions, trend ${s.trend}, weak in ${s.weakSubjects.join("/") || "n/a"}`).join("\n") || "  none"}

${HOD_OUTPUT_SPEC}`;
  return normalizeAdvice((await generateJSON(prompt)) as Partial<HODAdvice>);
}

// ─── 4. Question paper generation ───────────────────────────
export interface QPQuestion {
  number: number;
  question: string;
  marks: number;
  bloomLevel: string;
  co: string;
  answerKey: string;
}
export interface QuestionPaper {
  title: string;
  subject: string;
  totalMarks: number;
  durationMinutes: number;
  instructions: string[];
  questions: QPQuestion[];
  bloomDistribution: { level: string; percent: number }[];
  evaluationGuidelines: string[];
}

export async function generateQuestionPaper(
  subject: string,
  topics: string,
  totalMarks: number,
  questionCount: number,
  examType: string
): Promise<QuestionPaper> {
  const prompt = `${HOD_PERSONA}

Generate a complete ${examType} question paper.

SUBJECT: ${subject}
TOPICS: ${topics}
TOTAL MARKS: ${totalMarks}
NUMBER OF QUESTIONS: ${questionCount}

Distribute questions across Bloom's Taxonomy levels (Remember, Understand, Apply, Analyze, Evaluate, Create) appropriately for an engineering exam, and map each to a Course Outcome (CO1..CO5).

Return ONLY valid JSON:
{
  "title": "<paper title>",
  "subject": "${subject}",
  "total_marks": ${totalMarks},
  "duration_minutes": <integer>,
  "instructions": ["<exam instruction>", ...],
  "questions": [
    { "number": <n>, "question": "<text>", "marks": <n>, "bloom_level": "<level>", "co": "CO<n>", "answer_key": "<concise model answer / key points>" }
  ],
  "bloom_distribution": [ { "level": "<level>", "percent": <n> } ],
  "evaluation_guidelines": ["<marking guideline>", ...]
}

Rules:
- question marks must sum to ${totalMarks}
- Spread Bloom levels; avoid all questions being "Remember"
- answer_key must be specific enough to grade against`;

  const raw = (await generateJSON(prompt)) as Record<string, unknown>;
  return {
    title: (raw.title as string) ?? `${subject} ${examType}`,
    subject,
    totalMarks: (raw.total_marks as number) ?? totalMarks,
    durationMinutes: (raw.duration_minutes as number) ?? 180,
    instructions: (raw.instructions as string[]) ?? [],
    questions: ((raw.questions as Record<string, unknown>[]) ?? []).map((q) => ({
      number: (q.number as number) ?? 0,
      question: (q.question as string) ?? "",
      marks: (q.marks as number) ?? 0,
      bloomLevel: (q.bloom_level as string) ?? "Understand",
      co: (q.co as string) ?? "CO1",
      answerKey: (q.answer_key as string) ?? "",
    })),
    bloomDistribution: ((raw.bloom_distribution as Record<string, unknown>[]) ?? []).map((b) => ({
      level: (b.level as string) ?? "",
      percent: (b.percent as number) ?? 0,
    })),
    evaluationGuidelines: (raw.evaluation_guidelines as string[]) ?? [],
  };
}

// ─── 5. Bloom's taxonomy validation ─────────────────────────
export interface BloomValidation {
  distribution: { level: string; count: number; percent: number }[];
  balanced: boolean;
  assessment: string;
  suggestions: string[];
}

export async function validateBlooms(questions: { text: string; marks: number }[]): Promise<BloomValidation> {
  const prompt = `${HOD_PERSONA}

Classify each exam question by Bloom's Taxonomy level and evaluate whether the paper has a balanced cognitive distribution for an engineering course.

QUESTIONS:
${questions.map((q, i) => `${i + 1}. (${q.marks}m) ${q.text}`).join("\n")}

Return ONLY valid JSON:
{
  "distribution": [ { "level": "<Bloom level>", "count": <n>, "percent": <n> } ],
  "balanced": <true|false>,
  "assessment": "<2-3 sentence professional assessment of the cognitive balance>",
  "suggestions": ["<specific improvement>", ...]
}`;
  const raw = (await generateJSON(prompt)) as Record<string, unknown>;
  return {
    distribution: ((raw.distribution as Record<string, unknown>[]) ?? []).map((d) => ({
      level: (d.level as string) ?? "",
      count: (d.count as number) ?? 0,
      percent: (d.percent as number) ?? 0,
    })),
    balanced: (raw.balanced as boolean) ?? false,
    assessment: (raw.assessment as string) ?? "",
    suggestions: (raw.suggestions as string[]) ?? [],
  };
}

// ─── 6. CO/PO mapping ───────────────────────────────────────
export interface COPOMapping {
  courseOutcomes: { co: string; description: string; bloomLevel: string }[];
  coPoMatrix: { co: string; po: string; strength: number }[];
  justification: string;
}

export async function generateCOPOMapping(subject: string, topics: string): Promise<COPOMapping> {
  const prompt = `${HOD_PERSONA}

For the subject below, define Course Outcomes (CO1..CO5) and map them to NBA Program Outcomes (PO1..PO12) with correlation strength (1=low, 2=medium, 3=high).

SUBJECT: ${subject}
TOPICS: ${topics}

Return ONLY valid JSON:
{
  "course_outcomes": [ { "co": "CO1", "description": "<outcome>", "bloom_level": "<level>" } ],
  "co_po_matrix": [ { "co": "CO1", "po": "PO1", "strength": <1-3> } ],
  "justification": "<2-3 sentence rationale for the mapping>"
}

Rules:
- 5 course outcomes
- Only include co_po_matrix entries with strength >= 1
- Use realistic NBA PO correlations`;
  const raw = (await generateJSON(prompt)) as Record<string, unknown>;
  return {
    courseOutcomes: ((raw.course_outcomes as Record<string, unknown>[]) ?? []).map((c) => ({
      co: (c.co as string) ?? "",
      description: (c.description as string) ?? "",
      bloomLevel: (c.bloom_level as string) ?? "",
    })),
    coPoMatrix: ((raw.co_po_matrix as Record<string, unknown>[]) ?? []).map((m) => ({
      co: (m.co as string) ?? "",
      po: (m.po as string) ?? "",
      strength: (m.strength as number) ?? 0,
    })),
    justification: (raw.justification as string) ?? "",
  };
}

// ─── 7. Accreditation gap analysis ──────────────────────────
export interface AccreditationReport {
  framework: string;
  overallReadiness: number;
  criteria: { name: string; status: string; score: number; evidence: string; gaps: string[] }[];
  summary: string;
  priorityActions: string[];
}

export async function accreditationGapAnalysis(
  framework: string,
  ctx: DepartmentContext
): Promise<AccreditationReport> {
  const prompt = `${HOD_PERSONA}

Perform a ${framework} accreditation gap analysis for the department based on the available academic data. Where data is unavailable, flag it as a documentation gap to collect.

${ctxToText(ctx)}

Return ONLY valid JSON:
{
  "framework": "${framework}",
  "overall_readiness": <0-100>,
  "criteria": [
    { "name": "<criterion>", "status": "Met|Partial|Gap", "score": <0-100>, "evidence": "<what data supports this>", "gaps": ["<missing evidence>", ...] }
  ],
  "summary": "<professional readiness summary>",
  "priority_actions": ["<action to close the biggest gaps>", ...]
}

Use real ${framework} criteria names (e.g. for NBA: Student Outcomes, CO-PO Attainment, Faculty, Continuous Improvement).`;
  const raw = (await generateJSON(prompt)) as Record<string, unknown>;
  return {
    framework,
    overallReadiness: (raw.overall_readiness as number) ?? 0,
    criteria: ((raw.criteria as Record<string, unknown>[]) ?? []).map((c) => ({
      name: (c.name as string) ?? "",
      status: (c.status as string) ?? "Gap",
      score: (c.score as number) ?? 0,
      evidence: (c.evidence as string) ?? "",
      gaps: (c.gaps as string[]) ?? [],
    })),
    summary: (raw.summary as string) ?? "",
    priorityActions: (raw.priority_actions as string[]) ?? [],
  };
}

// ─── 8. Placement readiness ─────────────────────────────────
export interface PlacementReadiness {
  cohortReadiness: number;
  skillGaps: { skill: string; severity: string; affectedPercent: number }[];
  trainingRecommendations: string[];
  companyEligibility: { tier: string; eligiblePercent: number; criteria: string }[];
  summary: string;
}

export async function placementReadiness(
  ctx: DepartmentContext,
  studentScores: { name: string; avgPercent: number }[]
): Promise<PlacementReadiness> {
  const prompt = `${HOD_PERSONA}

Assess placement readiness of the student cohort using their academic performance as a proxy signal. Identify skill gaps, training needs, and likely company-tier eligibility.

${ctxToText(ctx)}

STUDENT PERFORMANCE (academic proxy):
${studentScores.slice(0, 50).map((s) => `- ${s.name}: ${s.avgPercent}%`).join("\n") || "  none"}

Return ONLY valid JSON:
{
  "cohort_readiness": <0-100>,
  "skill_gaps": [ { "skill": "<skill>", "severity": "High|Medium|Low", "affected_percent": <n> } ],
  "training_recommendations": ["<specific training>", ...],
  "company_eligibility": [ { "tier": "Tier 1 (Product/MNC)|Tier 2|Tier 3 (Mass recruiters)", "eligible_percent": <n>, "criteria": "<typical cutoff>" } ],
  "summary": "<professional readiness summary>"
}

Note: infer skill gaps from academic performance patterns; be transparent that this is an academic proxy, not aptitude data.`;
  const raw = (await generateJSON(prompt)) as Record<string, unknown>;
  return {
    cohortReadiness: (raw.cohort_readiness as number) ?? 0,
    skillGaps: ((raw.skill_gaps as Record<string, unknown>[]) ?? []).map((g) => ({
      skill: (g.skill as string) ?? "",
      severity: (g.severity as string) ?? "Medium",
      affectedPercent: (g.affected_percent as number) ?? 0,
    })),
    trainingRecommendations: (raw.training_recommendations as string[]) ?? [],
    companyEligibility: ((raw.company_eligibility as Record<string, unknown>[]) ?? []).map((c) => ({
      tier: (c.tier as string) ?? "",
      eligiblePercent: (c.eligible_percent as number) ?? 0,
      criteria: (c.criteria as string) ?? "",
    })),
    summary: (raw.summary as string) ?? "",
  };
}

// ─── normalize helper ───────────────────────────────────────
function normalizeAdvice(raw: Partial<HODAdvice>): HODAdvice {
  const p = raw.priority;
  return {
    summary: raw.summary ?? "",
    recommendations: raw.recommendations ?? [],
    risks: raw.risks ?? [],
    actionItems: raw.actionItems ?? [],
    priority: p === "High" || p === "Medium" || p === "Low" ? p : "Medium",
  };
}
