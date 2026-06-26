"use client";
import { useState } from "react";
import { useQuery, useLazyQuery } from "@apollo/client";
import { MY_SUBMISSIONS, EXPLAIN_MY_GRADE } from "@/lib/graphql/queries";
import {
  FileText, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
  Award, TrendingUp, BookOpen, Star, Sparkles, Loader2, Check, X, Lightbulb,
} from "lucide-react";
import clsx from "clsx";

interface CriterionScore {
  criterionName: string;
  maxMarks: number;
  finalScore: number;
  comment?: string | null;
}

interface SubmissionSummary {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  subject?: string | null;
  maxMarks: number;
  submissionStatus: string;
  submittedAt: string;
  gradeStatus?: string | null;
  aiScore?: number | null;
  finalScore?: number | null;
  aiFeedback?: string | null;
  finalFeedback?: string | null;
  criterionScores: CriterionScore[];
}

function gradeLabel(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 90) return { label: "A+", color: "text-emerald-700 bg-emerald-50" };
  if (pct >= 80) return { label: "A", color: "text-emerald-600 bg-emerald-50" };
  if (pct >= 70) return { label: "B", color: "text-blue-700 bg-blue-50" };
  if (pct >= 60) return { label: "C", color: "text-yellow-700 bg-yellow-50" };
  if (pct >= 50) return { label: "D", color: "text-orange-700 bg-orange-50" };
  return { label: "F", color: "text-red-700 bg-red-50" };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    PUBLISHED: { label: "Graded", color: "text-emerald-700 bg-emerald-50", icon: CheckCircle },
    APPROVED: { label: "Approved", color: "text-blue-700 bg-blue-50", icon: CheckCircle },
    AI_DRAFT: { label: "AI Review", color: "text-violet-700 bg-violet-50", icon: Clock },
    PENDING_REVIEW: { label: "Pending", color: "text-yellow-700 bg-yellow-50", icon: Clock },
    SUBMITTED: { label: "Submitted", color: "text-gray-600 bg-gray-100", icon: FileText },
    AI_GRADING: { label: "AI Grading", color: "text-purple-700 bg-purple-50", icon: Clock },
  };
  const cfg = map[status] ?? { label: status, color: "text-gray-600 bg-gray-100", icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-14 text-right">{score}/{max}</span>
    </div>
  );
}

interface GradeExplanation {
  criterionName: string; maxMarks: number; score: number;
  expected: string[]; found: string[]; missing: string[]; justification: string;
}

