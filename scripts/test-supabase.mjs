import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local manually (no extra deps needed)
const envPath = resolve(process.cwd(), ".env.local");
const envVars = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=").map((p) => p.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
);

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TRANSACTION_ID = "TX-5B1004B5";

console.log(`Fetching transaction: ${TRANSACTION_ID}`);

const { data, error } = await supabase
  .from("transactions")
  .select("*")
  .eq("transaction_id", TRANSACTION_ID)
  .single();

if (error) {
  console.error("Supabase error:", error.message);
  process.exit(1);
}

console.log("Row fetched successfully:");
console.log(JSON.stringify(data, null, 2));
