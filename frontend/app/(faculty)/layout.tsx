"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@apollo/client";
import { Sidebar } from "@/components/Sidebar";
import { AIAssistant } from "@/components/AIAssistant";
import { useAuthStore } from "@/lib/store";
import { ME } from "@/lib/graphql/queries";
import { getAccessToken } from "@/lib/auth";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const token = getAccessToken();

  const { data } = useQuery(ME, { skip: !!user || !token });

  useEffect(() => {
    if (data?.me) setUser(data.me);
  }, [data, setUser]);

  useEffect(() => {
    if (!token) router.push("/login");
    else if (user?.role === "STUDENT") router.push("/student/dashboard");
  }, [token, user, router]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
      <AIAssistant />
    </div>
  );
}
