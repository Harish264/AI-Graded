"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client";
import toast from "react-hot-toast";
import {
  ArrowLeft, CheckCircle, Clock, CameraOff, AlertTriangle,
  Code2, FileText, Shield, Maximize2, Send, Eye, Hash, ChevronDown,
  Gauge, Timer, Tag, Target, Sparkles, Loader2, X, Square, CheckSquare,
  Lock, CalendarClock,
} from "lucide-react";
import { ASSIGNMENT, MY_SUBMISSION, STUDENT_GRADE, ASSIGNMENT_OVERVIEW } from "@/lib/graphql/queries";
import { SUBMIT_ANSWER, REVIEW_CODE } from "@/lib/graphql/mutations";

// ─── Constants ───────────────────────────────────────────
type Mode = "essay" | "coding";
type Stage = "select" | "lang" | "exam" | "submitted";
interface Violation { type: string; at: string }

interface Language {
  id: string;
  label: string;
  ext: string;
  placeholder: string;
  comment: string;   // comment syntax
  color: string;     // tailwind text color
}

const LANGUAGES: Language[] = [
  { id: "python",     label: "Python",       ext: ".py",   placeholder: "# Write your Python code here\n\ndef solution():\n    pass\n",                     comment: "#",   color: "text-yellow-400" },
  { id: "java",       label: "Java",         ext: ".java", placeholder: "// Write your Java code here\n\npublic class Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n", comment: "//", color: "text-orange-400" },
  { id: "cpp",        label: "C++",          ext: ".cpp",  placeholder: "// Write your C++ code here\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n",   comment: "//", color: "text-blue-400" },
  { id: "c",          label: "C",            ext: ".c",    placeholder: "// Write your C code here\n#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}\n",   comment: "//", color: "text-blue-300" },
  { id: "javascript", label: "JavaScript",   ext: ".js",   placeholder: "// Write your JavaScript code here\n\nfunction solution() {\n    \n}\n",              comment: "//", color: "text-yellow-300" },
  { id: "typescript", label: "TypeScript",   ext: ".ts",   placeholder: "// Write your TypeScript code here\n\nfunction solution(): void {\n    \n}\n",        comment: "//", color: "text-blue-500" },
  { id: "sql",        label: "SQL",          ext: ".sql",  placeholder: "-- Write your SQL query here\n\nSELECT *\nFROM table_name\nWHERE condition;\n",        comment: "--",  color: "text-cyan-400" },
  { id: "r",          label: "R",            ext: ".r",    placeholder: "# Write your R code here\n\nsolution <- function() {\n  \n}\n",                        comment: "#",   color: "text-blue-400" },
  { id: "matlab",     label: "MATLAB",       ext: ".m",    placeholder: "% Write your MATLAB code here\n\nfunction result = solution()\n    \nend\n",            comment: "%",   color: "text-orange-300" },
  { id: "pseudocode", label: "Pseudocode",   ext: ".txt",  placeholder: "// Write your algorithm in pseudocode\n\nBEGIN\n    \nEND\n",                          comment: "//", color: "text-gray-400" },
  { id: "bash",       label: "Bash / Shell", ext: ".sh",   placeholder: "#!/bin/bash\n# Write your shell script here\n\n",                                       comment: "#",   color: "text-green-400" },
  { id: "go",         label: "Go",           ext: ".go",   placeholder: "// Write your Go code here\npackage main\n\nimport \"fmt\"\n\nfunc main() {\n    \n}\n", comment: "//", color: "text-cyan-300" },
];

const LANGUAGE_MAP = Object.fromEntries(LANGUAGES.map((l) => [l.id, l]));

