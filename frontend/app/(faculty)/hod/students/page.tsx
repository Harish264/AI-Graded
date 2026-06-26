"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { HOD_DEPARTMENT_STUDENTS } from "@/lib/graphql/queries";
import { HOD_AT_RISK_ANALYSIS } from "@/lib/graphql/mutations";
import { HODAdviceCard, HODAdvice } from "@/components/HODAdviceCard";
import { AIErrorBanner } from "@/components/AIErrorBanner";
import { UserCheck, Sparkles, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import clsx from "clsx";

interface Student {
  id: string; name: string; email: string;
  submissions: number; avgScorePercent: number | null; atRisk: boolean; trend: string;
}

const TREND_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  improving: { icon: TrendingUp, color: "text-emerald-600" },
  declining: { icon: TrendingDown, color: "text-red-600" },
  stable: { icon: Minus, color: "text-gray-400" },
};

export default function HODStudentsPage() {
  const { data, loading } = useQuery(HOD_DEPARTMENT_STUDENTS);
  const students: Student[] = data?.hodDepartmentStudents ?? [];
  const [filter, setFilter] = useState<"all" | "risk">("all");

  const [analyze, { data: aData, loading: aLoading, error: aError }] = useMutation(HOD_AT_RISK_ANALYSIS);
  const advice: HODAdvice | undefined = aData?.hodAtRiskAnalysis;
  const runAnalyze = () => analyze().catch(() => { /* shown via error */ });

  const atRisk = students.filter((s) => s.atRisk || s.trend === "declining");
  const shown = filter === "risk" ? atRisk : students;
  const graded = students.filter((s) => s.avgScorePercent != null);
  const deptAvg = graded.length ? Math.round(graded.reduce((a, s) => a + (s.avgScorePercent ?? 0), 0) / graded.length) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <UserCheck size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Management</h1>
          <p className="text-gray-500 text-sm">Performance monitoring and at-risk identification.</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{students.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Students</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{deptAvg != null ? `${deptAvg}%` : "—"}</p>
          <p className="text-xs text-gray-500 mt-0.5">Avg Performance</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-red-600">{atRisk.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Needs Attention</p>
        </div>
      </div>

      {/* AI intervention */}
      {atRisk.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle size={16} />
            <span>{atRisk.length} student{atRisk.length !== 1 ? "s" : ""} flagged as at-risk or declining.</span>
          </div>
          <button
            onClick={runAnalyze}
            disabled={aLoading}
            className="gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
          >
            {aLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Generate Intervention Plan
          </button>
        </div>
      )}

      {aError && !aLoading && <AIErrorBanner error={aError} onRetry={runAnalyze} />}
      {advice && !aLoading && <HODAdviceCard advice={advice} />}

      {/* Filter + table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Students</h2>
          <div className="flex gap-1 text-xs">
            <button onClick={() => setFilter("all")} className={clsx("px-2.5 py-1 rounded-lg font-medium", filter === "all" ? "bg-violet-50 text-violet-700" : "text-gray-500")}>All</button>
            <button onClick={() => setFilter("risk")} className={clsx("px-2.5 py-1 rounded-lg font-medium", filter === "risk" ? "bg-red-50 text-red-700" : "text-gray-500")}>At-Risk</button>
          </div>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {filter === "risk" ? "No at-risk students. 🎉" : "No students found in this department."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-2.5 font-medium">Student</th>
                  <th className="px-3 py-2.5 font-medium text-center">Submissions</th>
                  <th className="px-3 py-2.5 font-medium text-center">Avg Score</th>
                  <th className="px-3 py-2.5 font-medium text-center">Trend</th>
                  <th className="px-5 py-2.5 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const tr = TREND_ICON[s.trend] ?? TREND_ICON.stable;
                  const TrendIcon = tr.icon;
                  return (
                    <tr key={s.id} className={clsx("border-b border-gray-50 hover:bg-gray-50/50", s.atRisk && "bg-red-50/30")}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700">{s.submissions}</td>
                      <td className="px-3 py-3 text-center font-medium text-gray-900">{s.avgScorePercent != null ? `${s.avgScorePercent}%` : "—"}</td>
                      <td className="px-3 py-3">
                        <div className={clsx("flex items-center justify-center gap-1", tr.color)}>
                          <TrendIcon size={14} /> <span className="text-xs capitalize">{s.trend}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {s.atRisk
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium text-red-700 bg-red-50">At Risk</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs font-medium text-emerald-700 bg-emerald-50">On Track</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
