"use client";
import { useState } from "react";
import { useMutation } from "@apollo/client";
import { HOD_GENERATE_COPO } from "@/lib/graphql/mutations";
import { AIErrorBanner } from "@/components/AIErrorBanner";
import { ClipboardList, Sparkles, Loader2, Grid3x3 } from "lucide-react";
import clsx from "clsx";

interface CO { co: string; description: string; bloomLevel: string }
interface COPO { co: string; po: string; strength: number }
interface Mapping { courseOutcomes: CO[]; coPoMatrix: COPO[]; justification: string }

const POS = Array.from({ length: 12 }, (_, i) => `PO${i + 1}`);
const STRENGTH_COLOR = ["", "bg-violet-100 text-violet-700", "bg-violet-300 text-violet-900", "bg-violet-600 text-white"];

export default function HODAcademicPage() {
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState("");
  const [gen, { data, loading, error }] = useMutation(HOD_GENERATE_COPO);
  const mapping: Mapping | undefined = data?.hodGenerateCOPO;
  const runGen = () => gen({ variables: { subject, topics } }).catch(() => { /* shown via error */ });

  const cell = (co: string, po: string) =>
    mapping?.coPoMatrix.find((m) => m.co === co && m.po === po)?.strength ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
          <ClipboardList size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Academic Planning</h1>
          <p className="text-gray-500 text-sm">Generate Course Outcomes and NBA CO–PO mappings.</p>
        </div>
      </div>

      {/* Input */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (e.g. Operating Systems)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <input
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="Key topics (comma separated)"
            className="sm:col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <button
          onClick={runGen}
          disabled={loading || !subject.trim()}
          className="gradient-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Generate CO–PO Mapping
        </button>
      </div>

      {error && !loading && <AIErrorBanner error={error} onRetry={runGen} />}

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Loader2 size={24} className="animate-spin text-violet-500 mx-auto mb-3" />
          <p className="text-sm">Generating outcomes and mapping matrix…</p>
        </div>
      )}

      {mapping && !loading && (
        <>
          {/* Course Outcomes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Course Outcomes</h2>
            <div className="space-y-2">
              {mapping.courseOutcomes.map((co) => (
                <div key={co.co} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-bold flex-shrink-0">{co.co}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{co.description}</p>
                    <span className="text-xs text-gray-400">Bloom: {co.bloomLevel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CO-PO matrix */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Grid3x3 size={18} className="text-violet-600" />
              <h2 className="font-semibold text-gray-900">CO–PO Correlation Matrix</h2>
              <span className="text-xs text-gray-400 ml-auto">1=Low · 2=Medium · 3=High</span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border border-gray-100 bg-gray-50 sticky left-0">CO \ PO</th>
                    {POS.map((po) => <th key={po} className="p-2 border border-gray-100 bg-gray-50 font-medium text-gray-600 min-w-[44px]">{po}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {mapping.courseOutcomes.map((co) => (
                    <tr key={co.co}>
                      <td className="p-2 border border-gray-100 bg-gray-50 font-bold text-indigo-700 sticky left-0">{co.co}</td>
                      {POS.map((po) => {
                        const s = cell(co.co, po);
                        return (
                          <td key={po} className="p-0 border border-gray-100 text-center">
                            {s > 0 ? (
                              <div className={clsx("w-full h-8 flex items-center justify-center font-bold", STRENGTH_COLOR[s])}>{s}</div>
                            ) : (
                              <div className="w-full h-8 flex items-center justify-center text-gray-200">–</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mapping.justification && (
              <p className="text-xs text-gray-500 mt-4 bg-gray-50 rounded-lg p-3">{mapping.justification}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
