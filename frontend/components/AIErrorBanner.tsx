"use client";
import { ApolloError } from "@apollo/client";
import { AlertTriangle, RefreshCw } from "lucide-react";

/** Friendly inline banner for AI/GraphQL errors (e.g. Gemini 503 overloaded). */
export function AIErrorBanner({ error, onRetry }: { error?: ApolloError | Error | null; onRetry?: () => void }) {
  if (!error) return null;
  const msg = error.message ?? "";
  const overloaded = /503|UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED|429/i.test(msg);
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-900">
          {overloaded ? "The AI model is busy right now" : "Something went wrong"}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          {overloaded
            ? "Gemini is experiencing high demand. This is usually temporary — please try again in a moment."
            : msg || "Please try again."}
        </p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg px-2.5 py-1.5 transition-colors flex-shrink-0">
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}
