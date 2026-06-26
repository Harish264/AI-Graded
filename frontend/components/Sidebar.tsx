"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@apollo/client";
import {
  LayoutDashboard, BookOpen, CheckSquare, BarChart3, LogOut,
  GraduationCap, FileText, Bell, Activity, Trophy,
  Users, UserCheck, ClipboardList, Award, Briefcase, Bot,
} from "lucide-react";
import clsx from "clsx";
import { useAuthStore } from "@/lib/store";
import { clearTokens } from "@/lib/auth";
import { NOTIFICATIONS, DASHBOARD_STATS, STUDENT_NOTIFICATIONS } from "@/lib/graphql/queries";
import { getAccessToken } from "@/lib/auth";
import React from "react";

interface NavItem { to: string; label: string; icon: React.ElementType; badge?: number }

// studentNav is built dynamically below with notification badge

export function Sidebar() {
  const { user, setUser } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const token = getAccessToken();

  const isHOD = user?.role === "HOD" || user?.role === "ADMIN";
  const isFaculty = user?.role !== "STUDENT";

  const { data: notifData } = useQuery(NOTIFICATIONS, {
    skip: !isFaculty || !token,
    pollInterval: 60_000,
  });
  const { data: statsData } = useQuery(DASHBOARD_STATS, {
    skip: !isFaculty || !token,
    pollInterval: 60_000,
  });
  const { data: studentNotifData } = useQuery(STUDENT_NOTIFICATIONS, {
    skip: isFaculty || !token,
    pollInterval: 60_000,
  });

  const unreadNotifs = notifData?.notifications?.filter((n: { isRead: boolean }) => !n.isRead).length ?? 0;
  const pendingReview = statsData?.dashboardStats?.pendingReview ?? 0;

  // Student notifications are computed (no DB read-state); track "seen" ids in localStorage
  const [seenNotifs, setSeenNotifs] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    const read = () => {
      try { setSeenNotifs(new Set(JSON.parse(localStorage.getItem("gradeai_seen_notifs") || "[]"))); }
      catch { setSeenNotifs(new Set()); }
    };
    read();
    window.addEventListener("notifs-seen", read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener("notifs-seen", read); window.removeEventListener("storage", read); };
  }, []);
  const studentUnread = (studentNotifData?.studentNotifications ?? [])
    .filter((n: { id: string }) => !seenNotifs.has(n.id)).length;

  const studentNav: NavItem[] = [
    { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/student", label: "My Assignments", icon: BookOpen },
    { to: "/student/grades", label: "My Grades", icon: FileText },
    { to: "/student/analytics", label: "My Analytics", icon: BarChart3 },
    { to: "/student/notifications", label: "Notifications", icon: Bell, badge: studentUnread },
    { to: "/student/achievements", label: "Achievements", icon: Trophy },
  ];

  const facultyNav: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/assignments", label: "Assignments", icon: BookOpen },
    { to: "/grading", label: "Grading Queue", icon: CheckSquare, badge: pendingReview },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/notifications", label: "Notifications", icon: Bell, badge: unreadNotifs },
    { to: "/activity", label: "Activity Log", icon: Activity },
  ];

  const hodNav: NavItem[] = [
    { to: "/hod/dashboard", label: "Department", icon: LayoutDashboard },
    { to: "/hod/faculty", label: "Faculty", icon: Users },
    { to: "/hod/students", label: "Students", icon: UserCheck },
    { to: "/hod/academic", label: "Academic Planning", icon: ClipboardList },
    { to: "/hod/exams", label: "Exam & Papers", icon: FileText },
    { to: "/hod/accreditation", label: "Accreditation", icon: Award },
    { to: "/hod/placement", label: "Placement", icon: Briefcase },
    { to: "/hod/assistant", label: "AI HOD Assistant", icon: Bot },
  ];

  const nav = isHOD ? hodNav : isFaculty ? facultyNav : studentNav;

  function logout() {
    clearTokens();
    setUser(null);
    router.push("/login");
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center">
            <GraduationCap size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gradient-brand">GradeAI</span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ to, label, icon: Icon, badge }) => (
          <Link key={to} href={to}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              (to === "/student" ? pathname === "/student" : pathname.startsWith(to))
                ? "bg-violet-50 text-violet-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}>
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {badge != null && badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700 min-w-[20px] text-center">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role?.toLowerCase()}</p>
        </div>
        <button onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </aside>
  );
}
