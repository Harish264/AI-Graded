"use client";
import { useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { HOD_DASHBOARD } from "@/lib/graphql/queries";
import {
  Users, GraduationCap, FileText, ClipboardCheck, TrendingUp,
  AlertTriangle, CheckCircle, Award, ArrowRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import clsx from "clsx";

interface SubjectPerf { subject: string; avgPercent: number; passRate: number; submissions: number; assignments: number }
interface WeekPt { week: string; avgPercent: number; count: number }

export default function HODDashboardPage() {
  const router = useRouter();
  const { data, loading } = useQuery(HOD_DASHBOARD, { pollInterval: 120_000 });
  const d = data?.hodDashboard;

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-72 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-72 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const subjects: SubjectPerf[] = d?.subjectPerformance ?? [];
  const trend: WeekPt[] = d?.passTrend ?? [];

  const kpis = [
    { label: "Faculty", value: d?.facultyCount ?? 0, icon: Users, color: "text-violet-600 bg-violet-50" },
    { label: "Students", value: d?.studentCount ?? 0, icon: GraduationCap, color: "text-blue-600 bg-blue-50" },
    { label: "Assignments", value: d?.assignmentCount ?? 0, icon: FileText, color: "text-indigo-600 bg-indigo-50" },
    { label: "Submissions", value: d?.submissionCount ?? 0, icon: ClipboardCheck, color: "text-cyan-600 bg-cyan-50" },
  ];

  const perf = [
    { label: "Dept Avg Score", value: d?.avgScorePercent != null ? `${d.avgScorePercent}%` : "—", icon: TrendingUp, color: "text-violet-600 bg-violet-50" },
    { label: "Pass Rate", value: d?.passRatePercent != null ? `${d.passRatePercent}%` : "—", icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
    { label: "Pending Reviews", value: d?.pendingReviews ?? 0, icon: ClipboardCheck, color: "text-amber-600 bg-amber-50" },
    { label: "At-Risk Students", value: d?.atRiskStudentCount ?? 0, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{d?.department || "Department"} Overview</h1>
          <p className="text-gray-500 text-sm mt-1">Department-wide KPIs, performance trends, and risk indicators.</p>
        </div>
        <button
          onClick={() => router.push("/hod/assistant")}
          className="flex items-center gap-2 gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          Ask HOD Assistant <ArrowRight size={15} />
        </button>
      </div>

      {/* Volume KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center mb-3", k.color)}><Icon size={18} /></div>
              <p className="text-2xl font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Performance KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {perf.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center mb-3", k.color)}><Icon size={18} /></div>
              <p className="text-2xl font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Pass trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Department Score Trend</h2>
        {trend.length < 2 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Not enough graded data across weeks yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(v: number) => [`${v}%`, "Avg"]} />
              <Line type="monotone" dataKey="avgPercent" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Subject performance */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Award size={18} className="text-violet-600" />
          <h2 className="font-semibold text-gray-900">Performance by Subject</h2>
        </div>
        {subjects.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No graded subject data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, subjects.length * 48)}>
            <BarChart data={subjects} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis type="category" dataKey="subject" width={120} tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(v: number) => [`${v}%`, "Avg"]} />
              <Bar dataKey="avgPercent" radius={[0, 6, 6, 0]}>
                {subjects.map((s, i) => (
                  <Cell key={i} fill={s.avgPercent >= 75 ? "#10b981" : s.avgPercent >= 50 ? "#f59e0b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
