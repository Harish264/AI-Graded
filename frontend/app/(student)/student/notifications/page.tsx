"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { STUDENT_NOTIFICATIONS } from "@/lib/graphql/queries";
import { Bell, BookOpen, Clock, Award, FileText } from "lucide-react";
import clsx from "clsx";

interface Notification {
  id: string; type: string; title: string; message: string;
  isRead: boolean; link: string | null; createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  NEW_ASSIGNMENT: { icon: BookOpen, color: "text-violet-600 bg-violet-50" },
  DUE_SOON: { icon: Clock, color: "text-red-600 bg-red-50" },
  GRADE_RELEASED: { icon: Award, color: "text-emerald-600 bg-emerald-50" },
  FEEDBACK: { icon: FileText, color: "text-blue-600 bg-blue-50" },
};

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function dayGroup(date: string) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function StudentNotificationsPage() {
  const router = useRouter();
  const { data, loading } = useQuery(STUDENT_NOTIFICATIONS, { pollInterval: 60_000 });
  const notifications: Notification[] = data?.studentNotifications ?? [];

  // Snapshot which ids were already seen *before* this visit (so they render as read),
  // then mark everything currently shown as seen and clear the sidebar badge.
  const seenBefore = useRef<Set<string>>(new Set());
  const [, forceRead] = useState(0);
  useEffect(() => {
    if (!notifications.length) return;
    try {
      const prev = new Set<string>(JSON.parse(localStorage.getItem("gradeai_seen_notifs") || "[]"));
      seenBefore.current = prev;
      const merged = new Set(prev);
      notifications.forEach((n) => merged.add(n.id));
      localStorage.setItem("gradeai_seen_notifs", JSON.stringify([...merged]));
      window.dispatchEvent(new Event("notifs-seen"));
      forceRead((x) => x + 1);
    } catch { /* ignore */ }
  }, [notifications]);

  // Group by day
  const groups: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const key = dayGroup(n.createdAt);
    (groups[key] ??= []).push(n);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
          <Bell size={20} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 text-sm">Stay updated on assignments, grades & deadlines.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 text-center py-20 text-gray-400">
          <Bell size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">You&apos;re all caught up</p>
          <p className="text-sm mt-1">New notifications will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([day, items]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{day}</p>
              <div className="space-y-2">
                {items.map((n) => {
                  const cfg = TYPE_CONFIG[n.type] ?? { icon: Bell, color: "text-gray-600 bg-gray-100" };
                  const Icon = cfg.icon;
                  const unread = !seenBefore.current.has(n.id);
                  return (
                    <div
                      key={n.id}
                      onClick={() => n.link && router.push(n.link)}
                      className={clsx(
                        "flex gap-3 p-4 rounded-xl border bg-white transition-colors",
                        n.link ? "cursor-pointer hover:border-violet-200 hover:bg-violet-50/20" : "",
                        "border-gray-200"
                      )}
                    >
                      <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", cfg.color)}>
                        <Icon size={17} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                          {unread && <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{relativeTime(n.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
