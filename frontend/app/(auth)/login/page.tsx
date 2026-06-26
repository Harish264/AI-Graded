"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation } from "@apollo/client";
import toast from "react-hot-toast";
import { GraduationCap, Chrome } from "lucide-react";
import { LOGIN, REGISTER } from "@/lib/graphql/mutations";
import { saveTokens } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { googleAuthUrl } from "@/lib/config";

interface FormData {
  email: string; password: string; fullName: string;
  role: "FACULTY" | "STUDENT" | "HOD"; department: string;
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const router = useRouter();
  const { setUser } = useAuthStore();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>();

  const [login] = useMutation(LOGIN);
  const [registerMutation] = useMutation(REGISTER);

  const onSubmit = async (data: FormData) => {
    try {
      const mutation = mode === "login"
        ? login({ variables: { email: data.email, password: data.password } })
        : registerMutation({ variables: { email: data.email, password: data.password, fullName: data.fullName, role: data.role, department: data.department || undefined } });

      const { data: res } = await mutation;
      const payload = res.login ?? res.register;
      saveTokens(payload.accessToken, payload.refreshToken);
      setUser(payload.user);
      router.push(
        payload.user.role === "STUDENT" ? "/student/dashboard"
          : payload.user.role === "HOD" || payload.user.role === "ADMIN" ? "/hod/dashboard"
          : "/dashboard"
      );
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Something went wrong");
    }
  };

  const googleHref = googleAuthUrl();

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 gradient-brand rounded-2xl mb-4 shadow-lg">
            <GraduationCap size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gradient-brand">GradeAI</h1>
          <p className="text-gray-500 mt-1 text-sm">AI Grading & Feedback Engine</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${mode === m ? "bg-white shadow text-violet-700" : "text-gray-500"}`}>
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Google OAuth */}
          <a href={googleHref}
            className="flex items-center justify-center gap-2 w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4">
            <Chrome size={18} /> Continue with Google
          </a>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <div className="flex-1 h-px bg-gray-200" /><span>or</span><div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Full Name</label>
                  <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="Prof. Meera Sharma" {...register("fullName", { required: true })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    {...register("role")} defaultValue="STUDENT">
                    <option value="STUDENT">Student</option>
                    <option value="FACULTY">Faculty</option>
                    <option value="HOD">Head of Department</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Department</label>
                  <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="Computer Science" {...register("department")} />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input type="email" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="you@college.edu" {...register("email", { required: true })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <input type="password" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="••••••••" {...register("password", { required: true, minLength: 6 })} />
            </div>
            <button type="submit" disabled={isSubmitting}
              className="w-full gradient-brand text-white py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
              {isSubmitting ? "..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
