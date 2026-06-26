"use client";
import { ApolloClient, InMemoryCache, createHttpLink, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { graphqlUri } from "./config";

const httpLink = createHttpLink({
  // Resolved per-operation so the browser origin (window) is available — this lets the
  // unified deployment use the /_/backend prefix while local dev hits localhost:4000.
  uri: () => graphqlUri(),
});

const authLink = setContext((_, { headers }) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("gradeai_access") : null;
  return { headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) } };
});

const errorLink = onError(({ graphQLErrors }) => {
  if (graphQLErrors?.some((e) => e.message === "UNAUTHENTICATED")) {
    localStorage.removeItem("gradeai_access");
    localStorage.removeItem("gradeai_refresh");
    window.location.href = "/login";
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: { watchQuery: { fetchPolicy: "cache-and-network" } },
});
