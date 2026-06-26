"use client";
import { useState } from "react";
import { useMutation } from "@apollo/client";
import { HOD_ACCREDITATION_ANALYSIS } from "@/lib/graphql/mutations";
import { AIErrorBanner } from "@/components/AIErrorBanner";
import { Award, Sparkles, Loader2, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import clsx from "clsx";

interface Criterion { name: string; status: string; score: number; evidence: string; gaps: string[] }
interface Report {
  framework: string; overallReadiness: number; summary: string;
  priorityActions: string[]; criteria: Criterion[];
}

const STATUS_CFG: Record<string, { color: string; icon: React.ElementType }> = {
  Met: { color: "text-emerald-700 bg-emerald-50", icon: CheckCircle },
  Partial: { color: "text-amber-700 bg-amber-50", icon: AlertTriangle },
  Gap: { color: "text-red-700 bg-red-50", icon: XCircle },
};

export default function HODAccreditationPage() {
  const [framework, setFramework] = useState("NBA");
  const [analyze, { data, loading, error }] = useMutation(HOD_ACCREDITATION_ANALYSIS);
  const report: Report | undefined = data?.hodAccreditationAnalysis;
  const runAnalyze = () => analyze({ variables: { framework } }).catch(() => { /* shown via error */ });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
          <Award size={20} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accreditation Support</h1>
          <p className="text-gray-500 text-sm">AI-assisted gap analysis and compliance reporting.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-600">Framework:</span>
        {["NBA", "NAAC"].map((f) => (
          <button key={f} onClick={() => setFramework(f)} className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium", framework === f ? "bg-violet-50 text-violet-700 border border-violet-200" : "border border-gray-200 text-gray-600")}>{f}</button>
        ))}
        <button onClick={runAnalyze} disabled={loading} className="ml-auto gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Run Gap Analysis
        </button>
      </div>

      {error && !loading && <AIErrorBanner error={error} onRetry={runAnalyze} />}

      {loading && <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400"><Loader2 size={24} className="animate-spin text-violet-500 mx-auto mb-3" /><p className="text-sm">Analyzing {framework} readiness from department data…</p></div>}

      {report && !loading && (
        <>
          {/* Readiness gauge */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-5">
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f0f0f0" strokeWidth="10" />
                  <circle cx="50" cy="50" r="42" fill="none"
                    stroke={report.overallReadiness >= 70 ? "#10b981" : report.overallReadiness >= 40 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${(report.overallReadiness / 100) * 264} 264`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{report.overallReadiness}%</span>
                  <span className="text-[10px] text-gray-400">ready</span>
                </div>
              </div>
              <div>
                <h2 className="font-bold text-gray-900 mb-1">{report.framework} Readiness</h2>
                <p className="text-sm text-gray-600">{report.summary}</p>
              </div>
            </div>
          </div>

          {/* Criteria */}
          <div className="space-y-3">
            {report.criteria.map((c, i) => {
              const cfg = STATUS_CFG[c.status] ?? STATUS_CFG.Gap;
              const Icon = cfg.icon;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
                      <Icon size={11} /> {c.status} · {c.score}%
                    </span>
                  </div>
                  {c.evidence && <p className="text-xs text-gray-600 mb-2"><span className="font-medium text-gray-500">Evidence: </span>{c.evidence}</p>}
                  {c.gaps.length > 0 && (
                    <div className="bg-red-50/50 rounded-lg p-2.5">
                      <p className="text-xs font-medium text-red-600 mb-1">Documentation gaps to collect:</p>
                      <ul className="space-y-0.5">{c.gaps.map((g, j) => <li key={j} className="text-xs text-gray-600 pl-3">• {g}</li>)}</ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Priority actions */}
          {report.priorityActions.length > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-5">
              <p className="text-sm font-semibold text-violet-900 mb-2">Priority Actions</p>
              <ul className="space-y-1.5">
                {report.priorityActions.map((a, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />{a}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
