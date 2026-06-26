"use client";
import { Lightbulb, AlertTriangle, CheckSquare, FileText } from "lucide-react";
import clsx from "clsx";

export interface HODAdvice {
  summary: string;
  recommendations: string[];
  risks: string[];
  actionItems: string[];
  priority: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  High: "text-red-700 bg-red-50 border-red-200",
  Medium: "text-amber-700 bg-amber-50 border-amber-200",
  Low: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

export function HODAdviceCard({ advice }: { advice: HODAdvice }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-purple-50">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-violet-600" />
          <span className="font-semibold text-gray-900 text-sm">HOD Analysis</span>
        </div>
        <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-bold border", PRIORITY_COLOR[advice.priority] ?? PRIORITY_COLOR.Medium)}>
          {advice.priority} Priority
        </span>
      </div>

      <div className="p-5 space-y-4">
        {advice.summary && (
          <p className="text-sm text-gray-700 leading-relaxed">{advice.summary}</p>
        )}

        {advice.recommendations.length > 0 && (
          <Section icon={Lightbulb} color="text-violet-600" title="Recommendations" items={advice.recommendations} />
        )}
        {advice.risks.length > 0 && (
          <Section icon={AlertTriangle} color="text-red-500" title="Risks & Mitigation" items={advice.risks} />
        )}
        {advice.actionItems.length > 0 && (
          <Section icon={CheckSquare} color="text-emerald-600" title="Action Items" items={advice.actionItems} />
        )}
      </div>
    </div>
  );
}

function Section({ icon: Icon, color, title, items }: {
  icon: React.ElementType; color: string; title: string; items: string[];
}) {
  return (
    <div>
      <p className={clsx("text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5", color)}>
        <Icon size={13} /> {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
            <span className={clsx("mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0", color.replace("text-", "bg-"))} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