// ─── Helpers ─────────────────────────────────────────────
function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Code Editor ─────────────────────────────────────────
function CodeEditor({ value, onChange, language }: {
  value: string; onChange: (v: string) => void; language: Language;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lineCount = value.split("\n").length;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = taRef.current;
    if (!ta) return;
    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = value.substring(0, start) + "  " + value.substring(end);
      onChange(next);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const start = ta.selectionStart;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const indent = value.slice(lineStart).match(/^(\s*)/)?.[1] ?? "";
      const next = value.substring(0, start) + "\n" + indent + value.substring(start);
      onChange(next);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 1 + indent.length; });
    }
  }

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-gray-700 bg-[#1e1e2e]">
      {/* Editor header bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#181825] border-b border-gray-700">
        <span className={`text-xs font-bold ${language.color}`}>{language.label}</span>
        <span className="text-xs text-gray-500">{language.ext}</span>
        <span className="ml-auto text-xs text-gray-600">{lineCount} lines</span>
      </div>
      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden font-mono text-sm">
        {/* Line numbers */}
        <div className="select-none bg-[#181825] text-[#6c7086] text-right px-3 py-3 leading-6 min-w-[48px] overflow-hidden border-r border-gray-700 text-xs">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Textarea */}
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder={language.placeholder}
          className="flex-1 resize-none bg-transparent text-[#cdd6f4] caret-[#89b4fa] leading-6 py-3 px-3 focus:outline-none placeholder-[#45475a] text-sm"
          style={{ fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace" }}
        />
      </div>
    </div>
  );
}