function SubmissionCard({ sub }: { sub: SubmissionSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"breakdown" | "explain">("breakdown");
  const isGraded = sub.gradeStatus === "PUBLISHED" || sub.gradeStatus === "APPROVED" || sub.gradeStatus === "OVERRIDDEN";
  const score = sub.finalScore ?? sub.aiScore;
  const pct = score != null ? Math.round((score / sub.maxMarks) * 100) : null;
  const grade = score != null ? gradeLabel(score, sub.maxMarks) : null;
  const feedback = sub.finalFeedback ?? sub.aiFeedback;

  const [explain, { data: explainData, loading: explainLoading, error: explainError }] = useLazyQuery(EXPLAIN_MY_GRADE);
  const explanation = explainData?.explainMyGrade;

  function openExplain() {
    setTab("explain");
    if (!explainData && !explainLoading) {
      explain({ variables: { submissionId: sub.submissionId } });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => isGraded && setExpanded((e) => !e)}
      >
        <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
          <BookOpen size={18} className="text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{sub.assignmentTitle}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {sub.subject && <span className="text-xs text-gray-500">{sub.subject}</span>}
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">
              {new Date(sub.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Score */}
        {isGraded && score != null ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{score}<span className="text-sm font-normal text-gray-400">/{sub.maxMarks}</span></p>
              <p className="text-xs text-gray-500">{pct}%</p>
            </div>
            {grade && (
              <span className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold", grade.color)}>
                {grade.label}
              </span>
            )}
          </div>
        ) : (
          <div className="w-24" />
        )}

        <StatusBadge status={sub.gradeStatus ?? sub.submissionStatus} />
        {isGraded && (expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />)}
      </div>

      {/* Expanded detail */}
      {expanded && isGraded && (
        <div className="border-t border-gray-100">
          {/* Tabs */}
          <div className="flex gap-1 px-5 pt-3">
            <button
              onClick={() => setTab("breakdown")}
              className={clsx(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                tab === "breakdown" ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Breakdown & Feedback
            </button>
            <button
              onClick={openExplain}
              className={clsx(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5",
                tab === "explain" ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Sparkles size={13} /> Why this score?
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {tab === "breakdown" && (
              <>
                {/* Criterion breakdown */}
                {sub.criterionScores.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Criterion Breakdown</p>
                    <div className="space-y-2">
                      {sub.criterionScores.map((cs, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="text-gray-700 font-medium">{cs.criterionName}</span>
                          </div>
                          <ScoreBar score={cs.finalScore} max={cs.maxMarks} />
                          {cs.comment && <p className="text-xs text-gray-500 mt-0.5 ml-0">{cs.comment}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {feedback && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Feedback</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{feedback}</p>
                  </div>
                )}
              </>
            )}

            {tab === "explain" && (
              <>
                {explainLoading && (
                  <div className="flex items-center justify-center gap-2 py-8 text-violet-500">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm">Analyzing your answer…</span>
                  </div>
                )}
                {explainError && (
                  <p className="text-sm text-red-500 text-center py-6">Could not generate explanation. Please try again.</p>
                )}
                {explanation && (
                  <div className="space-y-4">
                    <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                      <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-1">Overall</p>
                      <p className="text-sm text-gray-700">{explanation.overallJustification}</p>
                    </div>
                    {explanation.criteria.map((c: GradeExplanation, i: number) => (
                      <div key={i} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-900">{c.criterionName}</p>
                          <span className="text-xs font-bold text-gray-600">{c.score}/{c.maxMarks}</span>
                        </div>
                        {c.found.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-emerald-700 flex items-center gap-1 mb-1"><Check size={12} /> What you got right</p>
                            <ul className="space-y-0.5">
                              {c.found.map((f, j) => <li key={j} className="text-xs text-gray-600 pl-4">• {f}</li>)}
                            </ul>
                          </div>
                        )}
                        {c.missing.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-red-600 flex items-center gap-1 mb-1"><X size={12} /> What was missing</p>
                            <ul className="space-y-0.5">
                              {c.missing.map((m, j) => <li key={j} className="text-xs text-gray-600 pl-4">• {m}</li>)}
                            </ul>
                          </div>
                        )}
                        {c.justification && (
                          <div className="flex items-start gap-1.5 text-xs text-violet-700 bg-violet-50 rounded px-2 py-1.5 mt-2">
                            <Lightbulb size={12} className="mt-0.5 flex-shrink-0" />
                            <span>{c.justification}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Pending message */}
      {!isGraded && (
        <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-2 text-xs text-gray-400">
          <Clock size={13} />
          {sub.submissionStatus === "AI_GRADING"
            ? "AI is grading your submission…"
            : sub.gradeStatus === "AI_DRAFT"
            ? "Your grade is awaiting faculty review."
            : "Your submission is being processed."}
        </div>
      )}
    </div>
  );
}

export default function StudentGradesPage() {
  const { data, loading } = useQuery(MY_SUBMISSIONS);
  const submissions: SubmissionSummary[] = data?.mySubmissions ?? [];

  const graded = submissions.filter(
    (s) => s.gradeStatus === "PUBLISHED" || s.gradeStatus === "APPROVED"
  );
  const totalScore = graded.reduce((sum, s) => sum + (s.finalScore ?? s.aiScore ?? 0), 0);
  const totalMax = graded.reduce((sum, s) => sum + s.maxMarks, 0);
  const avgPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;
  const best = graded.length
    ? graded.reduce((best, s) => {
        const pct = (s.finalScore ?? s.aiScore ?? 0) / s.maxMarks;
        const bPct = (best.finalScore ?? best.aiScore ?? 0) / best.maxMarks;
        return pct > bPct ? s : best;
      })
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Grades</h1>
        <p className="text-gray-500 text-sm mt-1">View your submission results and feedback</p>
      </div>

      {/* Summary cards */}
      {graded.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{avgPct}%</p>
              <p className="text-xs text-gray-500">Average Score</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Award size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{graded.length}</p>
              <p className="text-xs text-gray-500">Graded Assignments</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Star size={18} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 truncate max-w-[120px]">{best?.assignmentTitle ?? "—"}</p>
              <p className="text-xs text-gray-500">Best Performing</p>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-20 animate-pulse" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No submissions yet</p>
          <p className="text-sm mt-1">Submit an assignment to see your grades here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <SubmissionCard key={s.submissionId} sub={s} />
          ))}
        </div>
      )}
    </div>
  );
}
