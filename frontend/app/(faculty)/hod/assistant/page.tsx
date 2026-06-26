"use client";
import { useState } from "react";
import { useMutation } from "@apollo/client";
import { HOD_ASSISTANT } from "@/lib/graphql/mutations";
import { HODAdviceCard, HODAdvice } from "@/components/HODAdviceCard";
import { Bot, Send, Loader2 } from "lucide-react";

const SUGGESTIONS = [
  "Which subjects are underperforming and why?",
  "How should I redistribute faculty workload this term?",
  "Which students need urgent academic intervention?",
  "Summarize department performance for the principal.",
  "What are the biggest risks to our pass percentage?",
];

interface Turn { query: string; advice?: HODAdvice; loading: boolean }

export default function HODAssistantPage() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [ask] = useMutation(HOD_ASSISTANT);

  async function send(q: string) {
    const query = q.trim();
    if (!query) return;
    setInput("");
    const idx = turns.length;
    setTurns((p) => [...p, { query, loading: true }]);
    try {
      const { data } = await ask({ variables: { query } });
      setTurns((p) => p.map((t, i) => i === idx ? { ...t, advice: data?.hodAssistant, loading: false } : t));
    } catch {
      setTurns((p) => p.map((t, i) => i === idx ? { ...t, loading: false, advice: { summary: "Sorry, I couldn't process that. Please try again.", recommendations: [], risks: [], actionItems: [], priority: "Low" } } : t));
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI HOD Assistant</h1>
          <p className="text-gray-500 text-sm">Ask anything about your department — answers are grounded in real data.</p>
        </div>
      </div>

      {turns.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="text-left text-sm bg-gray-50 hover:bg-violet-50 hover:text-violet-700 text-gray-600 rounded-lg px-3 py-2 transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      <div className="space-y-5">
        {turns.map((t, i) => (
          <div key={i} className="space-y-3">
            <div className="flex justify-end">
              <div className="bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 text-sm max-w-[80%]">{t.query}</div>
            </div>
            {t.loading ? (
              <div className="flex items-center gap-2 text-violet-500 text-sm">
                <Loader2 size={16} className="animate-spin" /> Analyzing department data…
              </div>
            ) : t.advice ? (
              <HODAdviceCard advice={t.advice} />
            ) : null}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="sticky bottom-4 bg-white rounded-xl border border-gray-200 shadow-sm p-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask about faculty, students, performance, accreditation…"
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none px-2 py-2 max-h-32"
        />
        <button onClick={() => send(input)} disabled={!input.trim()} className="w-9 h-9 rounded-lg gradient-brand flex items-center justify-center disabled:opacity-40 flex-shrink-0">
          <Send size={15} className="text-white" />
        </button>
      </div>
    </div>
  );
}
