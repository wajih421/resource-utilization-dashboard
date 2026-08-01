// scripts/seed-auth-users.mjs
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import "./lib/load-env.mjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fakeEmailFor(employeeId) {
  return `${employeeId.trim().toLowerCase()}@rot-internal.local`;
}

function randomPassword() {
  return randomBytes(24).toString("base64");
}

// Fetch ALL existing auth users (paginated) and build email -> id map
async function getAllAuthUsersByEmail() {
  const map = new Map();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users) {
      map.set(u.email.toLowerCase(), u.id);
    }
    if (data.users.length < perPage) break;
    page++;
  }
  return map;
}

async function main() {
  const { data: resources, error } = await supabase
    .from("resources")
    .select("id, name, employee_id");
  if (error) throw error;
  console.log(`Found ${resources.length} resources.`);

  const { data: existingProfiles, error: profErr } = await supabase
    .from("profiles")
    .select("resource_id");
  if (profErr) throw profErr;
  const profileDone = new Set((existingProfiles ?? []).map((p) => p.resource_id));

  console.log("Fetching existing Auth users...");
  const authByEmail = await getAllAuthUsersByEmail();
  console.log(`Found ${authByEmail.size} existing Auth users.`);

  let createdAuth = 0;
  let reusedAuth = 0;
  let createdProfile = 0;
  let skippedProfile = 0;
  const failures = [];

  for (const r of resources) {
    if (profileDone.has(r.id)) {
      skippedProfile++;
      continue;
    }

    const email = fakeEmailFor(r.employee_id);
    let authUserId = authByEmail.get(email);

    if (!authUserId) {
      const { data: authUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
      });
      if (createErr) {
        failures.push({ name: r.name, employee_id: r.employee_id, step: "createUser", error: createErr.message });
        continue;
      }
      authUserId = authUser.user.id;
      createdAuth++;
    } else {
      reusedAuth++;
    }

    const { error: profileErr } = await supabase.from("profiles").insert({
      id: authUserId,
      email,
      role: "resource",
      resource_id: r.id,
      has_custom_password: false,
    });

    if (profileErr) {
      failures.push({ name: r.name, employee_id: r.employee_id, step: "insertProfile", error: profileErr.message });
      continue;
    }

    createdProfile++;
  }

  console.log(
    `Auth users -> created: ${createdAuth}, reused: ${reusedAuth} | Profiles -> created: ${createdProfile}, skipped: ${skippedProfile}`
  );
  if (failures.length) {
    console.log("Failures:");
    console.table(failures);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });