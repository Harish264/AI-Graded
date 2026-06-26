// ─── Provider models ─────────────────────────────────────────
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";
const HF_MODEL = process.env.HF_MODEL ?? "mistralai/Mistral-7B-Instruct-v0.3";

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ─── Individual provider calls ────────────────────────────────

async function callGroq(messages: OpenAIMessage[], maxTokens: number): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: maxTokens, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

async function callOpenRouter(messages: OpenAIMessage[], maxTokens: number): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://gradeai.app",
      "X-Title": "GradeAI",
    },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

async function callHuggingFace(messages: OpenAIMessage[], maxTokens: number): Promise<string> {
  const url = `https://api-inference.huggingface.co/models/${HF_MODEL}/v1/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: HF_MODEL, messages, max_tokens: maxTokens, stream: false }),
  });
  if (!res.ok) throw new Error(`HuggingFace error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

// ─── Fallback chain: Groq → OpenRouter → HuggingFace ─────────

export async function callWithFallback(messages: OpenAIMessage[], maxTokens = 2048): Promise<string> {
  const providers: Array<() => Promise<string>> = [
    () => callGroq(messages, maxTokens),
    () => callOpenRouter(messages, maxTokens),
    () => callHuggingFace(messages, maxTokens),
  ];
  let lastErr: unknown;
  for (const fn of providers) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`AI provider failed, trying next: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw lastErr;
}

function stripCodeFence(raw: string): string {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1].trim() : raw.trim();
}

// Kept for backward compatibility — retry logic is now handled by the provider fallback chain.
export async function withGeminiRetry<T>(fn: () => Promise<T>, _attempts = 4): Promise<T> {
  return fn();
}

async function generate(prompt: string): Promise<string> {
  const messages: OpenAIMessage[] = [
    { role: "system", content: "You are a precise AI assistant. Always respond with only valid JSON when instructed. Never wrap JSON in markdown code blocks." },
    { role: "user", content: prompt },
  ];
  const raw = await callWithFallback(messages, 4096);
  return stripCodeFence(raw);
}

interface Criterion {
  id: string;
  name: string;
  description: string | null;
  maxMarks: number;
}

interface GradeResult {
  totalScore: number;
  confidence: number;
  needsReview: boolean;
  feedback: string;
  criteriaScores: { criterionId: string; criterionName: string; score: number; comment: string }[];
}

export async function gradeSubmission(
  question: string,
  modelAnswer: string,
  studentAnswer: string,
  totalMarks: number,
  criteria: Criterion[]
): Promise<GradeResult> {
  const criteriaText = criteria
    .map((c) => `- ${c.name} (max ${c.maxMarks} marks)${c.description ? ": " + c.description : ""}`)
    .join("\n");

  const prompt = `You are an expert academic grader for Indian engineering colleges. Grade the student answer fairly and constructively.

QUESTION:
${question}

MODEL ANSWER:
${modelAnswer}

STUDENT ANSWER:
${studentAnswer}

RUBRIC (Total: ${totalMarks} marks):
${criteriaText}

Return ONLY valid JSON:
{
  "total_score": <number>,
  "confidence": <0.0-1.0>,
  "feedback": "<personalized 3-5 sentence feedback>",
  "criteria_scores": [
    { "criterion_name": "<name>", "score": <number>, "comment": "<specific comment>" }
  ]
}

Rules:
- total_score must equal sum of criterion scores
- confidence < 0.75 means borderline — flag for human review
- Be specific and constructive`;

  const raw = JSON.parse(await generate(prompt));
  const criteriaMap = new Map(criteria.map((c) => [c.name, c]));

  return {
    totalScore: raw.total_score,
    confidence: raw.confidence,
    needsReview: raw.confidence < 0.75,
    feedback: raw.feedback,
    criteriaScores: (raw.criteria_scores as { criterion_name: string; score: number; comment: string }[]).map((cs) => ({
      criterionId: criteriaMap.get(cs.criterion_name)?.id ?? "",
      criterionName: cs.criterion_name,
      score: cs.score,
      comment: cs.comment,
    })),
  };
}

export interface GeneratedCriterion {
  name: string;
  description: string;
  maxMarks: number;
}

export interface GeneratedAssignment {
  title: string;
  question: string;
  modelAnswer: string;
  rubricName: string;
  criteria: GeneratedCriterion[];
}

export async function generateAssignment(
  topic: string,
  subject: string,
  assignmentType: string,
  totalMarks: number,
  criteriaCount: number
): Promise<GeneratedAssignment> {
  const prompt = `You are an expert academic professor at an Indian engineering college. Generate a complete assignment for the following details.

Topic: ${topic}
Subject: ${subject || topic}
Type: ${assignmentType.replace(/_/g, " ")}
Total Marks: ${totalMarks}
Number of rubric criteria: ${criteriaCount}

Return ONLY valid JSON in this exact structure:
{
  "title": "<concise assignment title>",
  "question": "<detailed question that tests understanding, 3-6 sentences>",
  "model_answer": "<comprehensive ideal answer, 150-300 words>",
  "rubric_name": "<name for this rubric>",
  "criteria": [
    { "name": "<criterion name>", "description": "<what is assessed>", "max_marks": <number> }
  ]
}

Rules:
- Criteria max_marks must sum to exactly ${totalMarks}
- Spread marks proportionally based on criterion importance
- Model answer must directly address the question
- Question should require analytical/descriptive thinking, not just recall`;

  const raw = JSON.parse(await generate(prompt));

  return {
    title: raw.title,
    question: raw.question,
    modelAnswer: raw.model_answer,
    rubricName: raw.rubric_name,
    criteria: (raw.criteria as { name: string; description: string; max_marks: number }[]).map((c) => ({
      name: c.name,
      description: c.description,
      maxMarks: c.max_marks,
    })),
  };
}

export interface GradeExplanation {
  criterionName: string;
  maxMarks: number;
  score: number;
  expected: string[];
  found: string[];
  missing: string[];
  justification: string;
}

export interface ExplainGradeResult {
  overallJustification: string;
  aiScore: number;
  maxMarks: number;
  criteria: GradeExplanation[];
}

export async function explainGrade(
  question: string,
  modelAnswer: string,
  studentAnswer: string,
  criterionScores: { criterionName: string; maxMarks: number; aiScore: number; comment: string | null }[]
): Promise<ExplainGradeResult> {
  const criteriaText = criterionScores
    .map((cs) => `- ${cs.criterionName}: scored ${cs.aiScore}/${cs.maxMarks}${cs.comment ? " — " + cs.comment : ""}`)
    .join("\n");

  const totalScore = criterionScores.reduce((s, cs) => s + cs.aiScore, 0);
  const maxMarks = criterionScores.reduce((s, cs) => s + cs.maxMarks, 0);

  const prompt = `You are an AI grader explaining your grading decision to a faculty member. Be transparent and precise.

QUESTION: ${question}
MODEL ANSWER: ${modelAnswer}
STUDENT ANSWER: ${studentAnswer}

SCORES GIVEN:
${criteriaText}
Total: ${totalScore}/${maxMarks}

For each criterion, explain exactly:
- What concepts/points were EXPECTED (from model answer)
- What the student actually PROVIDED (found in student answer)
- What was MISSING from the student answer

Return ONLY valid JSON:
{
  "overall_justification": "<2-3 sentence summary of why the student got this score overall>",
  "criteria": [
    {
      "criterion_name": "<name>",
      "expected": ["<concept/point expected>", ...],
      "found": ["<concept/point found in student answer>", ...],
      "missing": ["<concept/point missing>", ...],
      "justification": "<1-2 sentence explanation for this criterion's score>"
    }
  ]
}

Be factual and reference specific parts of the student's answer.`;

  const raw = JSON.parse(await generate(prompt));

  return {
    overallJustification: raw.overall_justification,
    aiScore: totalScore,
    maxMarks,
    criteria: criterionScores.map((cs, i) => {
      const rawC = raw.criteria?.[i] ?? {};
      return {
        criterionName: cs.criterionName,
        maxMarks: cs.maxMarks,
        score: cs.aiScore,
        expected: rawC.expected ?? [],
        found: rawC.found ?? [],
        missing: rawC.missing ?? [],
        justification: rawC.justification ?? cs.comment ?? "",
      };
    }),
  };
}

export interface StructuredFeedback {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  summary: string;
}

export async function generateFeedback(
  question: string,
  modelAnswer: string,
  studentAnswer: string,
  totalScore: number,
  maxMarks: number,
  criterionComments: string[]
): Promise<StructuredFeedback> {
  const prompt = `You are an academic mentor providing constructive feedback for an Indian engineering student.

QUESTION: ${question}
MODEL ANSWER: ${modelAnswer}
STUDENT ANSWER: ${studentAnswer}
SCORE: ${totalScore}/${maxMarks}
CRITERION FEEDBACK: ${criterionComments.join("; ")}

Generate structured developmental feedback:

Return ONLY valid JSON:
{
  "summary": "<2-sentence overall assessment>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", ...],
  "weaknesses": ["<specific weakness 1>", ...],
  "suggestions": ["<actionable improvement 1>", "<actionable improvement 2>", ...]
}

Rules:
- At least 2 strengths (even for poor answers, find positives)
- At least 2 weaknesses if score < 75%
- Suggestions must be actionable and specific
- Reference actual content from student's answer`;

  const raw = JSON.parse(await generate(prompt));

  return {
    summary: raw.summary ?? "",
    strengths: raw.strengths ?? [],
    weaknesses: raw.weaknesses ?? [],
    suggestions: raw.suggestions ?? [],
  };
}

// ─── AI Chat Assistant ────────────────────────────────────

export interface ChatAction {
  type: string;
  data: string; // JSON-encoded payload
}

export interface ChatResponse {
  message: string;
  action?: ChatAction;
}

interface HistoryItem { role: string; content: string }

async function generateText(prompt: string): Promise<string> {
  const messages: OpenAIMessage[] = [{ role: "user", content: prompt }];
  return callWithFallback(messages, 1024);
}

export interface FacultyContext {
  totalAssignments: number;
  activeAssignments: number;
  drafts: number;
  totalSubmissions: number;
  pendingReview: number;
  published: number;
  assignments: {
    id: string; title: string; status: string; subject: string | null;
    submissionCount: number; pendingReviewCount: number;
    avgScore: number | null; maxMarks: number;
  }[];
  rubrics: { name: string; totalMarks: number; criteriaCount: number }[];
}

export interface StudentContext {
  studentName: string;
  submissions: {
    assignmentTitle: string; subject: string | null; status: string;
    aiScore: number | null; finalScore: number | null; maxMarks: number;
    aiFeedback: string | null; submittedAt: string;
    criterionScores: { name: string; score: number; maxMarks: number; comment: string | null }[];
  }[];
}

function buildHistory(history: HistoryItem[]): string {
  if (!history.length) return "";
  return history.slice(-8).map((h) =>
    h.role === "user" ? `Student/Faculty: ${h.content}` : `Assistant: ${h.content}`
  ).join("\n") + "\n";
}

export async function facultyChatAssistant(
  message: string,
  history: HistoryItem[],
  ctx: FacultyContext,
  pageContext: string
): Promise<ChatResponse> {
  const assignmentSummary = ctx.assignments.map((a) =>
    `  - "${a.title}" [${a.status}]${a.subject ? ` (${a.subject})` : ""} — ${a.submissionCount} submissions, ${a.pendingReviewCount} pending review, avg score: ${a.avgScore != null ? `${a.avgScore}/${a.maxMarks}` : "not graded yet"}`
  ).join("\n");

  const rubricSummary = ctx.rubrics.map((r) =>
    `  - "${r.name}" — ${r.totalMarks} marks, ${r.criteriaCount} criteria`
  ).join("\n");

  const systemPrompt = `You are GradeAI Assistant, an intelligent academic AI embedded in GradeAI — an AI-powered grading platform for Indian engineering colleges.

ROLE: Faculty AI Assistant
PAGE: ${pageContext || "Dashboard"}

FACULTY DATA CONTEXT:
- Total Assignments: ${ctx.totalAssignments} (${ctx.activeAssignments} active, ${ctx.drafts} drafts)
- Total Submissions: ${ctx.totalSubmissions}
- Pending Review: ${ctx.pendingReview}
- Published Grades: ${ctx.published}

ASSIGNMENTS:
${assignmentSummary || "  No assignments yet."}

RUBRICS:
${rubricSummary || "  No rubrics yet."}

CAPABILITIES:
You can help faculty with:
1. Analyzing class performance and identifying struggling students/concepts
2. Summarizing assignment results with specific numbers
3. Suggesting rubric improvements
4. Identifying which submissions need manual review
5. GENERATING complete assignments (question + model answer + rubric) on demand

ASSIGNMENT GENERATION — CRITICAL INSTRUCTION:
If the faculty asks you to generate, create, or draft an assignment (e.g. "create an assignment on X", "generate a question on Y", "make a 10-mark assignment on Z"), you MUST end your response with exactly this format on its own line:
<ACTION>{"type":"generate_assignment","topic":"<topic>","subject":"<subject or empty>","marks":<number>,"criteria_count":<3-5>}</ACTION>

RUBRIC SUGGESTION — If faculty asks to improve a rubric:
End your response with:
<ACTION>{"type":"suggest_rubric","criteria":[{"name":"...","description":"...","marks":<n>}]}</ACTION>

RULES:
- Be specific with numbers from the context above
- Format responses in clear markdown (use **bold**, bullet lists, numbered lists)
- Keep responses concise — 2-4 paragraphs max
- Never make up data not in the context
- You cannot modify grades — only suggest actions

${buildHistory(history)}Faculty: ${message}
Assistant:`;

  const raw = await generateText(systemPrompt);

  // Extract action if present
  const actionMatch = raw.match(/<ACTION>([\s\S]*?)<\/ACTION>/);
  const cleanMessage = raw.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, "").trim();

  if (actionMatch) {
    try {
      const actionData = JSON.parse(actionMatch[1]);
      return { message: cleanMessage, action: { type: actionData.type, data: JSON.stringify(actionData) } };
    } catch {
      return { message: cleanMessage };
    }
  }

  return { message: cleanMessage };
}

export async function studentChatAssistant(
  message: string,
  history: HistoryItem[],
  ctx: StudentContext,
  pageContext: string
): Promise<ChatResponse> {
  const submissionSummary = ctx.submissions.map((s) =>
    `  - "${s.assignmentTitle}"${s.subject ? ` (${s.subject})` : ""}: score ${s.finalScore != null ? `${s.finalScore}/${s.maxMarks}` : "not graded"}, status: ${s.status}${s.aiFeedback ? `\n    Feedback: ${s.aiFeedback.slice(0, 200)}` : ""}${s.criterionScores.length ? `\n    Criteria: ${s.criterionScores.map((c) => `${c.name}: ${c.score}/${c.maxMarks}`).join(", ")}` : ""}`
  ).join("\n");

  const totalGraded = ctx.submissions.filter((s) => s.finalScore != null);
  const avg = totalGraded.length
    ? totalGraded.reduce((sum, s) => sum + (s.finalScore! / s.maxMarks) * 100, 0) / totalGraded.length
    : null;

  const systemPrompt = `You are GradeAI Assistant, an intelligent learning coach embedded in GradeAI — an AI-powered grading platform for Indian engineering colleges.

ROLE: Student Learning Coach for ${ctx.studentName}
PAGE: ${pageContext || "Student Portal"}

STUDENT PERFORMANCE DATA:
- Assignments submitted: ${ctx.submissions.length}
- Overall average: ${avg != null ? `${avg.toFixed(1)}%` : "not graded yet"}

SUBMISSIONS & GRADES:
${submissionSummary || "  No submissions yet."}

CAPABILITIES:
You can help ${ctx.studentName} with:
1. Explaining what went wrong in their submissions (based on feedback and criterion scores)
2. Recommending what to study based on weak areas
3. Explaining academic concepts clearly with examples
4. Generating practice questions on topics (easy/medium/hard)
5. Tracking progress and identifying strong/weak areas
6. Answering subject-matter questions (algorithms, data structures, OS, etc.)

PRACTICE QUESTION GENERATION:
If the student asks for practice questions, end your response with:
<ACTION>{"type":"practice_questions","topic":"<topic>","difficulty":"<easy|medium|hard|mixed>"}</ACTION>

RULES:
- Be supportive, encouraging, and clear
- Reference their actual scores and feedback when answering performance questions
- Use simple language and examples for concept explanations
- Format responses with **bold**, bullet points, numbered lists for readability
- Never reveal other students' data
- Keep responses focused and under 300 words

${buildHistory(history)}Student: ${message}
Assistant:`;

  const raw = await generateText(systemPrompt);

  const actionMatch = raw.match(/<ACTION>([\s\S]*?)<\/ACTION>/);
  const cleanMessage = raw.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, "").trim();

  if (actionMatch) {
    try {
      const actionData = JSON.parse(actionMatch[1]);
      return { message: cleanMessage, action: { type: actionData.type, data: JSON.stringify(actionData) } };
    } catch {
      return { message: cleanMessage };
    }
  }

  return { message: cleanMessage };
}

