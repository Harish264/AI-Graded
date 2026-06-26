"use client";
import { useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, Clock, CheckCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { NOTIFICATIONS } from "@/lib/graphql/queries";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  new_submission: { icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
  pending_review: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
  deadline: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  approved: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data, loading } = useQuery(NOTIFICATIONS, { pollInterval: 30_000 });

  const notifications: Notification[] = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const grouped: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const day = new Date(n.createdAt).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
    (grouped[day] ??= []).push(n);
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="px-2.5 py-1 rounded-full text-sm font-semibold bg-violet-100 text-violet-700">{unreadCount}</span>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="text-center py-20">
          <Bell size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">No notifications yet</p>
          <p className="text-sm text-gray-400 mt-1">Submissions, reviews, and deadlines will appear here.</p>
        </div>
      )}

      {Object.entries(grouped).map(([day, items]) => (
        <div key={day} className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{day}</p>
          <div className="space-y-2">
            {items.map((n) => {
              const cfg = typeConfig[n.type] ?? typeConfig.new_submission;
              const Icon = cfg.icon;
              return (
                <div key={n.id}
                  onClick={() => n.link && router.push(n.link)}
                  className={`flex items-start gap-4 bg-white rounded-xl border p-4 transition-colors ${n.link ? "cursor-pointer hover:border-violet-300 hover:shadow-sm" : ""} ${!n.isRead ? "border-violet-200" : "border-gray-200"}`}>
                  <div className={`p-2.5 rounded-xl shrink-0 ${cfg.bg}`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                    {n.link && <ChevronRight size={14} className="text-gray-300" />}
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-violet-500" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
