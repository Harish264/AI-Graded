"use client";
import { useState } from "react";
import { useMutation } from "@apollo/client";
import { HOD_GENERATE_QUESTION_PAPER, HOD_VALIDATE_BLOOMS } from "@/lib/graphql/mutations";
import { AIErrorBanner } from "@/components/AIErrorBanner";
import { FileText, Sparkles, Loader2, BookOpen, CheckCircle, AlertTriangle, Plus, X } from "lucide-react";
import clsx from "clsx";

interface QPQuestion { number: number; question: string; marks: number; bloomLevel: string; co: string; answerKey: string }
interface QP {
  title: string; subject: string; totalMarks: number; durationMinutes: number;
  instructions: string[]; questions: QPQuestion[];
  bloomDistribution: { level: string; percent: number }[]; evaluationGuidelines: string[];
}
interface BloomVal {
  distribution: { level: string; count: number; percent: number }[];
  balanced: boolean; assessment: string; suggestions: string[];
}

const BLOOM_COLOR: Record<string, string> = {
  Remember: "bg-gray-100 text-gray-700", Understand: "bg-blue-100 text-blue-700",
  Apply: "bg-cyan-100 text-cyan-700", Analyze: "bg-violet-100 text-violet-700",
  Evaluate: "bg-amber-100 text-amber-700", Create: "bg-emerald-100 text-emerald-700",
};

export default function HODExamsPage() {
  const [tab, setTab] = useState<"paper" | "bloom">("paper");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
          <FileText size={20} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exam & Question Papers</h1>
          <p className="text-gray-500 text-sm">Generate question papers and validate Bloom&apos;s taxonomy balance.</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("paper")} className={clsx("px-4 py-1.5 rounded-md text-sm font-medium", tab === "paper" ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}>Question Paper</button>
        <button onClick={() => setTab("bloom")} className={clsx("px-4 py-1.5 rounded-md text-sm font-medium", tab === "bloom" ? "bg-white shadow-sm text-gray-900" : "text-gray-500")}>Bloom&apos;s Validator</button>
      </div>

      {tab === "paper" ? <PaperGenerator /> : <BloomValidator />}
    </div>
  );
}

