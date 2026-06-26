"use client";
import { ApolloProvider } from "@apollo/client";
import { Toaster } from "react-hot-toast";
import { apolloClient } from "@/lib/apollo";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={apolloClient}>
      {children}
      <Toaster position="top-right" />
    </ApolloProvider>
  );
}
