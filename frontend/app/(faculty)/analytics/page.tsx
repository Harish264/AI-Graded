"use client";
import { useState } from "react";
import { useQuery, useLazyQuery } from "@apollo/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from "recharts";
import { TrendingUp, BookOpen, AlertCircle, Sparkles, Loader2, Target, Award, Users, Brain } from "lucide-react";
import { ASSIGNMENTS, ASSIGNMENT_ANALYTICS, PERFORMANCE_TRENDS, TOP_MISSED_CONCEPTS } from "@/lib/graphql/queries";

interface ConceptRow { concept: string; missedByCount: number; totalStudents: number; percent: number; description: string; }
interface TrendRow { assignmentId: string; assignmentTitle: string; subject: string | null; avgScorePercent: number; passRate: number; gradedCount: number; }

export default function AnalyticsPage() {
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState<"insights" | "distribution" | "heatmap" | "trends">("insights");

  const { data: assignData } = useQuery(ASSIGNMENTS);
  const { data: analyticsData, loading: analyticsLoading } = useQuery(ASSIGNMENT_ANALYTICS, {
    variables: { assignmentId: selectedId }, skip: !selectedId,
  });
  const { data: trendsData, loading: trendsLoading } = useQuery(PERFORMANCE_TRENDS);
  const [fetchConcepts, { data: conceptsData, loading: conceptsLoading }] = useLazyQuery(TOP_MISSED_CONCEPTS, {
    variables: { assignmentId: selectedId },
  });

  const assignments = assignData?.assignments ?? [];
  const analytics = analyticsData?.assignmentAnalytics;
  const trends: TrendRow[] = trendsData?.performanceTrends ?? [];
  const concepts: ConceptRow[] = conceptsData?.topMissedConcepts ?? [];

  const difficultyColor: Record<string, string> = {
    Easy: "bg-green-100 text-green-700",
    Medium: "bg-yellow-100 text-yellow-700",
    Hard: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Understand class performance, concept gaps, and learning trends.</p>
      </div>

      {/* Performance Trends (always visible) */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp size={16} className="text-violet-500" />
          <span className="font-semibold text-gray-900">Performance Trends</span>
          <span className="text-xs text-gray-400 ml-auto">Class avg across all assignments</span>
        </div>
        <div className="p-6">
          {trendsLoading && <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />}
          {!trendsLoading && trends.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <TrendingUp size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Grade and publish submissions to see trends.</p>
            </div>
          )}
          {trends.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trends} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="assignmentTitle" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + "…" : v} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => [`${v}%`]} labelFormatter={(l) => `${l}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="avgScorePercent" name="Avg Score %" stroke="#7C3AED" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="passRate" name="Pass Rate %" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Assignment selector */}
      <div className="mb-5">
        <label className="text-sm font-medium text-gray-700 block mb-1">Select Assignment for Detailed Analytics</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-80">
          <option value="">— Choose an assignment —</option>
          {assignments.map((a: { id: string; title: string }) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
      </div>

      {!selectedId && (
        <div className="text-center py-16 text-gray-400">
          <BookOpen size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Select an assignment above to view detailed insights.</p>
        </div>
      )}

      {analyticsLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {analytics && (
        <div className="space-y-5">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Submissions", value: analytics.totalSubmissions, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Graded", value: analytics.gradedCount, icon: BookOpen, color: "text-violet-600", bg: "bg-violet-50" },
              { label: "Pass Rate", value: analytics.passRate != null ? `${analytics.passRate}%` : "—", icon: Target, color: "text-green-600", bg: "bg-green-50" },
              { label: "Completion Rate", value: analytics.completionRate != null ? `${analytics.completionRate}%` : "—", icon: Award, color: "text-amber-600", bg: "bg-amber-50" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${bg}`}><Icon size={18} className={color} /></div>
                <div><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-bold text-gray-900">{value}</p></div>
              </div>
            ))}
          </div>

          {/* Score insight row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Average Score", value: analytics.avgScore != null ? `${analytics.avgScore} / ${analytics.maxMarks}` : "—" },
              { label: "Highest Score", value: analytics.highestScore != null ? `${analytics.highestScore} / ${analytics.maxMarks}` : "—" },
              { label: "Lowest Score", value: analytics.lowestScore != null ? `${analytics.lowestScore} / ${analytics.maxMarks}` : "—" },
              { label: "AI–Human Agreement", value: analytics.aiHumanAgreementPct != null ? `${analytics.aiHumanAgreementPct}%` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Difficulty badge */}
          {analytics.difficultyLevel && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Estimated Difficulty:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${difficultyColor[analytics.difficultyLevel] ?? "bg-gray-100 text-gray-600"}`}>
                {analytics.difficultyLevel}
              </span>
              <span className="text-xs text-gray-400">based on class pass rate</span>
            </div>
          )}

          {/* Sub-tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {[
              { key: "insights", label: "Score Distribution" },
              { key: "heatmap", label: "Concept Heatmap" },
              { key: "trends", label: "Top Missed Concepts" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => {
                setActiveTab(key as typeof activeTab);
                if (key === "trends" && !conceptsData && selectedId) fetchConcepts();
              }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === key ? "bg-white shadow text-violet-700" : "text-gray-500 hover:text-gray-700"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Score Distribution */}
          {activeTab === "insights" && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900">Score Distribution</div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={analytics.scoreDistribution} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Students">
                      {analytics.scoreDistribution.map((_: unknown, i: number) => (
                        <Cell key={i} fill={i < 2 ? "#FCA5A5" : i === 2 ? "#FCD34D" : i === 3 ? "#818CF8" : "#6D28D9"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Concept Heatmap */}
          {activeTab === "heatmap" && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100 font-semibold text-gray-900">
                Concept Gap Heatmap
                <span className="text-sm font-normal text-gray-400 ml-2">Where the class struggled most</span>
              </div>
              <div className="divide-y divide-gray-50">
                {[...analytics.criterionHeatmap]
                  .sort((a: { percent: number }, b: { percent: number }) => a.percent - b.percent)
                  .map((row: { criterion: string; avgScore: number; maxMarks: number; percent: number }) => (
                    <div key={row.criterion} className="px-6 py-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-800">{row.criterion}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">avg {row.avgScore} / {row.maxMarks}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${row.percent < 50 ? "bg-red-100 text-red-700" : row.percent < 75 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                            {row.percent}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div className={`h-full rounded-full transition-all ${row.percent < 50 ? "bg-red-400" : row.percent < 75 ? "bg-yellow-400" : "bg-violet-500"}`}
                          style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Top Missed Concepts */}
          {activeTab === "trends" && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain size={16} className="text-violet-500" />
                  <span className="font-semibold text-gray-900">Top Missed Concepts</span>
                </div>
                {!conceptsData && (
                  <button onClick={() => fetchConcepts()}
                    className="flex items-center gap-1.5 gradient-brand text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
                    <Sparkles size={13} /> Generate AI Analysis
                  </button>
                )}
              </div>
              {conceptsLoading && (
                <div className="p-12 text-center">
                  <Loader2 size={28} className="mx-auto mb-3 text-violet-400 animate-spin" />
                  <p className="text-sm text-gray-500">Analysing which concepts students are missing…</p>
                </div>
              )}
              {!conceptsLoading && concepts.length === 0 && conceptsData && (
                <div className="p-10 text-center text-gray-400">
                  <AlertCircle size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Not enough data to identify missed concepts yet.</p>
                </div>
              )}
              {!conceptsLoading && !conceptsData && (
                <div className="p-10 text-center text-gray-400">
                  <Brain size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Click &quot;Generate AI Analysis&quot; to identify the concepts students are struggling with most.</p>
                </div>
              )}
              {concepts.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {concepts.map((c, i) => (
                    <div key={c.concept} className="px-6 py-5">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-gray-900">{c.concept}</p>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${c.percent >= 60 ? "bg-red-100 text-red-700" : c.percent >= 40 ? "bg-amber-100 text-amber-700" : "bg-yellow-100 text-yellow-700"}`}>
                              {c.percent}% missed
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">{c.description}</p>
                          <div className="mt-2 h-1.5 bg-gray-100 rounded-full">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${c.percent}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{c.missedByCount} of {c.totalStudents} students</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