export interface PracticeQuestion {
  question: string;
  difficulty: string;
  hint: string;
  sampleAnswer: string;
}

export async function generatePracticeQuestions(
  topic: string,
  subject: string,
  difficulty: string,
  count: number = 5
): Promise<PracticeQuestion[]> {
  const prompt = `You are an expert professor at an Indian engineering college. Generate ${count} practice questions on the topic below.

Topic: ${topic}
Subject: ${subject || topic}
Difficulty: ${difficulty}

Return ONLY valid JSON:
{
  "questions": [
    {
      "question": "<clear, specific practice question>",
      "difficulty": "<Easy|Medium|Hard>",
      "hint": "<1-sentence hint to guide thinking>",
      "sample_answer": "<brief ideal answer in 2-4 sentences>"
    }
  ]
}

Rules:
- Questions must test understanding, not just recall
- Vary question types: definition, application, analysis, comparison
- For engineering contexts, include practical scenarios
- Difficulty must match requested level`;

  const raw = JSON.parse(await generate(prompt));
  return (raw.questions as { question: string; difficulty: string; hint: string; sample_answer: string }[]).map((q) => ({
    question: q.question,
    difficulty: q.difficulty,
    hint: q.hint,
    sampleAnswer: q.sample_answer,
  }));
}

export interface LearningInsight {
  area: string;
  type: "strength" | "weakness";
  description: string;
  recommendation: string;
  avgPercent: number;
}

