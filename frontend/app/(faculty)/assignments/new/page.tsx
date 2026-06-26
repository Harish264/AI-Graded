"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { useMutation, useQuery } from "@apollo/client";
import toast from "react-hot-toast";
import { Plus, Trash2, ArrowLeft, Sparkles, PenLine, Loader2, Save, Zap } from "lucide-react";
import { CREATE_RUBRIC, CREATE_ASSIGNMENT, GENERATE_ASSIGNMENT } from "@/lib/graphql/mutations";
import { RUBRICS } from "@/lib/graphql/queries";

interface CriterionField { name: string; description: string; maxMarks: number; }
interface FormData {
  title: string; question: string; modelAnswer: string; assignmentType: string;
  subject: string; semester: string; section: string;
  openDate: string; dueDate: string; lateSubmissionPenalty: string;
  instructions: string; submissionGuidelines: string; referenceMaterials: string; notesForStudents: string;
  existingRubricId: string; rubricName: string;
  criteria: CriterionField[];
}
interface AIPromptForm {
  topic: string; subject: string; assignmentType: string; totalMarks: number; criteriaCount: number;
}

export default function AssignmentCreate() {
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [rubricChoice, setRubricChoice] = useState<"new" | "existing">("new");
  const [aiGenerated, setAiGenerated] = useState(false);

  const { data: rubricsData } = useQuery(RUBRICS);
  const [createRubric] = useMutation(CREATE_RUBRIC);
  const [createAssignment, { loading: creating }] = useMutation(CREATE_ASSIGNMENT, { refetchQueries: ["Assignments"] });
  const [generateAssignment, { loading: generating }] = useMutation(GENERATE_ASSIGNMENT);

  const { register, control, handleSubmit, watch, setValue } = useForm<FormData>({
    defaultValues: {
      assignmentType: "ASSIGNMENT",
      criteria: [{ name: "Content Knowledge", description: "Accuracy and depth", maxMarks: 5 }],
    },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: "criteria" });
  const criteria = watch("criteria");
  const totalMarks = criteria?.reduce((s, c) => s + Number(c.maxMarks || 0), 0) ?? 0;

  const aiForm = useForm<AIPromptForm>({
    defaultValues: { assignmentType: "ASSIGNMENT", totalMarks: 10, criteriaCount: 3 },
  });

  const handleGenerate = async (data: AIPromptForm) => {
    try {
      const { data: result } = await generateAssignment({
        variables: {
          input: {
            topic: data.topic, subject: data.subject || undefined,
            assignmentType: data.assignmentType,
            totalMarks: Number(data.totalMarks), criteriaCount: Number(data.criteriaCount),
          },
        },
      });
      const g = result.generateAssignment;
      setValue("title", g.title); setValue("question", g.question);
      setValue("modelAnswer", g.modelAnswer); setValue("rubricName", g.rubricName);
      setValue("assignmentType", data.assignmentType); setValue("subject", data.subject || "");
      replace(g.criteria.map((c: { name: string; description: string; maxMarks: number }) => ({
        name: c.name, description: c.description, maxMarks: c.maxMarks,
      })));
      setRubricChoice("new"); setAiGenerated(true);
      toast.success("Assignment generated! Review and edit below.");
    } catch (err: unknown) { toast.error((err as Error).message ?? "Generation failed"); }
  };

  const onSubmit = async (data: FormData, status: "DRAFT" | "ACTIVE") => {
    try {
      let rubricId = data.existingRubricId;
      if (rubricChoice === "new") {
        const { data: rd } = await createRubric({
          variables: {
            input: {
              name: data.rubricName || `${data.title} Rubric`, totalMarks,
              criteria: data.criteria.map((c, i) => ({ ...c, maxMarks: Number(c.maxMarks), order: i })),
            },
          },
        });
        rubricId = rd.createRubric.id;
      }
      await createAssignment({
        variables: {
          input: {
            title: data.title, question: data.question, modelAnswer: data.modelAnswer,
            assignmentType: data.assignmentType, status,
            subject: data.subject || undefined, semester: data.semester || undefined,
            section: data.section || undefined,
            openDate: data.openDate || undefined, dueDate: data.dueDate || undefined,
            lateSubmissionPenalty: data.lateSubmissionPenalty ? Number(data.lateSubmissionPenalty) : undefined,
            instructions: data.instructions || undefined,
            submissionGuidelines: data.submissionGuidelines || undefined,
            referenceMaterials: data.referenceMaterials || undefined,
            notesForStudents: data.notesForStudents || undefined,
            rubricId,
          },
        },
      });
      toast.success(status === "DRAFT" ? "Saved as draft" : "Assignment published and active!");
      router.push("/assignments");
    } catch (err: unknown) { toast.error((err as Error).message ?? "Failed"); }
  };

  const showForm = mode === "manual" || aiGenerated;

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">New Assignment</h1>
      <p className="text-gray-500 mb-6">Set up the question, model answer, and grading rubric.</p>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-gray-100 p-1 mb-8 w-fit">
        <button type="button" onClick={() => { setMode("manual"); setAiGenerated(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === "manual" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          <PenLine size={15} /> Manual
        </button>
        <button type="button" onClick={() => setMode("ai")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === "ai" ? "bg-white shadow text-violet-700" : "text-gray-500 hover:text-gray-700"}`}>
          <Sparkles size={15} /> AI-Assisted
        </button>
      </div>

      {/* AI prompt panel */}
      {mode === "ai" && (
        <section className="bg-violet-50 border border-violet-200 rounded-xl p-6 mb-8 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-violet-600" />
            <h2 className="font-semibold text-violet-900">Generate with AI</h2>
          </div>
          <p className="text-sm text-violet-700">Describe the topic and AI will generate a complete question, model answer, and rubric.</p>
          <input className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Topic or learning objective *  e.g. 'Dijkstra's shortest path algorithm'"
            {...aiForm.register("topic", { required: true })} />
          <div className="grid grid-cols-2 gap-4">
            <select className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" {...aiForm.register("assignmentType")}>
              <option value="ASSIGNMENT">Assignment</option>
              <option value="INTERNAL_ASSESSMENT">Internal Assessment</option>
              <option value="LAB_RECORD">Lab Record</option>
              <option value="DESCRIPTIVE_EXAM">Descriptive Exam</option>
            </select>
            <input className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Subject (optional)" {...aiForm.register("subject")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-violet-700 font-medium mb-1 block">Total Marks</label>
              <input type="number" min={1} className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" {...aiForm.register("totalMarks", { required: true, min: 1 })} />
            </div>
            <div>
              <label className="text-xs text-violet-700 font-medium mb-1 block">Number of Criteria</label>
              <input type="number" min={1} max={8} className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" {...aiForm.register("criteriaCount", { required: true, min: 1, max: 8 })} />
            </div>
          </div>
          <button type="button" disabled={generating} onClick={aiForm.handleSubmit(handleGenerate)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {generating ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><Sparkles size={15} /> Generate Assignment</>}
          </button>
        </section>
      )}

      {showForm && (
        <form className="space-y-6">
          {aiGenerated && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
              <Sparkles size={14} className="text-green-600 shrink-0" />
              AI-generated content loaded. Review and edit everything below before saving.
            </div>
          )}

          {/* Assignment Details */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Assignment Details</h2>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Title *" {...register("title", { required: true })} />
            <div className="grid grid-cols-2 gap-4">
              <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" {...register("assignmentType")}>
                <option value="ASSIGNMENT">Assignment</option>
                <option value="INTERNAL_ASSESSMENT">Internal Assessment</option>
                <option value="LAB_RECORD">Lab Record</option>
                <option value="DESCRIPTIVE_EXAM">Descriptive Exam</option>
              </select>
              <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Subject" {...register("subject")} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Semester" {...register("semester")} />
              <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Section" {...register("section")} />
            </div>
          </section>

          {/* Scheduling */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Schedule</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">Open Date</label>
                <input type="datetime-local" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" {...register("openDate")} />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">Due Date</label>
                <input type="datetime-local" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" {...register("dueDate")} />
              </div>
            </div>
            <div className="max-w-xs">
              <label className="text-xs text-gray-500 font-medium mb-1 block">Late Submission Penalty (% per day)</label>
              <input type="number" min={0} max={100} step={5} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="e.g. 10" {...register("lateSubmissionPenalty")} />
            </div>
          </section>

          {/* Question & Model Answer */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Question & Model Answer</h2>
            <textarea rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" placeholder="Question *" {...register("question", { required: true })} />
            <textarea rows={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" placeholder="Model / Ideal Answer *" {...register("modelAnswer", { required: true })} />
          </section>

          {/* Instructions */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Instructions for Students</h2>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Detailed Instructions</label>
              <textarea rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" placeholder="Step-by-step instructions for students…" {...register("instructions")} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Submission Guidelines</label>
              <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" placeholder="Format, word limit, file type requirements…" {...register("submissionGuidelines")} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Reference Materials</label>
              <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" placeholder="Textbook chapters, links, or reference documents…" {...register("referenceMaterials")} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Notes for Students</label>
              <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" placeholder="Any additional notes or tips…" {...register("notesForStudents")} />
            </div>
          </section>

          {/* Rubric */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Grading Rubric</h2>
              <div className="flex rounded-lg bg-gray-100 p-1">
                {(["new", "existing"] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setRubricChoice(c)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${rubricChoice === c ? "bg-white shadow text-violet-700" : "text-gray-500"}`}>
                    {c === "new" ? "Create New" : "Use Existing"}
                  </button>
                ))}
              </div>
            </div>
            {rubricChoice === "existing" ? (
              <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" {...register("existingRubricId", { required: rubricChoice === "existing" })}>
                <option value="">— Choose a rubric —</option>
                {rubricsData?.rubrics?.map((r: { id: string; name: string; totalMarks: number }) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.totalMarks} marks)</option>
                ))}
              </select>
            ) : (
              <>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Rubric Name" {...register("rubricName")} />
                <div className="space-y-3">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_80px_auto] gap-3 items-center">
                      <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Criterion name" {...register(`criteria.${idx}.name`, { required: true })} />
                      <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Description" {...register(`criteria.${idx}.description`)} />
                      <input type="number" min={0} step={0.5} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" {...register(`criteria.${idx}.maxMarks`, { required: true })} />
                      <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => append({ name: "", description: "", maxMarks: 5 })}
                    className="flex items-center gap-1 border border-violet-300 text-violet-700 px-3 py-1.5 rounded-lg text-sm hover:bg-violet-50">
                    <Plus size={14} /> Add Criterion
                  </button>
                  <span className="text-sm text-gray-500">Total: <span className="font-semibold text-violet-700">{totalMarks} marks</span></span>
                </div>
              </>
            )}
          </section>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pb-8">
            <button type="button" onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit((d) => onSubmit(d, "DRAFT"))}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <Save size={14} /> Save as Draft
            </button>
            <button type="button" onClick={handleSubmit((d) => onSubmit(d, "ACTIVE"))}
              className="flex items-center gap-2 gradient-brand text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Zap size={14} /> Publish & Activate
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
