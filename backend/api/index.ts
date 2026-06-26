import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs } from "../src/schema/typeDefs";
import { resolvers } from "../src/schema/resolvers";
import { buildContext } from "../src/context";
import { prisma } from "../src/db";
import passport from "../src/auth/google";
import { signAccess, signRefresh } from "../src/auth/jwt";
import { addDays } from "../src/utils";

const app = express();

const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(passport.initialize());

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.WEB_ORIGIN}/login?error=oauth`,
  }),
  async (req, res) => {
    const user = req.user as { id: string; role: string };
    const payload = { userId: user.id, role: user.role };
    const refreshToken = signRefresh(payload);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: addDays(7) },
    });
    const accessToken = signAccess(payload);
    res.redirect(
      `${process.env.WEB_ORIGIN}/auth/callback?access=${accessToken}&refresh=${refreshToken}`
    );
  }
);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Apollo start is async — resolve it once and await per request until ready
const apolloServer = new ApolloServer({ typeDefs, resolvers });
const apolloReady = apolloServer.start();

app.use("/graphql", async (req, res, next) => {
  await apolloReady;
  return expressMiddleware(apolloServer, { context: buildContext })(req, res, next);
});

export default app;