export async function generateLearningInsights(
  submissions: {
    assignmentTitle: string;
    subject: string | null;
    criterionScores: { name: string; score: number; maxMarks: number; comment: string | null }[];
  }[]
): Promise<LearningInsight[]> {
  if (!submissions.length) return [];

  // Aggregate scores by criterion name
  const criterionMap = new Map<string, { total: number; max: number; subject: string | null }>();
  for (const s of submissions) {
    for (const cs of s.criterionScores) {
      const existing = criterionMap.get(cs.name);
      if (existing) {
        existing.total += cs.score;
        existing.max += cs.maxMarks;
      } else {
        criterionMap.set(cs.name, { total: cs.score, max: cs.maxMarks, subject: s.subject });
      }
    }
  }

  const criteria = Array.from(criterionMap.entries()).map(([name, v]) => ({
    criterion: name,
    avgPercent: Math.round((v.total / v.max) * 100),
    subject: v.subject,
  }));

  const prompt = `You are an educational AI coach. Based on a student's criterion-level performance across multiple assignments, identify their strong areas and weak areas.

STUDENT PERFORMANCE BY CRITERION:
${criteria.map((c) => `- ${c.criterion}${c.subject ? ` (${c.subject})` : ""}: ${c.avgPercent}% average`).join("\n")}

Generate 3-6 learning insights (mix of strengths and weaknesses). Group related criteria into thematic areas.

Return ONLY valid JSON:
{
  "insights": [
    {
      "area": "<topic or skill area name>",
      "type": "strength" or "weakness",
      "description": "<1-2 sentence observation about the student's performance in this area>",
      "recommendation": "<1 specific actionable step to improve or maintain this>",
      "avg_percent": <0-100>
    }
  ]
}

Rules:
- "strength" for areas >= 70%, "weakness" for < 60%
- Be specific and constructive
- Recommendations must be concrete (e.g., "Practice writing time complexity in Big-O notation", not "Study more")`;

  const raw = JSON.parse(await generate(prompt));
  return (raw.insights as { area: string; type: string; description: string; recommendation: string; avg_percent: number }[]).map((i) => ({
    area: i.area,
    type: i.type as "strength" | "weakness",
    description: i.description,
    recommendation: i.recommendation,
    avgPercent: i.avg_percent,
  }));
}

