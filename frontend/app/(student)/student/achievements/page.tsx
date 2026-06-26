"use client";
import { useQuery } from "@apollo/client";
import { STUDENT_ACHIEVEMENTS, STUDENT_DASHBOARD } from "@/lib/graphql/queries";
import { Trophy, Lock, Flame } from "lucide-react";
import clsx from "clsx";

interface Achievement {
  id: string; title: string; description: string; icon: string; earned: boolean; earnedAt: string | null;
}

export default function StudentAchievementsPage() {
  const { data, loading } = useQuery(STUDENT_ACHIEVEMENTS);
  const { data: dashData } = useQuery(STUDENT_DASHBOARD);
  const achievements: Achievement[] = data?.studentAchievements ?? [];
  const earned = achievements.filter((a) => a.earned);
  const streak = dashData?.studentDashboard?.weeklyStreak ?? 0;

  const progress = achievements.length > 0 ? Math.round((earned.length / achievements.length) * 100) : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
          <Trophy size={20} className="text-yellow-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Achievements</h1>
          <p className="text-gray-500 text-sm">Earn badges as you learn and grow.</p>
        </div>
      </div>

      {/* Progress summary */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-3xl font-bold">{earned.length}<span className="text-lg font-normal text-white/70">/{achievements.length}</span></p>
            <p className="text-sm text-white/80 mt-0.5">Badges Earned</p>
          </div>
          <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2">
            <Flame size={18} className="text-orange-300" />
            <div>
              <p className="text-lg font-bold leading-none">{streak}</p>
              <p className="text-xs text-white/70">week streak</p>
            </div>
          </div>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Badge grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={clsx(
                "rounded-xl border p-5 text-center transition-all",
                a.earned
                  ? "bg-white border-yellow-200 shadow-sm"
                  : "bg-gray-50 border-gray-200 opacity-70"
              )}
            >
              <div className={clsx(
                "w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-3",
                a.earned ? "bg-yellow-50" : "bg-gray-100"
              )}>
                {a.earned ? a.icon : <Lock size={24} className="text-gray-400" />}
              </div>
              <p className={clsx("text-sm font-semibold mb-1", a.earned ? "text-gray-900" : "text-gray-500")}>
                {a.title}
              </p>
              <p className="text-xs text-gray-500 leading-snug">{a.description}</p>
              {a.earned && (
                <span className="inline-block mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                  Earned
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
