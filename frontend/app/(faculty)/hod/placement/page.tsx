"use client";
import { useMutation } from "@apollo/client";
import { useEffect } from "react";
import { HOD_PLACEMENT_READINESS } from "@/lib/graphql/mutations";
import { AIErrorBanner } from "@/components/AIErrorBanner";
import { Briefcase, Sparkles, Loader2, Building2, GraduationCap } from "lucide-react";
import clsx from "clsx";

interface SkillGap { skill: string; severity: string; affectedPercent: number }
interface CompanyTier { tier: string; eligiblePercent: number; criteria: string }
interface Readiness {
  cohortReadiness: number; summary: string;
  trainingRecommendations: string[]; skillGaps: SkillGap[]; companyEligibility: CompanyTier[];
}

const SEV_COLOR: Record<string, string> = {
  High: "text-red-700 bg-red-50", Medium: "text-amber-700 bg-amber-50", Low: "text-emerald-700 bg-emerald-50",
};

export default function HODPlacementPage() {
  const [run, { data, loading, error }] = useMutation(HOD_PLACEMENT_READINESS);
  const r: Readiness | undefined = data?.hodPlacementReadiness;

  const trigger = () => { run().catch(() => { /* surfaced via error */ }); };
  useEffect(() => { trigger(); /* auto-run on mount */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center">
            <Briefcase size={20} className="text-cyan-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Placement Intelligence</h1>
            <p className="text-gray-500 text-sm">Skill-gap analysis & readiness from academic signals.</p>
          </div>
        </div>
        <button onClick={trigger} disabled={loading} className="gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Refresh
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
        Readiness is inferred from academic performance as a proxy. Connect aptitude/coding-test data for higher fidelity.
      </div>

      {error && !loading && <AIErrorBanner error={error} onRetry={trigger} />}

      {loading && !r && <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400"><Loader2 size={24} className="animate-spin text-violet-500 mx-auto mb-3" /><p className="text-sm">Assessing cohort readiness…</p></div>}

      {r && (
        <>
          {/* Readiness + summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-5">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f0f0f0" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none"
                  stroke={r.cohortReadiness >= 70 ? "#10b981" : r.cohortReadiness >= 40 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(r.cohortReadiness / 100) * 264} 264`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{r.cohortReadiness}%</span>
                <span className="text-[10px] text-gray-400">ready</span>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 mb-1">Cohort Readiness</h2>
              <p className="text-sm text-gray-600">{r.summary}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Skill gaps */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3"><GraduationCap size={17} className="text-violet-600" /><h2 className="font-semibold text-gray-900 text-sm">Skill Gaps</h2></div>
              {r.skillGaps.length === 0 ? <p className="text-sm text-gray-400">No major gaps identified.</p> : (
                <div className="space-y-2">
                  {r.skillGaps.map((g, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{g.skill}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{g.affectedPercent}%</span>
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", SEV_COLOR[g.severity] ?? SEV_COLOR.Medium)}>{g.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Company eligibility */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3"><Building2 size={17} className="text-cyan-600" /><h2 className="font-semibold text-gray-900 text-sm">Company Eligibility</h2></div>
              {r.companyEligibility.length === 0 ? <p className="text-sm text-gray-400">No data.</p> : (
                <div className="space-y-3">
                  {r.companyEligibility.map((c, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{c.tier}</span>
                        <span className="text-gray-500">{c.eligiblePercent}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-0.5">
                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${c.eligiblePercent}%` }} />
                      </div>
                      <p className="text-xs text-gray-400">{c.criteria}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Training recommendations */}
          {r.trainingRecommendations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Training Recommendations</h2>
              <ul className="space-y-1.5">
                {r.trainingRecommendations.map((t, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />{t}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