export interface AssignmentOverview {
  difficulty: string;
  estimatedMinutes: number;
  topics: string[];
  objectives: string[];
  summary: string;
}

export async function generateAssignmentOverview(
  title: string,
  question: string,
  modelAnswer: string,
  criteria: { name: string; maxMarks: number }[]
): Promise<AssignmentOverview> {
  const prompt = `You are an academic course designer. Analyze this assignment and produce a concise student-facing overview.

TITLE: ${title}
QUESTION: ${question}
MODEL ANSWER: ${modelAnswer}
RUBRIC: ${criteria.map((c) => `${c.name} (${c.maxMarks}m)`).join(", ")}

Return ONLY valid JSON:
{
  "difficulty": "Easy" | "Medium" | "Hard",
  "estimated_minutes": <realistic integer minutes to complete>,
  "topics": ["<topic tag>", ...],
  "objectives": ["<learning objective the student will demonstrate>", ...],
  "summary": "<1-2 sentence plain-language description of what the student must do>"
}

Rules:
- 3-5 topic tags (short, e.g. "Heap", "Priority Queue")
- 2-4 learning objectives (start with a verb: "Analyze...", "Implement...")
- estimated_minutes between 10 and 180
- difficulty based on conceptual depth and rubric complexity`;

  const raw = JSON.parse(await generate(prompt));
  return {
    difficulty: raw.difficulty ?? "Medium",
    estimatedMinutes: raw.estimated_minutes ?? 30,
    topics: raw.topics ?? [],
    objectives: raw.objectives ?? [],
    summary: raw.summary ?? "",
  };
}

