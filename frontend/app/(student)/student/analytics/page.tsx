"use client";
import { useQuery } from "@apollo/client";
import { STUDENT_ANALYTICS, LEARNING_INSIGHTS } from "@/lib/graphql/queries";
import {
  TrendingUp, Award, Target, BarChart3, Sparkles, ThumbsUp, AlertTriangle, Lightbulb,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import clsx from "clsx";

interface WeeklyScore { week: string; avgPercent: number; count: number }
interface SubjectScore { subject: string; avgPercent: number; count: number }
interface Insight { area: string; type: string; description: string; recommendation: string; avgPercent: number }

export default function StudentAnalyticsPage() {
  const { data, loading } = useQuery(STUDENT_ANALYTICS);
  const { data: insightsData, loading: insightsLoading } = useQuery(LEARNING_INSIGHTS);

  const a = data?.studentAnalytics;
  const insights: Insight[] = insightsData?.learningInsights ?? [];
  const strengths = insights.filter((i) => i.type === "strength");
  const weaknesses = insights.filter((i) => i.type === "weakness");

  const weekly: WeeklyScore[] = a?.weeklyScores ?? [];
  const subjects: SubjectScore[] = a?.subjectBreakdown ?? [];

  // Improvement rate: compare first vs last week
  const improvement = weekly.length >= 2
    ? Math.round(weekly[weekly.length - 1].avgPercent - weekly[0].avgPercent)
    : null;

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-72 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const hasData = (a?.gradedCount ?? 0) > 0;

  const metrics = [
    { label: "Average Score", value: a?.avgScorePercent != null ? `${a.avgScorePercent}%` : "—", icon: TrendingUp, color: "text-violet-600 bg-violet-50" },
    { label: "Best Score", value: a?.bestScore != null ? `${a.bestScore}%` : "—", icon: Award, color: "text-emerald-600 bg-emerald-50" },
    { label: "Improvement", value: improvement != null ? `${improvement > 0 ? "+" : ""}${improvement}%` : "—", icon: Target, color: improvement != null && improvement >= 0 ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50" },
    { label: "Submissions", value: a?.totalSubmissions ?? 0, icon: BarChart3, color: "text-gray-600 bg-gray-100" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Track your performance and learning progress over time.</p>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-xl border border-gray-200 text-center py-20 text-gray-400">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No graded work yet</p>
          <p className="text-sm mt-1">Your analytics will appear once your submissions are graded.</p>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center mb-3", m.color)}>
                    <Icon size={18} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{m.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                </div>
              );
            })}
          </div>

          {a?.bestAssignment && (
            <div className="bg-gradient-to-r from-violet-50 to-emerald-50 rounded-xl border border-violet-100 p-4 flex items-center gap-3">
              <Award size={20} className="text-emerald-600" />
              <p className="text-sm text-gray-700">
                Your best performance was on <span className="font-semibold text-gray-900">{a.bestAssignment}</span>
                {a.bestScore != null && <span> — {a.bestScore}%</span>}
              </p>
            </div>
          )}

          {/* Learning progress chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Learning Progress</h2>
            {weekly.length < 2 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Complete assignments across multiple weeks to see your progress trend.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={weekly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, "Avg Score"]}
                  />
                  <Line type="monotone" dataKey="avgPercent" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: "#7c3aed" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Subject breakdown */}
          {subjects.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Performance by Subject</h2>
              <ResponsiveContainer width="100%" height={Math.max(180, subjects.length * 50)}>
                <BarChart data={subjects} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis type="category" dataKey="subject" width={100} tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, "Avg Score"]}
                  />
                  <Bar dataKey="avgPercent" radius={[0, 6, 6, 0]}>
                    {subjects.map((s, i) => (
                      <Cell key={i} fill={s.avgPercent >= 75 ? "#10b981" : s.avgPercent >= 50 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* AI Learning Insights */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-violet-600" />
              <h2 className="font-semibold text-gray-900">Personalized Learning Insights</h2>
            </div>
            {insightsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />)}
              </div>
            ) : insights.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Insights will appear once you have more graded assignments.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strong areas */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsUp size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-semibold text-gray-700">Strong Areas</h3>
                  </div>
                  {strengths.length === 0 ? (
                    <p className="text-xs text-gray-400">Keep working to build your strengths!</p>
                  ) : (
                    <div className="space-y-2">
                      {strengths.map((s, i) => (
                        <div key={i} className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900">{s.area}</p>
                            <span className="text-xs font-bold text-emerald-700">{Math.round(s.avgPercent)}%</span>
                          </div>
                          <p className="text-xs text-gray-600">{s.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weak areas */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={15} className="text-orange-600" />
                    <h3 className="text-sm font-semibold text-gray-700">Areas to Improve</h3>
                  </div>
                  {weaknesses.length === 0 ? (
                    <p className="text-xs text-gray-400">No weak areas detected. Great job!</p>
                  ) : (
                    <div className="space-y-2">
                      {weaknesses.map((w, i) => (
                        <div key={i} className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900">{w.area}</p>
                            <span className="text-xs font-bold text-orange-700">{Math.round(w.avgPercent)}%</span>
                          </div>
                          <p className="text-xs text-gray-600 mb-1.5">{w.description}</p>
                          <div className="flex items-start gap-1.5 text-xs text-violet-700 bg-violet-50 rounded px-2 py-1">
                            <Lightbulb size={12} className="mt-0.5 flex-shrink-0" />
                            <span>{w.recommendation}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
