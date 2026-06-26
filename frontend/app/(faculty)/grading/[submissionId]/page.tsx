"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import toast from "react-hot-toast";
import {
  ArrowLeft, CheckCircle, Edit3, Send, AlertTriangle, Bot, Lightbulb,
  Eye, EyeOff, ChevronDown, ChevronUp, Sparkles, User, BookOpen,
  ThumbsUp, ThumbsDown, ArrowRight, Loader2,
} from "lucide-react";
import { GRADE, SUBMISSION_DETAIL, EXPLAIN_GRADE } from "@/lib/graphql/queries";
import { REVIEW_GRADE, PUBLISH_GRADE, GENERATE_FEEDBACK } from "@/lib/graphql/mutations";

interface CriterionScore {
  id: string; criterionId: string; criterionName: string;
  maxMarks: number; aiScore: number | null; finalScore: number | null; comment: string | null;
}

interface GradeExplanation {
  criterionName: string; maxMarks: number; score: number;
  expected: string[]; found: string[]; missing: string[];
  justification: string;
}

export default function GradeReviewPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const router = useRouter();

  const { data: gradeData, loading: gradeLoading } = useQuery(GRADE, { variables: { submissionId } });
  const { data: subData, loading: subLoading } = useQuery(SUBMISSION_DETAIL, { variables: { submissionId } });
  const [fetchExplain, { data: explainData, loading: explaining }] = useLazyQuery(EXPLAIN_GRADE, { variables: { submissionId } });

  const [reviewGrade, { loading: reviewing }] = useMutation(REVIEW_GRADE, { refetchQueries: ["Grade", "GradingQueue"] });
  const [publishGrade, { loading: publishing }] = useMutation(PUBLISH_GRADE, { refetchQueries: ["Grade"] });
  const [generateFeedback, { loading: generatingFeedback }] = useMutation(GENERATE_FEEDBACK);

  const [editMode, setEditMode] = useState(false);
  const [finalScore, setFinalScore] = useState("");
  const [finalFeedback, setFinalFeedback] = useState("");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [showExplain, setShowExplain] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [structuredFeedback, setStructuredFeedback] = useState<{
    summary: string; strengths: string[]; weaknesses: string[]; suggestions: string[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"review" | "explain" | "feedback">("review");

  const grade = gradeData?.grade;
  const sub = subData?.submissionDetail;
  const explain = explainData?.explainGrade;

  const loading = gradeLoading || subLoading;

  if (loading) {
    return (
      <div className="p-8 max-w-7xl">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }
  if (!grade) return <div className="p-8 text-gray-500">Grade not found.</div>;

  const isEditable = grade.status === "AI_DRAFT";
  const isApproved = grade.status === "APPROVED" || grade.status === "OVERRIDDEN";

  async function handleReview(action: "approve" | "override") {
    try {
      await reviewGrade({
        variables: {
          submissionId,
          input: {
            action,
            finalScore: action === "override" && finalScore ? Number(finalScore) : undefined,
            finalFeedback: action === "override" && finalFeedback ? finalFeedback : undefined,
            criterionOverrides: action === "override"
              ? Object.entries(overrides).map(([criterionId, finalScore]) => ({ criterionId, finalScore }))
              : [],
          },
        },
      });
      toast.success("Grade saved!");
      setEditMode(false);
    } catch (err: unknown) { toast.error((err as Error).message ?? "Failed"); }
  }

  async function handlePublish() {
    try {
      await publishGrade({ variables: { submissionId } });
      toast.success("Published to student!");
      router.push("/grading");
    } catch (err: unknown) { toast.error((err as Error).message ?? "Failed"); }
  }

  async function handleExplain() {
    setActiveTab("explain");
    if (!explain) await fetchExplain();
    setShowExplain(true);
  }

  async function handleGenerateFeedback() {
    try {
      const { data } = await generateFeedback({ variables: { submissionId } });
      setStructuredFeedback(data.generateFeedback);
      setActiveTab("feedback");
    } catch (err: unknown) { toast.error((err as Error).message ?? "Failed to generate feedback"); }
  }

  const statusBadge: Record<string, string> = {
    AI_DRAFT: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    OVERRIDDEN: "bg-blue-100 text-blue-700",
    PUBLISHED: "bg-green-100 text-green-700",
  };

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Back to Queue
        </button>
        <div className="flex items-center gap-2">
          {grade.needsReview && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <AlertTriangle size={12} /> Low Confidence
            </span>
          )}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge[grade.status] ?? "bg-gray-100 text-gray-700"}`}>
            {grade.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {sub && (
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">{sub.assignmentTitle}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sub.studentName} · {sub.studentEmail} · Submitted {new Date(sub.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      )}

      {/* Score summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "AI Score", value: grade.aiScore != null ? `${grade.aiScore.toFixed(1)}` : "—", color: "text-violet-700" },
          { label: "Final Score", value: grade.finalScore != null ? `${grade.finalScore.toFixed(1)}` : "—", color: "text-gray-900" },
          { label: "Confidence", value: grade.confidence != null ? `${Math.round(grade.confidence * 100)}%` : "—", color: (grade.confidence ?? 1) < 0.75 ? "text-red-500" : "text-green-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
        {[
          { key: "review", label: "Review Grade" },
          { key: "explain", label: "Explain AI Score" },
          { key: "feedback", label: "AI Feedback" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === key ? "bg-white shadow text-violet-700" : "text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Review Grade ── */}
      {activeTab === "review" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Left — Answers */}
          <div className="space-y-4">
            {/* Question */}
            {sub && (
              <section className="bg-white rounded-xl border border-gray-200">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <BookOpen size={15} className="text-violet-500" /> Question
                </div>
                <p className="px-5 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sub.assignmentQuestion}</p>
              </section>
            )}

            {/* Student Answer */}
            {sub && (
              <section className="bg-white rounded-xl border border-gray-200">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-700"><User size={15} className="text-blue-500" /> Student Answer</span>
                </div>
                <p className="px-5 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sub.answerText ?? sub.ocrText ?? <span className="text-gray-400 italic">No text submitted</span>}</p>
              </section>
            )}

            {/* Model Answer */}
            {sub && (
              <section className="bg-white rounded-xl border border-gray-200">
                <button onClick={() => setShowModelAnswer((v) => !v)}
                  className="w-full px-5 py-3 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-t-xl transition-colors">
                  <span className="flex items-center gap-2"><BookOpen size={15} className="text-green-500" /> Model Answer</span>
                  {showModelAnswer ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
                {showModelAnswer && <p className="px-5 pb-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sub.modelAnswer}</p>}
              </section>
            )}
          </div>

          {/* Right — Criterion scores + feedback */}
          <div className="space-y-4">
            {/* Criterion Breakdown */}
            <section className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">Criterion Breakdown</div>
              <div className="divide-y divide-gray-50">
                {grade.criterionScores.map((cs: CriterionScore) => (
                  <div key={cs.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <p className="font-medium text-gray-900 text-sm">{cs.criterionName}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">AI: {cs.aiScore?.toFixed(1)}</span>
                        {editMode ? (
                          <input type="number" min={0} max={cs.maxMarks} step={0.5}
                            defaultValue={cs.finalScore ?? cs.aiScore ?? 0}
                            onChange={(e) => setOverrides((p) => ({ ...p, [cs.criterionId]: Number(e.target.value) }))}
                            className="w-16 border border-violet-300 rounded px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-500" />
                        ) : (
                          <span className="font-semibold text-sm text-gray-900">{cs.finalScore?.toFixed(1)} / {cs.maxMarks}</span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mb-1.5">
                      <div className="h-full bg-violet-400 rounded-full transition-all" style={{ width: `${Math.min(100, ((cs.finalScore ?? 0) / cs.maxMarks) * 100)}%` }} />
                    </div>
                    {cs.comment && <p className="text-xs text-gray-500">{cs.comment}</p>}
                  </div>
                ))}
              </div>
            </section>

            {/* AI Feedback */}
            <section className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Bot size={15} className="text-violet-500" /> AI Feedback
              </div>
              <div className="p-5">
                {editMode ? (
                  <textarea rows={5} defaultValue={grade.aiFeedback ?? ""} onChange={(e) => setFinalFeedback(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" />
                ) : (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{grade.finalFeedback || grade.aiFeedback || "No feedback."}</p>
                )}
              </div>
            </section>

            {editMode && (
              <section className="bg-white rounded-xl border border-gray-200 p-5">
                <label className="text-sm font-medium text-gray-700 block mb-2">Override Total Score (optional)</label>
                <input type="number" min={0} step={0.5} value={finalScore} onChange={(e) => setFinalScore(e.target.value)}
                  placeholder="Leave blank to use sum of criteria"
                  className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </section>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Explain AI Score ── */}
      {activeTab === "explain" && (
        <div>
          {!explain && !explaining && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Lightbulb size={40} className="mx-auto mb-3 text-violet-400 opacity-70" />
              <h3 className="font-semibold text-gray-900 mb-1">Understand the AI&apos;s reasoning</h3>
              <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">See exactly what concepts were expected, found, and missing in the student&apos;s answer for each criterion.</p>
              <button onClick={handleExplain} disabled={explaining}
                className="flex items-center gap-2 mx-auto gradient-brand text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
                <Sparkles size={15} /> Generate Explanation
              </button>
            </div>
          )}
          {explaining && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Loader2 size={32} className="mx-auto mb-3 text-violet-400 animate-spin" />
              <p className="text-sm text-gray-500">Analysing student answer against rubric…</p>
            </div>
          )}
          {explain && (
            <div className="space-y-4">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-violet-800 mb-1">Overall Justification</p>
                <p className="text-sm text-violet-700 leading-relaxed">{explain.overallJustification}</p>
                <p className="text-xs text-violet-500 mt-2">AI Score: {explain.aiScore} / {explain.maxMarks}</p>
              </div>
              {explain.criteria.map((c: GradeExplanation) => (
                <div key={c.criterionName} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">{c.criterionName}</h4>
                    <span className="text-sm font-bold text-violet-700">{c.score} / {c.maxMarks}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 italic">{c.justification}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-gray-500 text-xs uppercase tracking-wide mb-2">Expected</p>
                      <ul className="space-y-1">
                        {c.expected.map((e, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-gray-700"><span className="text-gray-400 mt-0.5">•</span>{e}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-green-600 text-xs uppercase tracking-wide mb-2 flex items-center gap-1"><ThumbsUp size={11} /> Found</p>
                      <ul className="space-y-1">
                        {c.found.length > 0 ? c.found.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-green-700"><span className="text-green-400 mt-0.5">✓</span>{f}</li>
                        )) : <li className="text-gray-400 italic">Nothing matched</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-red-500 text-xs uppercase tracking-wide mb-2 flex items-center gap-1"><ThumbsDown size={11} /> Missing</p>
                      <ul className="space-y-1">
                        {c.missing.length > 0 ? c.missing.map((m, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-red-600"><span className="text-red-400 mt-0.5">✗</span>{m}</li>
                        )) : <li className="text-green-600 text-xs">Nothing missing!</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: AI Feedback ── */}
      {activeTab === "feedback" && (
        <div>
          {!structuredFeedback && !generatingFeedback && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Sparkles size={40} className="mx-auto mb-3 text-violet-400 opacity-70" />
              <h3 className="font-semibold text-gray-900 mb-1">Generate Structured Feedback</h3>
              <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">AI will generate strengths, weaknesses, and actionable suggestions tailored to this student&apos;s answer.</p>
              <button onClick={handleGenerateFeedback} disabled={generatingFeedback}
                className="flex items-center gap-2 mx-auto gradient-brand text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
                <Sparkles size={15} /> Generate Feedback
              </button>
            </div>
          )}
          {generatingFeedback && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Loader2 size={32} className="mx-auto mb-3 text-violet-400 animate-spin" />
              <p className="text-sm text-gray-500">Generating personalised feedback…</p>
            </div>
          )}
          {structuredFeedback && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-semibold text-gray-700 mb-2">Summary</p>
                <p className="text-sm text-gray-700 leading-relaxed">{structuredFeedback.summary}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                  <p className="font-semibold text-green-800 mb-3 flex items-center gap-1.5"><ThumbsUp size={14} /> Strengths</p>
                  <ul className="space-y-2">
                    {structuredFeedback.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-green-700 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                  <p className="font-semibold text-red-800 mb-3 flex items-center gap-1.5"><ThumbsDown size={14} /> Weaknesses</p>
                  <ul className="space-y-2">
                    {structuredFeedback.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-red-700 flex items-start gap-1.5"><span className="text-red-400 mt-0.5">✗</span>{w}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                  <p className="font-semibold text-blue-800 mb-3 flex items-center gap-1.5"><ArrowRight size={14} /> Suggestions</p>
                  <ul className="space-y-2">
                    {structuredFeedback.suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-blue-700 flex items-start gap-1.5"><span className="text-blue-400 mt-0.5">→</span>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <button onClick={handleGenerateFeedback} className="text-sm text-violet-600 hover:text-violet-800 flex items-center gap-1">
                <Sparkles size={13} /> Regenerate
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-4 mt-6 pt-5 border-t border-gray-200">
        <div className="flex gap-2">
          {isEditable && !editMode && (
            <>
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 border border-violet-300 text-violet-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-50">
                <Edit3 size={15} /> Override
              </button>
              <button onClick={() => handleReview("approve")} disabled={reviewing}
                className="flex items-center gap-1.5 gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                <CheckCircle size={15} /> {reviewing ? "Saving…" : "Approve AI Grade"}
              </button>
            </>
          )}
          {editMode && (
            <>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleReview("override")} disabled={reviewing}
                className="gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {reviewing ? "Saving…" : "Save Override"}
              </button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {!structuredFeedback && activeTab !== "feedback" && (
            <button onClick={handleGenerateFeedback} disabled={generatingFeedback}
              className="flex items-center gap-1.5 border border-violet-300 text-violet-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-violet-50 disabled:opacity-50">
              {generatingFeedback ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Feedback
            </button>
          )}
          {!explain && activeTab !== "explain" && (
            <button onClick={handleExplain} disabled={explaining}
              className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
              {explaining ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
              Explain
            </button>
          )}
          {isApproved && (
            <button onClick={handlePublish} disabled={publishing}
              className="flex items-center gap-1.5 gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Send size={15} /> {publishing ? "Publishing…" : "Publish to Student"}
            </button>
          )}
          {grade.status === "PUBLISHED" && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><CheckCircle size={16} /> Published</span>
          )}
        </div>
      </div>
    </div>
  );
}
