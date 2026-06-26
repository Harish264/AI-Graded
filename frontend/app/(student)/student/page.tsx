"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { STUDENT_ASSIGNMENTS, MY_SUBMISSIONS } from "@/lib/graphql/queries";
import { BookOpen, Clock, CheckCircle, Edit3, Award, Circle, Lock, CalendarClock } from "lucide-react";
import clsx from "clsx";

const TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT: "Assignment", INTERNAL_ASSESSMENT: "Internal Assessment",
  LAB_RECORD: "Lab Record", DESCRIPTIVE_EXAM: "Descriptive Exam",
};

type Progress = "not_started" | "in_progress" | "submitted" | "graded";

const PROGRESS_CONFIG: Record<Progress, { label: string; color: string; icon: React.ElementType; pct: number }> = {
  not_started: { label: "Not Started", color: "text-gray-500 bg-gray-100", icon: Circle, pct: 0 },
  in_progress: { label: "In Progress", color: "text-blue-600 bg-blue-50", icon: Edit3, pct: 40 },
  submitted: { label: "Submitted", color: "text-yellow-600 bg-yellow-50", icon: Clock, pct: 75 },
  graded: { label: "Graded", color: "text-emerald-600 bg-emerald-50", icon: Award, pct: 100 },
};

interface Assignment {
  id: string; title: string; assignmentType: string;
  subject: string | null; semester: string | null; section: string | null;
  openDate: string | null; dueDate: string | null; lateSubmissionPenalty: number | null;
}
interface SubSummary {
  assignmentId: string; gradeStatus: string | null; submissionStatus: string;
}

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const { data, loading } = useQuery(STUDENT_ASSIGNMENTS);
  const { data: subsData } = useQuery(MY_SUBMISSIONS, { errorPolicy: "ignore" });
  const assignments: Assignment[] = data?.studentAssignments ?? [];
  const submissions: SubSummary[] = subsData?.mySubmissions ?? [];

  const [drafts, setDrafts] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ids = new Set<string>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("gradeai_draft_")) ids.add(key.replace("gradeai_draft_", ""));
      }
    } catch { /* ignore */ }
    setDrafts(ids);
  }, []);

  function getProgress(assignmentId: string): Progress {
    const sub = submissions.find((s) => s.assignmentId === assignmentId);
    if (sub) {
      if (sub.gradeStatus === "PUBLISHED" || sub.gradeStatus === "APPROVED") return "graded";
      return "submitted";
    }
    if (drafts.has(assignmentId)) return "in_progress";
    return "not_started";
  }

  // Faculty-controlled window: "open" | "not_open" (before openDate) | "closed" (past due, no late penalty)
  function getWindow(a: Assignment): "open" | "not_open" | "closed" {
    const now = Date.now();
    if (a.openDate && now < new Date(a.openDate).getTime()) return "not_open";
    if (a.dueDate && now > new Date(a.dueDate).getTime() && !a.lateSubmissionPenalty) return "closed";
    return "open";
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>
        <p className="text-gray-500 mt-1">Submit your answers and view AI-powered feedback.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p>No assignments available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((a) => {
            const progress = getProgress(a.id);
            const cfg = PROGRESS_CONFIG[progress];
            const Icon = cfg.icon;
            const done = progress === "graded" || progress === "submitted";
            const win = getWindow(a);
            // Window only blocks new attempts; already-submitted/graded work stays viewable
            const blocked = !done && win !== "open";
            const clickable = !blocked;
            return (
              <div key={a.id} onClick={() => clickable && router.push(`/student/assignment/${a.id}`)}
                className={clsx(
                  "bg-white rounded-xl border border-gray-200 p-6 transition-all",
                  clickable ? "cursor-pointer hover:border-violet-300 hover:shadow-md" : "opacity-80"
                )}>
                <div className="flex items-start justify-between mb-3">
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">{TYPE_LABELS[a.assignmentType]}</span>
                  {blocked ? (
                    win === "closed" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-red-700 bg-red-50"><Lock size={11} /> Closed</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-gray-500 bg-gray-100"><CalendarClock size={11} /> Not Open</span>
                    )
                  ) : (
                    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
                      <Icon size={11} /> {cfg.label}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{a.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{[a.subject, a.semester, a.section].filter(Boolean).join(" · ") || "—"}</p>

                {/* Progress bar */}
                <div className="h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                  <div className={clsx("h-full rounded-full transition-all",
                    progress === "graded" ? "bg-emerald-500" : progress === "submitted" ? "bg-yellow-400" : progress === "in_progress" ? "bg-blue-400" : "bg-gray-200")}
                    style={{ width: `${cfg.pct}%` }} />
                </div>

                {win === "not_open" && a.openDate ? (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <CalendarClock size={14} /> Opens {new Date(a.openDate).toLocaleString("en-IN")}
                  </div>
                ) : a.dueDate ? (
                  <div className={clsx("flex items-center gap-1 text-sm", win === "closed" ? "text-red-500" : "text-gray-500")}>
                    <Clock size={14} /> {win === "closed" ? "Closed on" : "Due"} {new Date(a.dueDate).toLocaleString("en-IN")}
                    {a.lateSubmissionPenalty && win === "open" ? <span className="text-amber-600">· late penalty applies</span> : null}
                  </div>
                ) : null}

                <button
                  disabled={blocked}
                  className={clsx(
                    "mt-4 px-4 py-1.5 rounded-lg text-sm font-medium transition-opacity",
                    blocked ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : done ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      : "gradient-brand text-white hover:opacity-90"
                  )}>
                  {win === "closed" && !done ? "Submission Closed"
                    : win === "not_open" && !done ? "Not Open Yet"
                    : progress === "graded" ? "View Result"
                    : progress === "submitted" ? "View Submission"
                    : progress === "in_progress" ? "Continue" : "Start Assignment"}
                </button>
                {progress === "graded" && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <CheckCircle size={12} /> Feedback available
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
