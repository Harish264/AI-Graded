"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@apollo/client";
import { ASK_ASSISTANT, GENERATE_PRACTICE_QUESTIONS, type ChatProvider } from "@/lib/graphql/mutations";
import { useAuthStore } from "@/lib/store";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot, X, Send, Minimize2, Maximize2, Loader2, Sparkles,
  ChevronDown, ShieldCheck, Zap
} from "lucide-react";
import clsx from "clsx";

interface Message {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; data: string } | null;
}

interface ActionData {
  type: string;
  title?: string;
  question?: string;
  modelAnswer?: string;
  rubricName?: string;
  criteria?: { name: string; description: string; maxMarks: number }[];
  questions?: string[];
  [key: string]: unknown;
}

const PROVIDERS: { value: ChatProvider; label: string; color: string }[] = [
  { value: "GROQ",        label: "Groq",        color: "text-orange-500" },
  { value: "OPENROUTER",  label: "OpenRouter",  color: "text-blue-500"   },
  { value: "HUGGINGFACE", label: "HuggingFace", color: "text-yellow-500" },
];

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [provider, setProvider] = useState<ChatProvider>("GROQ");
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  const [askAssistant, { loading }] = useMutation(ASK_ASSISTANT);
  const [genPractice, { loading: practiceLoading }] = useMutation(GENERATE_PRACTICE_QUESTIONS);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close provider menu on outside click
  useEffect(() => {
    if (!showProviderMenu) return;
    const handler = () => setShowProviderMenu(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showProviderMenu]);

  const getPageContext = () => {
    if (pathname.startsWith("/dashboard")) return "faculty_dashboard";
    if (pathname.startsWith("/assignments")) return "assignments";
    if (pathname.startsWith("/grading")) return "grading_queue";
    if (pathname.startsWith("/analytics")) return "analytics";
    if (pathname.startsWith("/student/grades")) return "student_grades";
    if (pathname.startsWith("/student")) return "student_assignments";
    return "general";
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const { data } = await askAssistant({
        variables: {
          input: {
            message: text,
            history,
            pageContext: getPageContext(),
            provider,
          },
        },
      });
      const res = data?.askAssistant;
      setMessages((prev) => [...prev, { role: "assistant", content: res.message, action: res.action }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, loading, messages, pathname, provider]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleAction = async (action: { type: string; data: string }) => {
    try {
      const actionData: ActionData = JSON.parse(action.data);
      if (actionData.type === "generate_assignment") {
        sessionStorage.setItem("ai_assignment_draft", JSON.stringify(actionData));
        router.push("/assignments/new?source=ai");
        setOpen(false);
      } else if (actionData.type === "practice_questions") {
        const topic = (actionData.topic as string) ?? "your recent topics";
        const difficulty = (actionData.difficulty as string) ?? "Mixed";
        try {
          const { data } = await genPractice({
            variables: { topic, subject: (actionData.subject as string) ?? null, difficulty, count: 5 },
          });
          const qs = data?.generatePracticeQuestions ?? [];
          const text = qs.length
            ? qs
                .map(
                  (q: { question: string; difficulty: string; hint: string }, i: number) =>
                    `**${i + 1}. [${q.difficulty}]** ${q.question}\n   💡 _Hint: ${q.hint}_`
                )
                .join("\n\n")
            : "I couldn't generate questions right now. Try again in a moment.";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Here are practice questions on **${topic}**:\n\n${text}` },
          ]);
        } catch {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, I couldn't generate practice questions right now. Please try again." },
          ]);
        }
      }
    } catch {
      // ignore parse errors
    }
  };

  const isFaculty = user?.role !== "STUDENT";
  const currentProvider = PROVIDERS.find((p) => p.value === provider)!;

  const greeting =
    messages.length === 0
      ? isFaculty
        ? "Hi! I'm your GradeAI assistant. Ask me about assignments, grading insights, class performance, or let me help generate new assignments!"
        : "Hi! I'm your AI Learning Assistant. I can explain concepts, help you understand your grades, review your code, and create practice questions. I'm here to help you learn!"
      : null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-brand shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
          title="AI Assistant"
        >
          <Bot size={24} className="text-white" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={clsx(
            "fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all duration-200",
            expanded ? "w-[480px] h-[700px]" : "w-[360px] h-[560px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-violet-600 to-purple-600 rounded-t-2xl">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">GradeAI Assistant</p>
              <p className="text-white/70 text-xs">{isFaculty ? "Faculty Mode" : "Student Learning Mode"}</p>
            </div>

            {/* Provider selector */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowProviderMenu((s) => !s)}
                className="flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-lg px-2 py-1 text-white text-xs transition-colors"
                title="Select AI provider"
              >
                <Zap size={11} />
                <span>{currentProvider.label}</span>
                <ChevronDown size={11} />
              </button>
              {showProviderMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 min-w-[130px]">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => { setProvider(p.value); setShowProviderMenu(false); }}
                      className={clsx(
                        "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2",
                        p.value === provider ? "font-semibold bg-violet-50" : "text-gray-700"
                      )}
                    >
                      <span className={clsx("w-1.5 h-1.5 rounded-full", p.value === provider ? "bg-violet-600" : "bg-gray-300")} />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setExpanded((e) => !e)} className="text-white/70 hover:text-white p-1">
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white p-1">
              <X size={16} />
            </button>
          </div>

          {/* Student restriction banner */}
          {!isFaculty && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100">
              <ShieldCheck size={14} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                <span className="font-semibold">Learning mode:</span> I explain and guide — I don&apos;t provide solutions or completed assignments.
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {greeting && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={14} className="text-violet-600" />
                </div>
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-700 max-w-[85%]">
                  {greeting}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={clsx("flex gap-2", msg.role === "user" ? "justify-end" : "")}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={14} className="text-violet-600" />
                  </div>
                )}
                <div
                  className={clsx(
                    "rounded-2xl px-3 py-2 text-sm max-w-[85%]",
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-gray-50 text-gray-700 rounded-tl-sm"
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.action && (
                    <button
                      onClick={() => msg.action && handleAction(msg.action)}
                      disabled={practiceLoading}
                      className="mt-2 w-full text-center text-xs font-medium bg-violet-600 text-white rounded-lg py-1.5 px-3 hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {practiceLoading && <Loader2 size={12} className="animate-spin" />}
                      {msg.action.type === "generate_assignment"
                        ? "Use This Assignment →"
                        : msg.action.type === "practice_questions"
                        ? "Generate Practice Questions"
                        : "Apply"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-violet-600" />
                </div>
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2">
                  <Loader2 size={16} className="text-violet-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isFaculty
                    ? "Ask me anything..."
                    : "Ask for explanations, hints, concept help..."
                }
                rows={1}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none max-h-28"
                style={{ minHeight: "24px" }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
