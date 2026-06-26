"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client";
import toast from "react-hot-toast";
import {
  ArrowLeft, Pencil, Copy, CheckCircle, XCircle, Archive, FileText,
  Users, Clock, BarChart3, CalendarDays, BookOpen, ChevronRight, Zap,
} from "lucide-react";
import { ASSIGNMENT } from "@/lib/graphql/queries";
import { UPDATE_ASSIGNMENT_STATUS, CLONE_ASSIGNMENT } from "@/lib/graphql/mutations";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT:    { label: "Draft",    className: "bg-gray-100 text-gray-600" },
  ACTIVE:   { label: "Active",   className: "bg-green-100 text-green-700" },
  CLOSED:   { label: "Closed",   className: "bg-amber-100 text-amber-700" },
  ARCHIVED: { label: "Archived", className: "bg-slate-100 text-slate-500" },
};

const TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT: "Assignment", INTERNAL_ASSESSMENT: "Internal Assessment",
  LAB_RECORD: "Lab Record", DESCRIPTIVE_EXAM: "Descriptive Exam",
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function InfoCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "rubric">("overview");

  const { data, loading } = useQuery(ASSIGNMENT, { variables: { id } });
  const [updateStatus, { loading: updatingStatus }] = useMutation(UPDATE_ASSIGNMENT_STATUS, { refetchQueries: ["Assignment", "Assignments"] });
  const [cloneAssignment] = useMutation(CLONE_ASSIGNMENT, { refetchQueries: ["Assignments"] });

  const a = data?.assignment;

  async function changeStatus(status: string) {
    try {
      await updateStatus({ variables: { id, status } });
      toast.success(`Status changed to ${STATUS_CONFIG[status]?.label ?? status}`);
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  async function handleClone() {
    try {
      const { data: r } = await cloneAssignment({ variables: { id } });
      toast.success("Cloned as draft");
      router.push(`/assignments/${r.cloneAssignment.id}`);
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!a) return <div className="p-8 text-gray-500">Assignment not found.</div>;

  const sc = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.DRAFT;

  const statusActions = [];
  if (a.status === "DRAFT") statusActions.push({ label: "Publish & Activate", icon: Zap, status: "ACTIVE", className: "gradient-brand text-white hover:opacity-90" });
  if (a.status === "ACTIVE") statusActions.push({ label: "Close Submissions", icon: XCircle, status: "CLOSED", className: "border border-amber-300 text-amber-700 hover:bg-amber-50" });
  if (a.status === "CLOSED") {
    statusActions.push({ label: "Reactivate", icon: CheckCircle, status: "ACTIVE", className: "border border-green-300 text-green-700 hover:bg-green-50" });
    statusActions.push({ label: "Archive", icon: Archive, status: "ARCHIVED", className: "border border-gray-300 text-gray-600 hover:bg-gray-50" });
  }
  if (a.status === "ARCHIVED") statusActions.push({ label: "Restore to Draft", icon: FileText, status: "DRAFT", className: "border border-gray-300 text-gray-600 hover:bg-gray-50" });

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <button onClick={() => router.push("/assignments")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={15} /> Assignments
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
              {TYPE_LABELS[a.assignmentType]}
            </span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${sc.className}`}>
              {sc.label}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-snug">{a.title}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {[a.subject, a.semester && `Sem ${a.semester}`, a.section && `Sec ${a.section}`].filter(Boolean).join(" · ") || "No details"}
            {" · "} Created {fmt(a.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {statusActions.map((sa) => (
            <button key={sa.status} disabled={updatingStatus} onClick={() => changeStatus(sa.status)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${sa.className}`}>
              <sa.icon size={14} /> {sa.label}
            </button>
          ))}
          <button onClick={handleClone} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
            <Copy size={14} /> Clone
          </button>
          <button onClick={() => router.push(`/assignments/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-violet-300 text-violet-700 hover:bg-violet-50">
            <Pencil size={14} /> Edit
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <InfoCard label="Submissions" value={a.submissionCount} />
        <InfoCard label="Pending Review" value={a.pendingReviewCount} sub={a.pendingReviewCount > 0 ? "needs attention" : "all clear"} />
        <InfoCard label="Total Marks" value={a.rubric?.totalMarks ?? "—"} />
        <InfoCard label="Criteria" value={a.rubric?.criteria?.length ?? 0} sub="rubric dimensions" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["overview", "rubric"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t === "overview" ? "Overview" : "Rubric & Scoring"}
          </button>
        ))}
        {a.status === "ACTIVE" || a.submissionCount > 0 ? (
          <button onClick={() => router.push(`/grading?assignment=${id}`)}
            className="ml-auto flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-violet-600 hover:text-violet-800">
            Grading Queue <ChevronRight size={14} />
          </button>
        ) : null}
      </div>

      {tab === "overview" && (
        <div className="space-y-5">
          {/* Schedule */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><CalendarDays size={16} className="text-violet-500" /> Schedule</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-500 mb-0.5">Open Date</p><p className="font-medium text-gray-900">{fmt(a.openDate)}</p></div>
              <div><p className="text-gray-500 mb-0.5">Due Date</p><p className="font-medium text-gray-900">{fmt(a.dueDate)}</p></div>
              {a.lateSubmissionPenalty != null && (
                <div><p className="text-gray-500 mb-0.5">Late Penalty</p><p className="font-medium text-gray-900">{a.lateSubmissionPenalty}% per day</p></div>
              )}
            </div>
          </section>

          {/* Question */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><BookOpen size={16} className="text-violet-500" /> Question</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{a.question}</p>
          </section>

          {/* Model Answer */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Model Answer</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{a.modelAnswer}</p>
          </section>

          {/* Instructions block */}
          {(a.instructions || a.submissionGuidelines || a.referenceMaterials || a.notesForStudents) && (
            <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Student Instructions</h3>
              {a.instructions && (
                <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Instructions</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.instructions}</p></div>
              )}
              {a.submissionGuidelines && (
                <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Submission Guidelines</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.submissionGuidelines}</p></div>
              )}
              {a.referenceMaterials && (
                <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reference Materials</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.referenceMaterials}</p></div>
              )}
              {a.notesForStudents && (
                <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes for Students</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.notesForStudents}</p></div>
              )}
            </section>
          )}
        </div>
      )}

      {tab === "rubric" && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">{a.rubric?.name}</h3>
              <p className="text-sm text-gray-500">Total: {a.rubric?.totalMarks} marks</p>
            </div>
            <button onClick={() => router.push(`/assignments/${id}/edit`)}
              className="text-sm text-violet-600 hover:text-violet-800 flex items-center gap-1">
              <Pencil size={13} /> Edit rubric
            </button>
          </div>
          <div className="space-y-3">
            {a.rubric?.criteria?.map((c: { id: string; name: string; description: string | null; maxMarks: number }, idx: number) => (
              <div key={c.id} className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 border border-gray-100">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                  {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                </div>
                <span className="shrink-0 text-sm font-semibold text-violet-700">{c.maxMarks} marks</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
