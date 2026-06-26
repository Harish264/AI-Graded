import { authResolvers } from "./auth.resolver";
import { rubricResolvers } from "./rubric.resolver";
import { assignmentResolvers } from "./assignment.resolver";
import { submissionResolvers } from "./submission.resolver";
import { gradingResolvers } from "./grading.resolver";
import { analyticsResolvers } from "./analytics.resolver";
import { assistantResolvers } from "./assistant.resolver";
import { studentResolvers } from "./student.resolver";
import { hodResolvers } from "./hod.resolver";

function merge(...resolvers: object[]) {
  const result: Record<string, Record<string, unknown>> = {};
  for (const r of resolvers) {
    for (const [key, val] of Object.entries(r)) {
      result[key] = { ...(result[key] ?? {}), ...(val as object) };
    }
  }
  return result;
}

export const resolvers = merge(
  authResolvers,
  rubricResolvers,
  assignmentResolvers,
  submissionResolvers,
  gradingResolvers,
  analyticsResolvers,
  assistantResolvers,
  studentResolvers,
  hodResolvers
);
