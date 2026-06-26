import type { IncomingMessage, ServerResponse } from "http";
import type { Express } from "express";
import { createApp } from "../src/app";

// Route prefix this service is mounted under (see vercel.json experimentalServices.backend).
const ROUTE_PREFIX = "/_/backend";

// Cache the started app across warm invocations so Apollo only boots once.
let appPromise: Promise<Express> | null = null;
function getApp(): Promise<Express> {
  if (!appPromise) appPromise = createApp();
  return appPromise;
}

export default async function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse
) {
  // If the platform forwards the full path including the prefix, strip it so the
  // internal Express routes (/graphql, /auth/google, /health) still match.
  if (req.url && req.url.startsWith(ROUTE_PREFIX)) {
    req.url = req.url.slice(ROUTE_PREFIX.length) || "/";
  }
  const app = await getApp();
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
