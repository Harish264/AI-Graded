"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { useMutation, useQuery } from "@apollo/client";
import toast from "react-hot-toast";
import { Plus, Trash2, ArrowLeft, Save, Loader2 } from "lucide-react";
import { UPDATE_ASSIGNMENT, CREATE_RUBRIC } from "@/lib/graphql/mutations";
import { ASSIGNMENT, RUBRICS } from "@/lib/graphql/queries";

interface CriterionField { name: string; description: string; maxMarks: number; }
interface FormData {
  title: string; question: string; modelAnswer: string; assignmentType: string;
  subject: string; semester: string; section: string;
  openDate: string; dueDate: string; lateSubmissionPenalty: string;
  instructions: string; submissionGuidelines: string; referenceMaterials: string; notesForStudents: string;
  rubricChoice: "keep" | "new" | "existing";
  existingRubricId: string; rubricName: string;
  criteria: CriterionField[];
}

function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

export default function EditAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, loading: loadingAssignment } = useQuery(ASSIGNMENT, { variables: { id } });
  const { data: rubricsData } = useQuery(RUBRICS);
  const [updateAssignment, { loading: saving }] = useMutation(UPDATE_ASSIGNMENT, { refetchQueries: ["Assignments", "Assignment"] });
  const [createRubric] = useMutation(CREATE_RUBRIC);

  const { register, control, handleSubmit, watch, reset } = useForm<FormData>({
    defaultValues: { assignmentType: "ASSIGNMENT", rubricChoice: "keep", criteria: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "criteria" });
  const criteria = watch("criteria");
  const rubricChoice = watch("rubricChoice");
  const totalMarks = criteria?.reduce((s, c) => s + Number(c.maxMarks || 0), 0) ?? 0;

  const a = data?.assignment;

  useEffect(() => {
    if (!a) return;
    reset({
      title: a.title,
      question: a.question,
      modelAnswer: a.modelAnswer,
      assignmentType: a.assignmentType,
      subject: a.subject ?? "",
      semester: a.semester ?? "",
      section: a.section ?? "",
      openDate: toDatetimeLocal(a.openDate),
      dueDate: toDatetimeLocal(a.dueDate),
      lateSubmissionPenalty: a.lateSubmissionPenalty != null ? String(a.lateSubmissionPenalty) : "",
      instructions: a.instructions ?? "",
      submissionGuidelines: a.submissionGuidelines ?? "",
      referenceMaterials: a.referenceMaterials ?? "",
      notesForStudents: a.notesForStudents ?? "",
      rubricChoice: "keep",
      existingRubricId: "",
      rubricName: a.rubric?.name ?? "",
      criteria: a.rubric?.criteria?.map((c: { name: string; description: string | null; maxMarks: number }) => ({
        name: c.name, description: c.description ?? "", maxMarks: c.maxMarks,
      })) ?? [],
    });
  }, [a, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      let rubricId: string | undefined;

      if (data.rubricChoice === "new") {
        const { data: rd } = await createRubric({
          variables: {
            input: {
              name: data.rubricName || `${data.title} Rubric`,
              totalMarks,
              criteria: data.criteria.map((c, i) => ({ ...c, maxMarks: Number(c.maxMarks), order: i })),
            },
          },
        });
        rubricId = rd.createRubric.id;
      } else if (data.rubricChoice === "existing") {
        rubricId = data.existingRubricId;
      }

      await updateAssignment({
        variables: {
          id,
          input: {
            title: data.title,
            question: data.question,
            modelAnswer: data.modelAnswer,
            assignmentType: data.assignmentType,
            subject: data.subject || undefined,
            semester: data.semester || undefined,
            section: data.section || undefined,
            openDate: data.openDate || undefined,
            dueDate: data.dueDate || undefined,
            lateSubmissionPenalty: data.lateSubmissionPenalty ? Number(data.lateSubmissionPenalty) : undefined,
            instructions: data.instructions || undefined,
            submissionGuidelines: data.submissionGuidelines || undefined,
            referenceMaterials: data.referenceMaterials || undefined,
            notesForStudents: data.notesForStudents || undefined,
            ...(rubricId ? { rubricId } : {}),
          },
        },
      });
      toast.success("Assignment updated");
      router.push(`/assignments/${id}`);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to update");
    }
  };

  if (loadingAssignment) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-6" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse mb-4" />
        ))}
      </div>
    );
  }

  if (!a) return <div className="p-8 text-gray-500">Assignment not found.</div>;

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Assignment</h1>
          <p className="text-gray-500 mt-1">Last updated {new Date(a.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        <span className={`mt-1 px-3 py-1 rounded-full text-xs font-semibold ${
          a.status === "ACTIVE" ? "bg-green-100 text-green-700" :
          a.status === "CLOSED" ? "bg-amber-100 text-amber-700" :
          a.status === "ARCHIVED" ? "bg-slate-100 text-slate-500" :
          "bg-gray-100 text-gray-600"
        }`}>{a.status}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          <div className="grid grid-cols-2 gap-4">
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Semester" {...register("semester")} />
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Section" {...register("section")} />
          </div>
        </section>

        {/* Schedule */}
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
            <textarea rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" placeholder="Step-by-step instructions…" {...register("instructions")} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Submission Guidelines</label>
            <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" placeholder="Format, word limit, file type…" {...register("submissionGuidelines")} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Reference Materials</label>
            <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" placeholder="Textbook chapters, links…" {...register("referenceMaterials")} />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Notes for Students</label>
            <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y" placeholder="Tips or additional notes…" {...register("notesForStudents")} />
          </div>
        </section>

        {/* Rubric */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Grading Rubric</h2>
          {a.submissionCount > 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This assignment has {a.submissionCount} submission{a.submissionCount !== 1 ? "s" : ""}. Changing the rubric will not affect existing grades.
            </div>
          )}
          <div className="flex rounded-lg bg-gray-100 p-1 w-fit">
            {(["keep", "new", "existing"] as const).map((choice) => (
              <label key={choice} className={`px-3 py-1 rounded-md text-sm font-medium cursor-pointer transition-all ${rubricChoice === choice ? "bg-white shadow text-violet-700" : "text-gray-500 hover:text-gray-700"}`}>
                <input type="radio" value={choice} {...register("rubricChoice")} className="sr-only" />
                {choice === "keep" ? "Keep Current" : choice === "new" ? "Create New" : "Use Existing"}
              </label>
            ))}
          </div>

          {rubricChoice === "keep" && a.rubric && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-900 mb-2">{a.rubric.name} — {a.rubric.totalMarks} marks</p>
              {a.rubric.criteria?.map((c: { id: string; name: string; maxMarks: number }) => (
                <div key={c.id} className="flex justify-between py-1 border-b border-gray-200 last:border-0">
                  <span>{c.name}</span><span className="font-medium">{c.maxMarks} marks</span>
                </div>
              ))}
            </div>
          )}

          {rubricChoice === "new" && (
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

          {rubricChoice === "existing" && (
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" {...register("existingRubricId", { required: rubricChoice === "existing" })}>
              <option value="">— Choose a rubric —</option>
              {rubricsData?.rubrics?.map((r: { id: string; name: string; totalMarks: number }) => (
                <option key={r.id} value={r.id}>{r.name} ({r.totalMarks} marks)</option>
              ))}
            </select>
          )}
        </section>

        <div className="flex justify-end gap-3 pb-8">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 gradient-brand text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Changes</>}
          </button>
        </div>
      </form>
    </div>
  );
}
