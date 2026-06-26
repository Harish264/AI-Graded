"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import {
  Plus, BookOpen, Clock, Users, Search, Copy, Pencil, MoreVertical,
  Archive, CheckCircle, XCircle, FileText, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { ASSIGNMENTS } from "@/lib/graphql/queries";
import { UPDATE_ASSIGNMENT_STATUS, CLONE_ASSIGNMENT } from "@/lib/graphql/mutations";

const TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT: "Assignment",
  INTERNAL_ASSESSMENT: "Internal Assessment",
  LAB_RECORD: "Lab Record",
  DESCRIPTIVE_EXAM: "Descriptive Exam",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT:    { label: "Draft",    className: "bg-gray-100 text-gray-600" },
  ACTIVE:   { label: "Active",   className: "bg-green-100 text-green-700" },
  CLOSED:   { label: "Closed",   className: "bg-amber-100 text-amber-700" },
  ARCHIVED: { label: "Archived", className: "bg-slate-100 text-slate-500" },
};

const FILTERS = ["All", "DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"] as const;
type Filter = typeof FILTERS[number];

interface Assignment {
  id: string; title: string; assignmentType: string; status: string;
  subject: string | null; semester: string | null; section: string | null;
  isActive: boolean; dueDate: string | null; openDate: string | null;
  submissionCount: number; pendingReviewCount: number; updatedAt: string;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ActionMenu({ assignment, onStatusChange, onClone }: {
  assignment: Assignment;
  onStatusChange: (id: string, status: string) => void;
  onClone: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const actions = [];
  if (assignment.status === "DRAFT") {
    actions.push({ label: "Publish & Activate", icon: CheckCircle, status: "ACTIVE", color: "text-green-600" });
  }
  if (assignment.status === "ACTIVE") {
    actions.push({ label: "Close Submissions", icon: XCircle, status: "CLOSED", color: "text-amber-600" });
  }
  if (assignment.status === "CLOSED") {
    actions.push({ label: "Reactivate", icon: CheckCircle, status: "ACTIVE", color: "text-green-600" });
    actions.push({ label: "Archive", icon: Archive, status: "ARCHIVED", color: "text-slate-500" });
  }
  if (assignment.status === "ARCHIVED") {
    actions.push({ label: "Restore to Draft", icon: FileText, status: "DRAFT", color: "text-gray-600" });
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 text-sm">
            {actions.map((a) => (
              <button
                key={a.status}
                onClick={(e) => { e.stopPropagation(); onStatusChange(assignment.id, a.status); setOpen(false); }}
                className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 ${a.color}`}
              >
                <a.icon size={14} /> {a.label}
              </button>
            ))}
            <hr className="my-1 border-gray-100" />
            <button
              onClick={(e) => { e.stopPropagation(); onClone(assignment.id); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-600"
            >
              <Copy size={14} /> Clone Assignment
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AssignmentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("All");

  const { data, loading } = useQuery(ASSIGNMENTS);
  const [updateStatus] = useMutation(UPDATE_ASSIGNMENT_STATUS, { refetchQueries: ["Assignments"] });
  const [cloneAssignment] = useMutation(CLONE_ASSIGNMENT, { refetchQueries: ["Assignments"] });

  const allAssignments: Assignment[] = data?.assignments ?? [];

  const filtered = useMemo(() => {
    return allAssignments.filter((a) => {
      const matchesFilter = activeFilter === "All" || a.status === activeFilter;
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        a.title.toLowerCase().includes(q) ||
        (a.subject ?? "").toLowerCase().includes(q) ||
        (a.semester ?? "").toLowerCase().includes(q) ||
        (a.section ?? "").toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [allAssignments, activeFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: allAssignments.length };
    for (const f of FILTERS.slice(1)) c[f] = allAssignments.filter((a) => a.status === f).length;
    return c;
  }, [allAssignments]);

  async function handleStatusChange(id: string, status: string) {
    try {
      await updateStatus({ variables: { id, status } });
      toast.success(`Assignment ${STATUS_CONFIG[status]?.label ?? status}`);
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  async function handleClone(id: string) {
    try {
      await cloneAssignment({ variables: { id } });
      toast.success("Assignment cloned as draft");
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
          <p className="text-gray-500 mt-1">Manage all your assessments in one place.</p>
        </div>
        <button
          onClick={() => router.push("/assignments/new")}
          className="flex items-center gap-2 gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> New Assignment
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, subject, section…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex rounded-xl bg-gray-100 p-1 gap-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeFilter === f ? "bg-white shadow text-violet-700" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f === "All" ? "All" : STATUS_CONFIG[f].label}{" "}
              <span className={`ml-1 ${activeFilter === f ? "text-violet-500" : "text-gray-400"}`}>
                {counts[f] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">
            {search || activeFilter !== "All" ? "No assignments match your filters" : "No assignments yet"}
          </p>
          {!search && activeFilter === "All" && (
            <button
              onClick={() => router.push("/assignments/new")}
              className="mt-6 flex items-center gap-2 mx-auto gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus size={16} /> Create Assignment
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const sc = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.DRAFT;
            return (
              <div
                key={a.id}
                onClick={() => router.push(`/assignments/${a.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-violet-300 hover:shadow-md transition-all flex flex-col"
              >
                {/* Top row: type badge + status + actions */}
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                      {TYPE_LABELS[a.assignmentType]}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sc.className}`}>
                      {sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => router.push(`/assignments/${a.id}/edit`)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <ActionMenu assignment={a} onStatusChange={handleStatusChange} onClone={handleClone} />
                  </div>
                </div>

                {/* Title + subtitle */}
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 leading-snug">{a.title}</h3>
                <p className="text-sm text-gray-500 mb-3">
                  {[a.subject, a.semester && `Sem ${a.semester}`, a.section && `Sec ${a.section}`].filter(Boolean).join(" · ") || "No details"}
                </p>

                {/* Due date */}
                {a.dueDate && (
                  <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                    <Clock size={12} /> Due {formatDate(a.dueDate)}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-auto pt-3 border-t border-gray-100">
                  <span className="flex items-center gap-1"><Users size={13} /> {a.submissionCount}</span>
                  {a.pendingReviewCount > 0 && (
                    <span
                      onClick={(e) => { e.stopPropagation(); router.push(`/grading?assignment=${a.id}`); }}
                      className="flex items-center gap-1 text-yellow-600 font-medium hover:underline"
                    >
                      <Clock size={13} /> {a.pendingReviewCount} pending
                    </span>
                  )}
                  {a.status === "ACTIVE" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/grading?assignment=${a.id}`); }}
                      className="ml-auto text-xs text-violet-600 hover:text-violet-800 font-medium"
                    >
                      View Queue →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
