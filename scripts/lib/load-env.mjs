// scripts/lib/load-env.mjs
// Next.js itself loads .env.local automatically, but standalone Node
// scripts need to load it explicitly. Prefers .env.local (this project's
// actual file) and falls back to .env for anyone using that convention
// instead.
import { config } from "dotenv";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// This file lives at scripts/lib/load-env.mjs, so the project root is two
// levels up (scripts/lib -> scripts -> root).
const libDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(libDir, "..", "..");

const envLocal = path.join(projectRoot, ".env.local");
const envDefault = path.join(projectRoot, ".env");

config({ path: existsSync(envLocal) ? envLocal : envDefault });
