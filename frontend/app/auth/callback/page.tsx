"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveTokens } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { apolloClient } from "@/lib/apollo";
import { ME } from "@/lib/graphql/queries";

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full" />
    </div>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const access = params.get("access");
    const refresh = params.get("refresh");
    if (!access || !refresh) { router.push("/login"); return; }
    saveTokens(access, refresh);
    apolloClient
      .query({ query: ME })
      .then(({ data }) => {
        useAuthStore.getState().setUser(data.me);
        router.push(
          data.me.role === "STUDENT" ? "/student/dashboard"
            : data.me.role === "HOD" || data.me.role === "ADMIN" ? "/hod/dashboard"
            : "/dashboard"
        );
      })
      .catch(() => router.push("/login"));
  }, [params, router]);

  return <Spinner />;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<Spinner />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
