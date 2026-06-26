import { createApp } from "./app";

async function main() {
  const app = await createApp();
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
