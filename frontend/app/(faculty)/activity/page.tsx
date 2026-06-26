"use client";
import { useQuery } from "@apollo/client";
import { Activity, CheckCircle, Edit3, Send, RotateCcw, Clock } from "lucide-react";
import { ACTIVITY_LOG } from "@/lib/graphql/queries";

interface LogEntry {
  id: string;
  action: string;
  entityType: string;
  entityTitle: string;
  aiScore: number | null;
  humanScore: number | null;
  note: string | null;
  timestamp: string;
}

const actionConfig: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  approve:       { label: "Approved Grade",       icon: CheckCircle,  color: "text-green-600" },
  bulk_approve:  { label: "Bulk Approved",        icon: CheckCircle,  color: "text-green-600" },
  override:      { label: "Overrode Grade",       icon: Edit3,        color: "text-blue-600" },
  published:     { label: "Published to Student", icon: Send,         color: "text-violet-600" },
  regrade:       { label: "Requested Regrade",    icon: RotateCcw,    color: "text-amber-600" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function ActivityLogPage() {
  const { data, loading } = useQuery(ACTIVITY_LOG, { variables: { limit: 100 } });
  const logs: LogEntry[] = data?.activityLog ?? [];

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-gray-500 mt-1">A record of all your grading actions.</p>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="text-center py-20">
          <Activity size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">No activity yet</p>
          <p className="text-sm text-gray-400 mt-1">Actions you take on grades will appear here.</p>
        </div>
      )}

      <div className="relative">
        {logs.length > 0 && (
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
        )}
        <div className="space-y-4">
          {logs.map((log) => {
            const cfg = actionConfig[log.action] ?? { label: log.action, icon: Activity, color: "text-gray-500" };
            const Icon = cfg.icon;
            return (
              <div key={log.id} className="flex items-start gap-4 relative">
                <div className="relative z-10 flex-shrink-0 w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center">
                  <Icon size={16} className={cfg.color} />
                </div>
                <div className="flex-1 bg-white rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 text-sm">{cfg.label}</p>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} /> {fmt(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{log.entityTitle}</p>
                  {(log.aiScore != null || log.humanScore != null) && (
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      {log.aiScore != null && <span>AI: <span className="font-medium text-gray-600">{log.aiScore}</span></span>}
                      {log.humanScore != null && <span>Final: <span className="font-medium text-gray-600">{log.humanScore}</span></span>}
                    </div>
                  )}
                  {log.note && <p className="text-xs text-gray-400 mt-1 italic">{log.note}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
