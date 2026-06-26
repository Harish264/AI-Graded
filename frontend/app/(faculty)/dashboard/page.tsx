"use client";
import { useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import {
  BookOpen, CheckSquare, TrendingUp, Users, Plus, ArrowRight,
  AlertTriangle, Clock, CheckCircle, FileText, Zap,
} from "lucide-react";
import { DASHBOARD_STATS, ASSIGNMENTS, NOTIFICATIONS } from "@/lib/graphql/queries";
import { useAuthStore } from "@/lib/store";
import { getAccessToken } from "@/lib/auth";

interface Assignment {
  id: string; title: string; subject: string | null; status: string;
  submissionCount: number; pendingReviewCount: number; dueDate: string | null;
}

interface Notification {
  id: string; type: string; title: string; message: string;
  isRead: boolean; link: string | null; createdAt: string;
}

function fmt(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diff < 0) return "Closed";
  if (diff < 24) return `Closes in ${Math.round(diff)}h`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const token = getAccessToken();

  const { data: statsData } = useQuery(DASHBOARD_STATS, { skip: !token });
  const { data: assignData } = useQuery(ASSIGNMENTS, { skip: !token });
  const { data: notifData } = useQuery(NOTIFICATIONS, { skip: !token });

  const stats = statsData?.dashboardStats;
  const recentAssignments: Assignment[] = assignData?.assignments?.slice(0, 5) ?? [];
  const notifications: Notification[] = notifData?.notifications?.slice(0, 4) ?? [];
  const unread = notifications.filter((n) => !n.isRead);

  const statCards = [
    { label: "Assignments", value: stats?.totalAssignments ?? 0, icon: BookOpen, color: "violet", sub: `${stats?.active ?? 0} active` },
    { label: "Submissions", value: stats?.totalSubmissions ?? 0, icon: Users, color: "blue", sub: "total received" },
    { label: "Pending Review", value: stats?.pendingReview ?? 0, icon: CheckSquare, color: "yellow", sub: "awaiting approval" },
    { label: "Published", value: stats?.published ?? 0, icon: TrendingUp, color: "green", sub: "grades released" },
  ] as const;

  const colorMap = {
    violet: "bg-violet-50 text-violet-600",
    blue: "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
    green: "bg-green-50 text-green-600",
  };

  const notifIcon: Record<string, typeof BookOpen> = {
    new_submission: BookOpen,
    pending_review: Clock,
    deadline: AlertTriangle,
    approved: CheckCircle,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.fullName?.split(" ")[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1">Here&apos;s what needs your attention today.</p>
        </div>
        <button onClick={() => router.push("/assignments/new")}
          className="flex items-center gap-2 gradient-brand text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New Assignment
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${colorMap[color]}`}><Icon size={20} /></div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending review alert */}
      {(stats?.pendingReview ?? 0) > 0 && (
        <div className="mb-5 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><AlertTriangle size={16} className="text-yellow-700" /></div>
            <div>
              <p className="font-medium text-yellow-800 text-sm">{stats?.pendingReview} submission{stats?.pendingReview !== 1 ? "s" : ""} waiting for review</p>
              <p className="text-xs text-yellow-600 mt-0.5">AI has graded them — your approval is needed to release marks.</p>
            </div>
          </div>
          <button onClick={() => router.push("/grading")}
            className="flex items-center gap-1.5 gradient-brand text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90">
            Review Now <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Assignments */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Assignments</h2>
            <button onClick={() => router.push("/assignments")} className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          {recentAssignments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No assignments yet.</p>
              <button onClick={() => router.push("/assignments/new")}
                className="mt-4 flex items-center gap-2 mx-auto gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Plus size={14} /> Create Assignment
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentAssignments.map((a) => {
                const statusColors: Record<string, string> = {
                  DRAFT: "bg-gray-100 text-gray-600",
                  ACTIVE: "bg-green-100 text-green-700",
                  CLOSED: "bg-amber-100 text-amber-700",
                  ARCHIVED: "bg-slate-100 text-slate-500",
                };
                const dueFmt = fmt(a.dueDate);
                return (
                  <div key={a.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => router.push(`/assignments/${a.id}`)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{a.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.subject ?? "No subject"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {dueFmt && (
                        <span className={`text-xs flex items-center gap-1 ${dueFmt === "Closed" ? "text-gray-400" : dueFmt.startsWith("Closes") ? "text-amber-600 font-medium" : "text-gray-500"}`}>
                          <Clock size={11} /> {dueFmt}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-400"><Users size={12} />{a.submissionCount}</div>
                      {a.pendingReviewCount > 0 && (
                        <span className="text-xs text-yellow-600 font-semibold">{a.pendingReviewCount} pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Notifications + Quick Actions */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: "Create Assignment", icon: Plus, to: "/assignments/new", className: "gradient-brand text-white hover:opacity-90" },
                { label: "Review Queue", icon: CheckSquare, to: "/grading", className: "border border-violet-300 text-violet-700 hover:bg-violet-50" },
                { label: "View Analytics", icon: TrendingUp, to: "/analytics", className: "border border-gray-300 text-gray-700 hover:bg-gray-50" },
              ].map(({ label, icon: Icon, to, className }) => (
                <button key={label} onClick={() => router.push(to)}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${className}`}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
              {unread.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">{unread.length}</span>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">All caught up!</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((n) => {
                  const Icon = notifIcon[n.type] ?? FileText;
                  return (
                    <div key={n.id} onClick={() => n.link && router.push(n.link)}
                      className={`px-5 py-3 flex items-start gap-3 ${n.link ? "cursor-pointer hover:bg-gray-50" : ""}`}>
                      <Icon size={14} className={`mt-0.5 shrink-0 ${!n.isRead ? "text-violet-500" : "text-gray-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs truncate ${!n.isRead ? "font-semibold text-gray-900" : "text-gray-600"}`}>{n.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      </div>
                      {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-100">
              <button onClick={() => router.push("/notifications")} className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
                View all notifications <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Status Overview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Assignment Overview</h3>
            <div className="space-y-2.5">
              {[
                { label: "Active", value: stats?.active ?? 0, color: "bg-green-400" },
                { label: "Drafts", value: stats?.drafts ?? 0, color: "bg-gray-300" },
              ].map(({ label, value, color }) => {
                const total = (stats?.totalAssignments ?? 0);
                const pct = total > 0 ? (value / total) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>{label}</span><span className="font-semibold">{value}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
