"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle, Clock, Filter, CheckSquare, Square, Loader2, Users } from "lucide-react";
import toast from "react-hot-toast";
import { GRADING_QUEUE, ASSIGNMENTS } from "@/lib/graphql/queries";
import { BULK_APPROVE_GRADES } from "@/lib/graphql/mutations";

interface QueueItem {
  submissionId: string;
  studentName: string;
  studentEmail: string;
  assignmentTitle: string;
  assignmentId: string;
  aiScore: number | null;
  confidence: number | null;
  needsReview: boolean;
  status: string;
  submittedAt: string;
}

export default function GradingQueuePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [filterAssignment, setFilterAssignment] = useState(params.get("assignment") ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: queueData, loading, refetch } = useQuery(GRADING_QUEUE, {
    variables: { assignmentId: filterAssignment || undefined },
    pollInterval: 15_000,
  });
  const { data: assignData } = useQuery(ASSIGNMENTS);
  const [bulkApprove, { loading: approving }] = useMutation(BULK_APPROVE_GRADES);

  const queue: QueueItem[] = queueData?.gradingQueue ?? [];
  const assignments = assignData?.assignments ?? [];
  const flagged = queue.filter((q) => q.needsReview);
  const normal = queue.filter((q) => !q.needsReview);

  const allIds = useMemo(() => queue.map((q) => q.submissionId), [queue]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  async function handleBulkApprove(ids: string[]) {
    if (!ids.length) return;
    try {
      const { data } = await bulkApprove({ variables: { submissionIds: ids } });
      toast.success(`${data.bulkApproveGrades} grade${data.bulkApproveGrades !== 1 ? "s" : ""} approved`);
      setSelected(new Set());
      refetch();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed");
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grading Queue</h1>
          <p className="text-gray-500 mt-1">Review AI-graded submissions. Nothing publishes until you approve.</p>
        </div>
        {flagged.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
            <AlertTriangle size={15} /> {flagged.length} flagged for review
          </div>
        )}
      </div>

      {/* Filters + Bulk Actions */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={filterAssignment} onChange={(e) => setFilterAssignment(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All Assignments</option>
          {assignments.map((a: { id: string; title: string }) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>

        <span className="text-sm text-gray-500 flex items-center gap-1.5"><Users size={14} />{queue.length} pending</span>

        {someSelected && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500">{selected.size} selected</span>
            <button onClick={() => handleBulkApprove(Array.from(selected))} disabled={approving}
              className="flex items-center gap-1.5 gradient-brand text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Approve Selected
            </button>
            <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
              Clear
            </button>
          </div>
        )}

        {!someSelected && queue.length > 0 && (
          <button onClick={() => handleBulkApprove(allIds)} disabled={approving}
            className="ml-auto flex items-center gap-1.5 border border-violet-300 text-violet-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-violet-50 disabled:opacity-50">
            {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
            Approve All ({queue.length})
          </button>
        )}
      </div>

      {/* Select All row */}
      {queue.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 bg-gray-50 rounded-lg border border-gray-200 mb-3 text-sm text-gray-600">
          <button onClick={toggleAll} className="flex items-center gap-2 hover:text-gray-900">
            {allSelected ? <CheckSquare size={16} className="text-violet-600" /> : <Square size={16} />}
            Select all
          </button>
        </div>
      )}

      {/* Queue list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : queue.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-400 opacity-60" />
          <p className="text-lg font-medium text-gray-600">Queue is clear!</p>
          <p className="text-sm text-gray-400 mt-1">All submissions have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {flagged.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-red-500" />
                <span className="text-sm font-semibold text-red-600">Flagged for Review — Low Confidence</span>
              </div>
              {flagged.map((item) => (
                <QueueRow key={item.submissionId} item={item} selected={selected.has(item.submissionId)}
                  onSelect={() => toggleSelect(item.submissionId)}
                  onReview={() => router.push(`/grading/${item.submissionId}`)} flagged />
              ))}
            </div>
          )}
          {normal.length > 0 && (
            <div>
              {flagged.length > 0 && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 ml-1">Standard Queue</p>}
              {normal.map((item) => (
                <QueueRow key={item.submissionId} item={item} selected={selected.has(item.submissionId)}
                  onSelect={() => toggleSelect(item.submissionId)}
                  onReview={() => router.push(`/grading/${item.submissionId}`)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QueueRow({ item, onReview, onSelect, selected, flagged }: {
  item: QueueItem; onReview: () => void; onSelect: () => void;
  selected: boolean; flagged?: boolean;
}) {
  const confidencePct = item.confidence != null ? Math.round(item.confidence * 100) : null;
  return (
    <div className={`bg-white rounded-xl border px-5 py-4 flex items-center gap-3 mb-2 transition-colors ${flagged ? "border-red-200 bg-red-50" : selected ? "border-violet-300 bg-violet-50" : "border-gray-200 hover:border-gray-300"}`}>
      <button onClick={onSelect} className="shrink-0">
        {selected
          ? <CheckSquare size={18} className="text-violet-600" />
          : <Square size={18} className="text-gray-300 hover:text-gray-500" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{item.studentName}</p>
        <p className="text-sm text-gray-500 truncate">{item.assignmentTitle}</p>
      </div>
      <div className="hidden sm:flex items-center gap-4 text-sm">
        <div className="text-center">
          <p className="text-xs text-gray-400">AI Score</p>
          <p className="font-semibold text-gray-800">{item.aiScore?.toFixed(1) ?? "—"}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400">Confidence</p>
          <p className={`font-semibold text-sm ${(item.confidence ?? 1) < 0.75 ? "text-red-500" : "text-green-600"}`}>
            {confidencePct != null ? `${confidencePct}%` : "—"}
          </p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-1 text-xs text-gray-400">
        <Clock size={13} />{new Date(item.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
      </div>
      <button onClick={onReview} className="gradient-brand text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 shrink-0">
        Review
      </button>
    </div>
  );
}