export interface CodeReview {
  complexity: string;
  readability: string;
  edgeCases: string[];
  suggestions: string[];
  summary: string;
  score: number;
}

export async function reviewCode(
  question: string,
  code: string,
  language: string
): Promise<CodeReview> {
  const prompt = `You are a senior software engineer mentoring a student. Review their code for an assignment. DO NOT rewrite or give the full solution — only give constructive feedback so they can improve it themselves.

PROBLEM: ${question}
LANGUAGE: ${language}

STUDENT CODE:
\`\`\`
${code.slice(0, 4000)}
\`\`\`

Return ONLY valid JSON:
{
  "complexity": "<brief note on time/space complexity, e.g. 'O(n log n) time, O(n) space'>",
  "readability": "<1 sentence on naming, structure, clarity>",
  "edge_cases": ["<edge case they may have missed>", ...],
  "suggestions": ["<specific improvement, no full code>", ...],
  "summary": "<1-2 sentence encouraging overall assessment>",
  "score": <0-100 code quality estimate>
}

Rules:
- Be encouraging but honest
- Never provide the complete corrected solution
- 1-4 edge cases, 1-4 suggestions
- If code is empty or trivial, say so kindly in summary`;

  const raw = JSON.parse(await generate(prompt));
  return {
    complexity: raw.complexity ?? "",
    readability: raw.readability ?? "",
    edgeCases: raw.edge_cases ?? [],
    suggestions: raw.suggestions ?? [],
    summary: raw.summary ?? "",
    score: raw.score ?? 0,
  };
}

export interface MissedConcept {
  concept: string;
  missedByCount: number;
  totalStudents: number;
  percent: number;
  description: string;
}

export async function analyzeTopMissedConcepts(
  question: string,
  modelAnswer: string,
  criterionHeatmap: { criterion: string; avgScore: number; maxMarks: number; percent: number }[],
  totalSubmissions: number
): Promise<MissedConcept[]> {
  const heatmapText = criterionHeatmap
    .map((h) => `- ${h.criterion}: avg ${h.avgScore}/${h.maxMarks} (${h.percent}%)`)
    .join("\n");

  const prompt = `You are an educational data analyst. Based on grading data from ${totalSubmissions} students, identify the top concepts that students are struggling with.

QUESTION: ${question}
MODEL ANSWER: ${modelAnswer}

CRITERION PERFORMANCE:
${heatmapText}

Based on the weakest-performing criteria and the question content, identify 3-6 specific concepts that students are most commonly missing or misunderstanding.

Return ONLY valid JSON:
{
  "missed_concepts": [
    {
      "concept": "<specific concept name>",
      "missed_by_percent": <estimated percentage of students who missed this>,
      "description": "<why students are missing this and what they're doing instead>"
    }
  ]
}

Order by severity (most missed first). Be specific to the subject matter, not generic.`;

  const raw = JSON.parse(await generate(prompt));
  const concepts = raw.missed_concepts as { concept: string; missed_by_percent: number; description: string }[];

  return concepts.map((c) => ({
    concept: c.concept,
    missedByCount: Math.round((c.missed_by_percent / 100) * totalSubmissions),
    totalStudents: totalSubmissions,
    percent: c.missed_by_percent,
    description: c.description,
  }));
}
