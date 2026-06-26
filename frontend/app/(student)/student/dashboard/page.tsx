"use client";
import { useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { STUDENT_DASHBOARD } from "@/lib/graphql/queries";
import { useAuthStore } from "@/lib/store";
import {
  BookOpen, Clock, CheckCircle, TrendingUp, Flame, Trophy,
  ArrowRight, AlertCircle, Calendar, Award,
} from "lucide-react";
import clsx from "clsx";

interface UpcomingAssignment {
  id: string; title: string; subject: string | null; dueDate: string | null; assignmentType: string;
}
interface RecentGrade {
  submissionId: string; assignmentTitle: string; subject: string | null;
  maxMarks: number; finalScore: number | null; gradeStatus: string | null; submittedAt: string;
}

function hoursUntil(date: string) {
  return Math.round((new Date(date).getTime() - Date.now()) / 3600000);
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data, loading } = useQuery(STUDENT_DASHBOARD, { pollInterval: 120_000 });
  const d = data?.studentDashboard;

  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-72 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Pending Grades", value: d?.pendingCount ?? 0, icon: Clock, color: "text-yellow-600 bg-yellow-50" },
    { label: "Completed", value: d?.gradedCount ?? 0, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
    { label: "Average Grade", value: d?.avgScorePercent != null ? `${d.avgScorePercent}%` : "—", icon: TrendingUp, color: "text-violet-600 bg-violet-50" },
    { label: "Week Streak", value: d?.weeklyStreak ?? 0, icon: Flame, color: "text-orange-600 bg-orange-50" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {firstName} 👋</h1>
          <p className="text-gray-500 text-sm mt-1">Here&apos;s your learning snapshot for today.</p>
        </div>
        {(d?.achievementCount ?? 0) > 0 && (
          <button
            onClick={() => router.push("/student/achievements")}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm hover:border-violet-300 transition-colors"
          >
            <Trophy size={16} className="text-yellow-500" />
            <span className="font-medium text-gray-700">{d?.achievementCount} badge{d?.achievementCount !== 1 ? "s" : ""}</span>
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center mb-3", s.color)}>
                <Icon size={18} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming deadlines */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-violet-600" />
            <h2 className="font-semibold text-gray-900">Due This Week</h2>
          </div>
          {(d?.upcomingDeadlines?.length ?? 0) === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <CheckCircle size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No deadlines this week. You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {d.upcomingDeadlines.map((a: UpcomingAssignment) => {
                const hrs = a.dueDate ? hoursUntil(a.dueDate) : null;
                const urgent = hrs != null && hrs <= 24;
                return (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/student/assignment/${a.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-violet-200 hover:bg-violet-50/30 cursor-pointer transition-colors"
                  >
                    <div className={clsx("w-2 h-2 rounded-full flex-shrink-0", urgent ? "bg-red-500" : "bg-yellow-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                      {a.subject && <p className="text-xs text-gray-500">{a.subject}</p>}
                    </div>
                    {hrs != null && (
                      <span className={clsx(
                        "text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                        urgent ? "text-red-700 bg-red-50" : "text-yellow-700 bg-yellow-50"
                      )}>
                        {urgent && <AlertCircle size={11} />}
                        {hrs <= 0 ? "Due now" : `${hrs}h left`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-emerald-600" />
              <h2 className="font-semibold text-gray-900">Recent Grades</h2>
            </div>
            <button
              onClick={() => router.push("/student/grades")}
              className="text-xs text-violet-600 font-medium flex items-center gap-1 hover:gap-1.5 transition-all"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          {(d?.recentGrades?.length ?? 0) === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No grades yet. Submit an assignment to get started!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {d.recentGrades.map((g: RecentGrade) => {
                const pct = g.finalScore != null ? Math.round((g.finalScore / g.maxMarks) * 100) : null;
                return (
                  <div
                    key={g.submissionId}
                    onClick={() => router.push("/student/grades")}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{g.assignmentTitle}</p>
                      {g.subject && <p className="text-xs text-gray-500">{g.subject}</p>}
                    </div>
                    <div className="text-right">
                      <p className={clsx(
                        "text-sm font-bold",
                        pct != null && pct >= 75 ? "text-emerald-600" : pct != null && pct >= 50 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {g.finalScore}/{g.maxMarks}
                      </p>
                      {pct != null && <p className="text-xs text-gray-400">{pct}%</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => router.push("/student")}
          className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-violet-300 hover:shadow-sm transition-all text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
            <BookOpen size={18} className="text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Assignments</p>
            <p className="text-xs text-gray-500">View & submit</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/student/analytics")}
          className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-violet-300 hover:shadow-sm transition-all text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <TrendingUp size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Analytics</p>
            <p className="text-xs text-gray-500">Track progress</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/student/grades")}
          className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-violet-300 hover:shadow-sm transition-all text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Award size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">My Grades</p>
            <p className="text-xs text-gray-500">Feedback & insights</p>
          </div>
        </button>
      </div>
    </div>
  );
}
