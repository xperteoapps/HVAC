import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Pobiera klucze lokalnego Supabase (`supabase status -o json`) i zapisuje je dla testów. */
export default async function globalSetup() {
  if (process.env.E2E_SERVICE_ROLE_KEY && process.env.E2E_ANON_KEY) return;
  let raw = "";
  try {
    raw = execSync("npx supabase status -o json", { cwd: join(HERE, ".."), stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch (e) {
    throw new Error(`Lokalny Supabase nie działa — uruchom \`npx supabase start\` (${e instanceof Error ? e.message : e})`);
  }
  const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Record<string, string>;
  const env = {
    E2E_API_URL: json.API_URL ?? "http://127.0.0.1:54321",
    E2E_ANON_KEY: json.ANON_KEY,
    E2E_SERVICE_ROLE_KEY: json.SERVICE_ROLE_KEY,
  };
  Object.assign(process.env, env);
  writeFileSync(join(HERE, ".env.e2e.json"), JSON.stringify(env));
}
