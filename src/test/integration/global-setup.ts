import { execSync } from "node:child_process";

// Brings the test database up to prisma/migrations before the run (the tests empty the
// tables themselves). Refuses any database whose name doesn't end in "test".
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Set TEST_DATABASE_URL to a throwaway Postgres database (its name must end in 'test')");
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("test")) throw new Error(`Refusing to wipe "${name}": the test database name must end in "test"`);

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
