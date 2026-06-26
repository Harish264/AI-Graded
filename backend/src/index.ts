import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs } from "./schema/typeDefs";
import { resolvers } from "./schema/resolvers";
import { buildContext } from "./context";
import { prisma } from "./db";
import passport from "./auth/google";
import { signAccess, signRefresh } from "./auth/jwt";
import { addDays } from "./utils";

async function main() {
  const app = express();

  const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow requests with no origin (curl, Postman, SSR) and any listed origin
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: ${origin} not allowed`));
      },
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(passport.initialize());

  // Google OAuth routes
  app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"], session: false })
  );

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: `${process.env.WEB_ORIGIN}/login?error=oauth` }),
    async (req, res) => {
      const user = req.user as { id: string; role: string };
      const payload = { userId: user.id, role: user.role };
      const refreshToken = signRefresh(payload);
      await prisma.refreshToken.create({
        data: { token: refreshToken, userId: user.id, expiresAt: addDays(7) },
      });
      const accessToken = signAccess(payload);
      // Redirect to frontend with tokens in query string (use HTTP-only cookie in production)
      res.redirect(
        `${process.env.WEB_ORIGIN}/auth/callback?access=${accessToken}&refresh=${refreshToken}`
      );
    }
  );

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  app.use(
    "/graphql",
    expressMiddleware(server, { context: buildContext })
  );

  const PORT = process.env.PORT ?? 4000;
  app.listen(PORT, () => {
    console.log(`🚀 GradeAI API running at http://localhost:${PORT}/graphql`);
    console.log(`🔑 Google OAuth: http://localhost:${PORT}/auth/google`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
