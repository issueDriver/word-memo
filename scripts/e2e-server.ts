import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { spawn } from "node:child_process";

async function main() {
  const database = await PGlite.create();
  await migrate(drizzle(database), { migrationsFolder: "drizzle" });
  const server = new PGLiteSocketServer({
    db: database,
    host: "127.0.0.1",
    port: 55439,
    maxConnections: 20,
  });
  await server.start();
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--port",
      "3100",
      "--hostname",
      "127.0.0.1",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55439/postgres",
        E2E_TEST: "1",
      },
    },
  );
  let shutdown: Promise<void> | undefined;
  function stop() {
    return (shutdown ??= (async () => {
      child.kill("SIGTERM");
      await server.stop();
      await database.close();
    })());
  }
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
  child.on("exit", (code) => void stop().then(() => process.exit(code ?? 0)));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
