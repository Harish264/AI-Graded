"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { HOD_FACULTY_WORKLOAD } from "@/lib/graphql/queries";
import { HOD_FACULTY_ALLOCATION } from "@/lib/graphql/mutations";
import { HODAdviceCard, HODAdvice } from "@/components/HODAdviceCard";
import { AIErrorBanner } from "@/components/AIErrorBanner";
import { Users, Sparkles, Loader2, Plus, X } from "lucide-react";
import clsx from "clsx";

interface Faculty {
  id: string; name: string; email: string;
  assignments: number; submissions: number; graded: number;
  pendingReviews: number; avgScorePercent: number | null;
}

function workloadLevel(assignments: number, pending: number): { label: string; color: string } {
  const load = assignments * 2 + pending;
  if (load >= 12) return { label: "High", color: "text-red-700 bg-red-50" };
  if (load >= 5) return { label: "Balanced", color: "text-emerald-700 bg-emerald-50" };
  return { label: "Light", color: "text-blue-700 bg-blue-50" };
}

export default function HODFacultyPage() {
  const { data, loading } = useQuery(HOD_FACULTY_WORKLOAD);
  const faculty: Faculty[] = data?.hodFacultyWorkload ?? [];

  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjInput, setSubjInput] = useState("");
  const [allocate, { data: allocData, loading: allocLoading, error: allocError }] = useMutation(HOD_FACULTY_ALLOCATION);
  const advice: HODAdvice | undefined = allocData?.hodFacultyAllocation;
  const runAllocate = () => allocate({ variables: { subjects } }).catch(() => { /* shown via error */ });

  function addSubject() {
    const s = subjInput.trim();
    if (s && !subjects.includes(s)) setSubjects((p) => [...p, s]);
    setSubjInput("");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
          <Users size={20} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faculty Management</h1>
          <p className="text-gray-500 text-sm">Workload, performance, and AI-driven subject allocation.</p>
        </div>
      </div>

      {/* Workload table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Workload & Performance</h2>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}</div>
        ) : faculty.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No faculty found in this department.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-5 py-2.5 font-medium">Faculty</th>
                  <th className="px-3 py-2.5 font-medium text-center">Assignments</th>
                  <th className="px-3 py-2.5 font-medium text-center">Submissions</th>
                  <th className="px-3 py-2.5 font-medium text-center">Pending</th>
                  <th className="px-3 py-2.5 font-medium text-center">Avg Score</th>
                  <th className="px-5 py-2.5 font-medium text-center">Workload</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map((f) => {
                  const wl = workloadLevel(f.assignments, f.pendingReviews);
                  return (
                    <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{f.name}</p>
                        <p className="text-xs text-gray-400">{f.email}</p>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700">{f.assignments}</td>
                      <td className="px-3 py-3 text-center text-gray-700">{f.submissions}</td>
                      <td className="px-3 py-3 text-center">
                        {f.pendingReviews > 0
                          ? <span className="text-amber-700 font-medium">{f.pendingReviews}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-gray-900">
                        {f.avgScorePercent != null ? `${f.avgScorePercent}%` : "—"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", wl.color)}>{wl.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Subject Allocation */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-violet-600" />
          <h2 className="font-semibold text-gray-900">AI Subject Allocation</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Add the subjects to allocate next term; the assistant recommends a balanced split based on current workload and performance.</p>

        <div className="flex flex-wrap gap-2 mb-3">
          {subjects.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full text-sm">
              {s}
              <button onClick={() => setSubjects((p) => p.filter((x) => x !== s))}><X size={13} /></button>
            </span>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={subjInput}
            onChange={(e) => setSubjInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubject()}
            placeholder="e.g. Operating Systems"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button onClick={addSubject} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1">
            <Plus size={15} /> Add
          </button>
        </div>

        <button
          onClick={runAllocate}
          disabled={allocLoading || faculty.length === 0}
          className="gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {allocLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Recommend Allocation
        </button>

        {allocError && !allocLoading && <div className="mt-5"><AIErrorBanner error={allocError} onRetry={runAllocate} /></div>}
        {advice && !allocLoading && (
          <div className="mt-5"><HODAdviceCard advice={advice} /></div>
        )}
      </div>
    </div>
  );
}