// ─── Language Picker (inside Mode Selection flow) ─────────
function LanguagePicker({ onSelect, onBack }: {
  onSelect: (lang: Language) => void; onBack: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-gray-900 text-green-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Code2 size={14} /> Coding Mode
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose Your Language</h2>
          <p className="text-sm text-gray-500">Select the programming language you&apos;ll write your answer in. This cannot be changed during the exam.</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              onClick={() => onSelect(lang)}
              onMouseEnter={() => setHovered(lang.id)}
              onMouseLeave={() => setHovered(null)}
              className={`relative bg-white rounded-xl border-2 p-4 text-left transition-all ${hovered === lang.id ? "border-violet-400 shadow-md scale-[1.02]" : "border-gray-200"}`}
            >
              <div className={`text-xl font-bold mb-1 font-mono ${lang.color}`}>{lang.ext}</div>
              <div className="text-xs font-semibold text-gray-800">{lang.label}</div>
              {hovered === lang.id && (
                <div className="absolute inset-0 rounded-xl bg-violet-500/5" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Camera Widget ────────────────────────────────────────
function CameraWidget({ onViolation }: { onViolation: (type: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camState, setCamState] = useState<"idle" | "active" | "denied">("idle");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } });
        if (videoRef.current) { videoRef.current.srcObject = stream; setCamState("active"); }
      } catch {
        setCamState("denied");
        onViolation("camera_denied");
      }
    }
    start();
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [onViolation]);

  if (camState === "denied") {
    return (
      <div className="fixed bottom-4 right-4 bg-red-900 border border-red-600 rounded-xl p-3 flex items-center gap-2 text-red-200 text-xs shadow-lg z-50">
        <CameraOff size={14} /> Camera blocked — violation logged
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 rounded-xl overflow-hidden border-2 border-violet-500 shadow-2xl bg-black transition-all"
      style={{ width: expanded ? "256px" : "144px", height: expanded ? "192px" : "108px" }}>
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-white text-xs font-medium">REC</span>
      </div>
      <button onClick={() => setExpanded((v) => !v)}
        className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80">
        <Maximize2 size={10} />
      </button>
      {camState === "idle" && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="animate-spin w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}

// ─── Violation Overlay ────────────────────────────────────
function ViolationOverlay({ count, onDismiss }: { count: number; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} className="text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Tab Switch Detected</h2>
        <p className="text-gray-600 mb-2 text-sm">You left this exam tab. This action has been recorded.</p>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-6 inline-block">
          <p className="text-red-700 font-semibold text-sm">Violation #{count}</p>
          <p className="text-red-500 text-xs mt-0.5">3 or more violations may result in submission cancellation</p>
        </div>
        <button onClick={onDismiss} className="w-full gradient-brand text-white py-2.5 rounded-lg font-medium hover:opacity-90">
          Return to Exam
        </button>
      </div>
    </div>
  );
}

// ─── Assignment Overview (AI-generated) ───────────────────
interface Overview {
  difficulty: string; estimatedMinutes: number;
  topics: string[]; objectives: string[]; summary: string;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Medium: "text-amber-700 bg-amber-50 border-amber-200",
  Hard: "text-red-700 bg-red-50 border-red-200",
};

function OverviewPanel({ overview, loading }: { overview?: Overview; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Loader2 size={15} className="animate-spin text-violet-500" /> Analyzing assignment…
      </div>
    );
  }
  if (!overview) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-violet-600" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Overview</span>
      </div>
      {overview.summary && <p className="text-sm text-gray-700 mb-4">{overview.summary}</p>}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${DIFFICULTY_COLOR[overview.difficulty] ?? "text-gray-700 bg-gray-50 border-gray-200"}`}>
          <Gauge size={12} /> {overview.difficulty}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 bg-gray-50 text-gray-700">
          <Timer size={12} /> ~{overview.estimatedMinutes} min
        </span>
      </div>
      {overview.topics.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1.5"><Tag size={11} /> Topics</p>
          <div className="flex flex-wrap gap-1.5">
            {overview.topics.map((t, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-violet-50 text-violet-700 font-medium">{t}</span>
            ))}
          </div>
        </div>
      )}
      {overview.objectives.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1.5"><Target size={11} /> Learning Objectives</p>
          <ul className="space-y-1">
            {overview.objectives.map((o, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                <CheckCircle size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" /> {o}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Mode Selection Screen ────────────────────────────────
function ModeSelector({ title, question, onSelect, overview, overviewLoading }: {
  title: string; question: string;
  onSelect: (m: Mode, lang?: Language) => void;
  overview?: Overview; overviewLoading: boolean;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Shield size={14} /> Proctored Exam
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600 text-sm max-w-md mx-auto leading-relaxed line-clamp-3">{question}</p>
        </div>

        <OverviewPanel overview={overview} loading={overviewLoading} />

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <p className="font-semibold mb-1 flex items-center gap-1.5"><AlertTriangle size={14} /> Before you begin</p>
          <ul className="list-disc ml-4 space-y-1 text-amber-700 text-xs">
            <li>Your camera will be active throughout the exam</li>
            <li>Switching tabs will be detected and logged as a violation</li>
            <li>You cannot change your mode or language once started</li>
            <li>Submit before the deadline — late submissions may be penalised</li>
          </ul>
        </div>

        <p className="text-center text-sm font-semibold text-gray-700 mb-4">Choose your submission mode:</p>

        <div className="grid grid-cols-2 gap-4">
          {/* Essay */}
          <button onClick={() => onSelect("essay")}
            className="group relative bg-white rounded-2xl border-2 border-gray-200 hover:border-violet-400 p-6 text-left transition-all hover:shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center mb-4 transition-colors">
              <FileText size={22} className="text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Essay / Descriptive</h3>
            <p className="text-sm text-gray-500">Write a long-form analytical or descriptive answer with spell-check and word count.</p>
            <ul className="mt-3 space-y-1 text-xs text-gray-400">
              <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-green-500" /> Auto word count</li>
              <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-green-500" /> Spell check enabled</li>
              <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-green-500" /> Large writing area</li>
            </ul>
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-violet-500 group-hover:bg-violet-500 transition-all flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100" />
            </div>
          </button>

          {/* Coding — goes to language picker */}
          <button onClick={() => onSelect("coding")}
            className="group relative bg-white rounded-2xl border-2 border-gray-200 hover:border-violet-400 p-6 text-left transition-all hover:shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-gray-900 group-hover:bg-gray-800 flex items-center justify-center mb-4 transition-colors">
              <Code2 size={22} className="text-green-400" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Coding / Technical</h3>
            <p className="text-sm text-gray-500">Write code in your preferred language. Full code editor with line numbers and indentation.</p>
            <ul className="mt-3 space-y-1 text-xs text-gray-400">
              <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-green-500" /> 12 languages supported</li>
              <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-green-500" /> Tab indentation</li>
              <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-green-500" /> Monospace code editor</li>
            </ul>
            <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-gray-400 font-medium">
              Pick language <ChevronDown size={12} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Language selector dropdown in exam bar ───────────────
function LangBadge({ language, onChange }: { language: Language; onChange: (l: Language) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-800 ${language.color} hover:bg-gray-700 transition-colors`}>
        <Code2 size={12} /> {language.label} <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-8 left-0 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 w-44 max-h-72 overflow-y-auto">
            {LANGUAGES.map((l) => (
              <button key={l.id} onClick={() => { onChange(l); setOpen(false); }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-gray-800 transition-colors ${l.id === language.id ? "bg-gray-800" : ""}`}>
                <span className={`font-mono font-bold ${l.color}`}>{l.ext}</span>
                <span className="text-gray-300">{l.label}</span>
                {l.id === language.id && <CheckCircle size={11} className="ml-auto text-violet-400" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function SubmitAnswerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("select");
  const [mode, setMode] = useState<Mode>("essay");
  const [language, setLanguage] = useState<Language>(LANGUAGES[0]);
  const [answerText, setAnswerText] = useState("");
  const [violations, setViolations] = useState<Violation[]>([]);
  const [showViolation, setShowViolation] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Autosave state
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [savedAgo, setSavedAgo] = useState<string>("");
  const draftKey = `gradeai_draft_${id}`;

  // Code review state
  const [showReview, setShowReview] = useState(false);
  const [checklist, setChecklist] = useState({ read: false, written: false, reviewed: false });

  const { data: assignData, loading: loadingAssignment } = useQuery(ASSIGNMENT, { variables: { id } });
  const { data: overviewData, loading: overviewLoading } = useQuery(ASSIGNMENT_OVERVIEW, {
    variables: { assignmentId: id },
    errorPolicy: "ignore",
  });
  const overview = overviewData?.assignmentOverview;
  const [reviewCodeMut, { data: reviewData, loading: reviewLoading }] = useMutation(REVIEW_CODE);
  const codeReview = reviewData?.reviewCode;
  const { data: subData, refetch: refetchSub } = useQuery(MY_SUBMISSION, { variables: { assignmentId: id }, errorPolicy: "ignore" });
  const { data: gradeData } = useQuery(STUDENT_GRADE, {
    variables: { submissionId: subData?.mySubmission?.id },
    skip: !subData?.mySubmission || subData.mySubmission.status !== "PUBLISHED",
    errorPolicy: "ignore",
  });

  const [submitAnswer, { loading: submitting }] = useMutation(SUBMIT_ANSWER, {
    onCompleted: () => {
      toast.success("Submitted! AI is grading your answer…");
      setStage("submitted");
      refetchSub();
      if (timerRef.current) clearInterval(timerRef.current);
    },
    onError: (err) => toast.error(err.message ?? "Submission failed"),
  });

  const assignment = assignData?.assignment;
  const submission = subData?.mySubmission;
  const grade = gradeData?.studentGrade;

  useEffect(() => {
    if (submission) setStage("submitted");
  }, [submission]);

  // Tab-switch detection
  useEffect(() => {
    if (stage !== "exam") return;
    function onVisibility() {
      if (document.hidden) {
        setViolations((prev) => [...prev, { type: "tab_switch", at: new Date().toISOString() }]);
        setShowViolation(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stage]);

  // Block right-click in exam
  useEffect(() => {
    if (stage !== "exam") return;
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, [stage]);

  // Timer
  useEffect(() => {
    if (stage !== "exam") return;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  // Autosave: debounced write to localStorage while in exam
  useEffect(() => {
    if (stage !== "exam") return;
    setSaveState("saving");
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ mode, languageId: language.id, answerText, ts: Date.now() }));
        setSaveState("saved");
        setLastSaved(new Date());
      } catch { /* storage full / disabled — ignore */ }
    }, 800);
    return () => clearTimeout(t);
  }, [answerText, stage, mode, language.id, draftKey]);

  // "Last saved Xs ago" ticker
  useEffect(() => {
    if (!lastSaved) return;
    const update = () => {
      const secs = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      setSavedAgo(secs < 5 ? "just now" : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`);
    };
    update();
    const iv = setInterval(update, 5000);
    return () => clearInterval(iv);
  }, [lastSaved]);

  // Restore draft when entering exam stage
  function restoreDraft(): boolean {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return false;
      const draft = JSON.parse(raw);
      if (draft.answerText) {
        setAnswerText(draft.answerText);
        if (draft.mode) setMode(draft.mode);
        if (draft.languageId && LANGUAGE_MAP[draft.languageId]) setLanguage(LANGUAGE_MAP[draft.languageId]);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  const handleViolation = useCallback((type: string) => {
    setViolations((prev) => [...prev, { type, at: new Date().toISOString() }]);
  }, []);

  async function handleReviewCode() {
    if (!answerText.trim()) { toast.error("Write some code first"); return; }
    setShowReview(true);
    try {
      await reviewCodeMut({ variables: { assignmentId: id, code: answerText, language: language.label } });
    } catch {
      toast.error("Could not review code. Try again.");
    }
  }

  // Mode selection → coding goes to language picker
  function handleModeSelect(selectedMode: Mode) {
    setMode(selectedMode);
    if (selectedMode === "coding") {
      setStage("lang");
    } else {
      restoreDraft();
      setStage("exam");
    }
  }

  // Language selected → start exam with restored draft or placeholder
  function handleLangSelect(lang: Language) {
    setLanguage(lang);
    if (!restoreDraft()) setAnswerText(lang.placeholder);
    setStage("exam");
  }

  async function handleSubmit() {
    if (!answerText.trim()) { toast.error("Answer cannot be empty"); return; }
    setConfirmSubmit(false);
    const header = mode === "coding"
      ? `[CODING_MODE:${language.label}]\n[FILE:answer${language.ext}]\n\n`
      : "";
    await submitAnswer({ variables: { assignmentId: id, answerText: header + answerText } });
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  }

  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;
  const lineCount = answerText.split("\n").length;
  const tabViolations = violations.filter((v) => v.type === "tab_switch").length;

  if (loadingAssignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!assignment) return <div className="p-8">Assignment not found.</div>;

  // ── Faculty-controlled window guard (only blocks new attempts, not viewing a submission)
  const nowMs = Date.now();
  const notOpen = assignment.openDate && nowMs < new Date(assignment.openDate).getTime();
  const closed = assignment.dueDate && nowMs > new Date(assignment.dueDate).getTime() && !assignment.lateSubmissionPenalty;
  if (!submission && stage !== "submitted" && (notOpen || closed)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${closed ? "bg-red-50" : "bg-gray-100"}`}>
            {closed ? <Lock size={24} className="text-red-500" /> : <CalendarClock size={24} className="text-gray-500" />}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
          {closed ? (
            <>
              <p className="text-sm text-gray-600 mb-1">The submission deadline set by your faculty has passed.</p>
              {assignment.dueDate && <p className="text-xs text-red-500 mb-6">Closed on {new Date(assignment.dueDate).toLocaleString("en-IN")}</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-1">This assignment isn&apos;t open yet.</p>
              {assignment.openDate && <p className="text-xs text-gray-500 mb-6">Opens {new Date(assignment.openDate).toLocaleString("en-IN")}</p>}
            </>
          )}
          <button onClick={() => router.push("/student")} className="gradient-brand text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            Back to Assignments
          </button>
        </div>
      </div>
    );
  }

  // ── Stage: Mode Selection
  if (stage === "select") {
    return <ModeSelector title={assignment.title} question={assignment.question} onSelect={handleModeSelect} overview={overview} overviewLoading={overviewLoading} />;
  }

  // ── Stage: Language Picker
  if (stage === "lang") {
    return (
      <LanguagePicker
        onSelect={handleLangSelect}
        onBack={() => setStage("select")}
      />
    );
  }

  // ── Stage: Submitted
  if (stage === "submitted") {
    const submittedLang = submission?.answerText?.match(/\[CODING_MODE:([^\]]+)\]/)?.[1] ?? null;
    return (
      <div className="p-8 max-w-3xl">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{assignment.title}</h1>
        <p className="text-sm text-gray-500 mb-6">{[assignment.subject, assignment.semester, assignment.section].filter(Boolean).join(" · ")}</p>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle size={22} className="text-green-500" />
            <div>
              <p className="font-semibold text-gray-900">Answer Submitted</p>
              <p className="text-sm text-gray-500">{submission && new Date(submission.submittedAt).toLocaleString("en-IN")}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {submittedLang && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 flex items-center gap-1">
                  <Code2 size={10} /> {submittedLang}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                {submission?.status?.replace(/_/g, " ") ?? "Submitted"}
              </span>
            </div>
          </div>

          {!grade && (
            <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
              <Clock size={16} /> Your answer is being graded. Results will appear after faculty approval.
            </div>
          )}

          {grade && (
            <div className="space-y-5">
              <div className="flex items-center gap-5 p-5 bg-violet-50 rounded-xl border border-violet-100">
                <div className="text-center min-w-[72px]">
                  <p className="text-4xl font-bold text-violet-700">{grade.finalScore?.toFixed(1)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Your Score</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Feedback</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{grade.finalFeedback}</p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Criterion Breakdown</p>
                {grade.criterionScores.map((cs: { id: string; criterionName: string; maxMarks: number; finalScore: number | null; comment: string | null }) => (
                  <div key={cs.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-800">{cs.criterionName}</span>
                      <span className="text-sm font-bold text-violet-700">{cs.finalScore} / {cs.maxMarks}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full mb-1">
                      <div className="h-full bg-violet-400 rounded-full" style={{ width: `${((cs.finalScore ?? 0) / cs.maxMarks) * 100}%` }} />
                    </div>
                    {cs.comment && <p className="text-xs text-gray-500 mt-1">{cs.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Stage: Exam
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {showViolation && <ViolationOverlay count={tabViolations} onDismiss={() => setShowViolation(false)} />}

      {confirmSubmit && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl">
            <Send size={28} className="mx-auto mb-4 text-violet-600" />
            <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Submit Answer?</h2>
            <p className="text-sm text-gray-500 mb-1 text-center">Once submitted you cannot edit your answer.</p>
            <p className="text-xs text-gray-400 mb-5 text-center">
              {mode === "coding"
                ? `${language.label} · ${lineCount} lines of code`
                : `Essay · ${wordCount} words`}
            </p>

            {/* Pre-submit checklist */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Final Checklist</p>
              {[
                { key: "read" as const, label: "I have read the question carefully" },
                { key: "written" as const, label: mode === "coding" ? "My code is complete" : "My answer is complete" },
                { key: "reviewed" as const, label: "I have reviewed my answer" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setChecklist((c) => ({ ...c, [item.key]: !c[item.key] }))}
                  className="flex items-center gap-2.5 w-full text-left"
                >
                  {checklist[item.key]
                    ? <CheckSquare size={17} className="text-violet-600 flex-shrink-0" />
                    : <Square size={17} className="text-gray-300 flex-shrink-0" />}
                  <span className={`text-sm ${checklist[item.key] ? "text-gray-900" : "text-gray-500"}`}>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmSubmit(false)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting || !checklist.read || !checklist.written || !checklist.reviewed}
                className="gradient-brand text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? "Submitting…" : "Yes, Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Code Review drawer */}
      {showReview && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex justify-end" onClick={() => setShowReview(false)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-violet-600" />
                <h2 className="font-bold text-gray-900">AI Code Review</h2>
              </div>
              <button onClick={() => setShowReview(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {reviewLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 size={24} className="animate-spin text-violet-500 mb-3" />
                <p className="text-sm">Reviewing your code…</p>
              </div>
            )}

            {codeReview && !reviewLoading && (
              <div className="space-y-4">
                <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Quality Score</span>
                    <span className="text-lg font-bold text-violet-700">{codeReview.score}/100</span>
                  </div>
                  <p className="text-sm text-gray-700">{codeReview.summary}</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="border border-gray-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Complexity</p>
                    <p className="text-sm text-gray-700">{codeReview.complexity || "—"}</p>
                  </div>
                  <div className="border border-gray-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Readability</p>
                    <p className="text-sm text-gray-700">{codeReview.readability || "—"}</p>
                  </div>
                </div>

                {codeReview.edgeCases.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Edge Cases to Consider</p>
                    <ul className="space-y-1">
                      {codeReview.edgeCases.map((e: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                          <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" /> {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {codeReview.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1.5">Suggestions</p>
                    <ul className="space-y-1">
                      {codeReview.suggestions.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                          <CheckCircle size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-gray-400 text-center pt-2">
                  This is guidance only — the full solution is yours to write.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="bg-gray-900 border-b border-gray-700 px-5 py-3 flex items-center gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {mode === "coding"
            ? <LangBadge language={language} onChange={(l) => { setLanguage(l); }} />
            : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-800 text-blue-400">
                <FileText size={12} /> Essay Mode
              </div>
            )
          }
          <span className="text-white font-semibold text-sm truncate hidden sm:block">{assignment.title}</span>
        </div>

        <div className={`flex items-center gap-1.5 font-mono text-sm px-3 py-1 rounded-lg ${elapsed > 3600 ? "bg-red-900/40 text-red-400" : "bg-gray-800 text-gray-300"}`}>
          <Clock size={13} /> {fmtTime(elapsed)}
        </div>

        <div className="hidden sm:flex items-center gap-2">
          {tabViolations > 0 && (
            <div className="flex items-center gap-1.5 bg-red-900/40 text-red-400 px-2.5 py-1 rounded-lg text-xs font-medium">
              <AlertTriangle size={12} /> {tabViolations} violation{tabViolations !== 1 ? "s" : ""}
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-green-900/30 text-green-400 px-2.5 py-1 rounded-lg text-xs font-medium">
            <Shield size={12} /> Proctored
          </div>
        </div>

        <span className="text-gray-500 text-xs hidden md:block">
          {mode === "essay" ? `${wordCount} words` : `${lineCount} lines`}
        </span>

        <button onClick={() => setConfirmSubmit(true)} disabled={!answerText.trim()}
          className="flex items-center gap-1.5 gradient-brand text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
          <Send size={14} /> Submit
        </button>
      </header>

      {/* Main split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">

        {/* Left: Question */}
        <div className="bg-gray-900 border-r border-gray-700 overflow-y-auto p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-900/50 text-violet-300">
              {assignment.assignmentType?.replace(/_/g, " ")}
            </span>
            {assignment.subject && <span className="text-xs text-gray-500">{assignment.subject}</span>}
            {assignment.dueDate && (
              <span className="ml-auto text-xs text-amber-400 flex items-center gap-1">
                <Clock size={11} /> Due {new Date(assignment.dueDate).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Eye size={12} /> Question</p>
            <p className="text-gray-200 leading-relaxed text-sm whitespace-pre-wrap">{assignment.question}</p>
          </div>

          {assignment.instructions && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Instructions</p>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{assignment.instructions}</p>
            </div>
          )}

          {assignment.rubric?.criteria?.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Hash size={11} /> Marking Criteria ({assignment.rubric.totalMarks} marks)
              </p>
              <div className="space-y-2">
                {assignment.rubric.criteria.map((c: { id: string; name: string; description: string | null; maxMarks: number }) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <span className="text-xs font-bold text-violet-400 shrink-0 mt-0.5">{c.maxMarks}m</span>
                    <div>
                      <p className="text-xs font-medium text-gray-300">{c.name}</p>
                      {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assignment.submissionGuidelines && (
            <div className="border border-amber-800/40 bg-amber-950/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-400 mb-1">Submission Guidelines</p>
              <p className="text-xs text-amber-300/80 leading-relaxed">{assignment.submissionGuidelines}</p>
            </div>
          )}
        </div>

        {/* Right: Editor */}
        <div className={`flex flex-col overflow-hidden ${mode === "coding" ? "bg-[#1a1a2e]" : "bg-gray-900"}`}>
          <div className="px-5 py-2.5 border-b border-gray-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">
              {mode === "coding" ? `${language.label} Editor` : "Answer Editor"}
            </span>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {mode === "coding" && (
                <button
                  onClick={handleReviewCode}
                  disabled={reviewLoading}
                  className="flex items-center gap-1.5 bg-violet-600/90 hover:bg-violet-600 text-white px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {reviewLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Review My Code
                </button>
              )}
              {mode === "essay" && <span>{wordCount} words</span>}
              {mode === "coding" && <span>{lineCount} lines</span>}
              <span className="w-px h-3 bg-gray-700" />
              <span>{answerText.length} chars</span>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-hidden">
            {mode === "coding" ? (
              <CodeEditor value={answerText} onChange={setAnswerText} language={language} />
            ) : (
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Write your answer here…"
                className="w-full h-full resize-none bg-gray-800 text-gray-100 rounded-xl border border-gray-700 px-5 py-4 text-sm leading-7 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-gray-600"
                spellCheck
              />
            )}
          </div>

          <div className="px-5 py-2 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-3">
              {saveState === "saving" ? (
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Loader2 size={11} className="animate-spin" /> Saving…
                </span>
              ) : saveState === "saved" ? (
                <span className="flex items-center gap-1.5 text-green-500">
                  <CheckCircle size={11} /> Saved{savedAgo && ` · last saved ${savedAgo}`}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600" /> Draft
                </span>
              )}
              {tabViolations > 0 && <span className="text-red-400">{tabViolations} violation{tabViolations !== 1 ? "s" : ""}</span>}
            </span>
            <span className="hidden md:block">
              {mode === "coding" ? "Tab = 2 spaces · Enter = auto-indent" : "Structure your answer with clear paragraphs"}
            </span>
          </div>
        </div>
      </div>

      <CameraWidget onViolation={handleViolation} />
    </div>
  );
}
