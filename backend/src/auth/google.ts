import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "../db";

// Only register the Google strategy when fully configured. Building the strategy
// with a missing clientID throws at import time, which would crash the whole API
// (incl. GraphQL) on cold start — so guard it and let OAuth degrade gracefully.
export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
);

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("No email from Google"));

          let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

          if (!user) {
            user = await prisma.user.upsert({
              where: { email },
              update: { googleId: profile.id },
              create: {
                email,
                fullName: profile.displayName,
                googleId: profile.id,
                role: "STUDENT",
              },
            });
          }

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
} else {
  console.warn("[auth] Google OAuth not configured — set GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL to enable it.");
}

export default passport;