function PaperGenerator() {
  const [form, setForm] = useState({ subject: "", topics: "", totalMarks: 100, questionCount: 10, examType: "End Semester" });
  const [gen, { data, loading, error }] = useMutation(HOD_GENERATE_QUESTION_PAPER);
  const [showKeys, setShowKeys] = useState(false);
  const qp: QP | undefined = data?.hodGenerateQuestionPaper;
  const runGen = () => gen({ variables: form }).catch(() => { /* shown via error */ });

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          <select value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            <option>End Semester</option><option>Mid Semester</option><option>Internal Assessment</option><option>Quiz</option>
          </select>
        </div>
        <input value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} placeholder="Topics to cover (comma separated)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-gray-600">Total Marks
            <input type="number" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: +e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </label>
          <label className="text-sm text-gray-600">Questions
            <input type="number" value={form.questionCount} onChange={(e) => setForm({ ...form, questionCount: +e.target.value })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </label>
        </div>
        <button onClick={runGen} disabled={loading || !form.subject.trim()} className="gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Generate Paper
        </button>
      </div>

      {error && !loading && <AIErrorBanner error={error} onRetry={runGen} />}
      {loading && <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400"><Loader2 size={24} className="animate-spin text-violet-500 mx-auto mb-3" /><p className="text-sm">Drafting question paper with Bloom&apos;s mapping…</p></div>}

      {qp && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="text-center border-b border-gray-100 pb-4">
            <h2 className="text-lg font-bold text-gray-900">{qp.title}</h2>
            <p className="text-sm text-gray-500">{qp.subject} · {qp.totalMarks} marks · {qp.durationMinutes} min</p>
          </div>

          {qp.instructions.length > 0 && (
            <div className="text-xs text-gray-500">
              <p className="font-semibold mb-1">Instructions:</p>
              <ol className="list-decimal ml-4 space-y-0.5">{qp.instructions.map((ins, i) => <li key={i}>{ins}</li>)}</ol>
            </div>
          )}

          {/* Bloom distribution */}
          <div className="flex flex-wrap gap-2">
            {qp.bloomDistribution.map((b, i) => (
              <span key={i} className={clsx("px-2.5 py-1 rounded-full text-xs font-medium", BLOOM_COLOR[b.level] ?? "bg-gray-100 text-gray-700")}>
                {b.level}: {b.percent}%
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Questions</h3>
            <button onClick={() => setShowKeys((v) => !v)} className="text-xs text-violet-600 font-medium">
              {showKeys ? "Hide" : "Show"} answer keys
            </button>
          </div>

          <div className="space-y-3">
            {qp.questions.map((q) => (
              <div key={q.number} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-400">Q{q.number}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{q.question}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-medium text-gray-500">{q.marks} marks</span>
                      <span className={clsx("px-1.5 py-0.5 rounded text-xs", BLOOM_COLOR[q.bloomLevel] ?? "bg-gray-100 text-gray-600")}>{q.bloomLevel}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600">{q.co}</span>
                    </div>
                    {showKeys && q.answerKey && (
                      <div className="mt-2 bg-emerald-50 rounded p-2 text-xs text-gray-700">
                        <span className="font-semibold text-emerald-700">Answer key: </span>{q.answerKey}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {qp.evaluationGuidelines.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Evaluation Guidelines</p>
              <ul className="space-y-1">
                {qp.evaluationGuidelines.map((g, i) => <li key={i} className="text-xs text-gray-600 flex gap-1.5"><CheckCircle size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" />{g}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function BloomValidator() {
  const [questions, setQuestions] = useState<{ text: string; marks: number }[]>([{ text: "", marks: 10 }]);
  const [validate, { data, loading, error }] = useMutation(HOD_VALIDATE_BLOOMS);
  const result: BloomVal | undefined = data?.hodValidateBlooms;
  const runValidate = () => validate({ variables: { questions: questions.filter((q) => q.text.trim()) } }).catch(() => { /* shown via error */ });

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <p className="text-sm text-gray-500">Paste exam questions to classify them by Bloom&apos;s level and check cognitive balance.</p>
        {questions.map((q, i) => (
          <div key={i} className="flex gap-2">
            <input value={q.text} onChange={(e) => setQuestions((p) => p.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder={`Question ${i + 1}`} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            <input type="number" value={q.marks} onChange={(e) => setQuestions((p) => p.map((x, j) => j === i ? { ...x, marks: +e.target.value } : x))} className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            {questions.length > 1 && <button onClick={() => setQuestions((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X size={16} /></button>}
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={() => setQuestions((p) => [...p, { text: "", marks: 10 }])} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1"><Plus size={15} /> Add</button>
          <button onClick={runValidate} disabled={loading || !questions.some((q) => q.text.trim())} className="gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <BookOpen size={15} />} Validate
          </button>
        </div>
      </div>

      {error && !loading && <AIErrorBanner error={error} onRetry={runValidate} />}

      {result && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className={clsx("flex items-center gap-2 rounded-lg p-3 text-sm", result.balanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
            {result.balanced ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>{result.balanced ? "Well-balanced cognitive distribution" : "Distribution could be improved"}</span>
          </div>
          <p className="text-sm text-gray-700">{result.assessment}</p>
          <div className="space-y-2">
            {result.distribution.map((d, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="font-medium text-gray-700">{d.level}</span>
                  <span className="text-gray-500">{d.count} Q · {d.percent}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${d.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
          {result.suggestions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Suggestions</p>
              <ul className="space-y-1">{result.suggestions.map((s, i) => <li key={i} className="text-sm text-gray-600 flex gap-1.5"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />{s}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
