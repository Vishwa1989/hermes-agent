import { createClient } from "@supabase/supabase-js";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

const MAX_MEMORIES = 20;

// Builds the extra system-prompt block for a user: taught skills + remembered
// facts. Returns "" if Supabase isn't configured yet, so the rest of Hermes
// keeps working without it.
//
// sharedSkillScope (optional) lets a whole bot (not just one person) share a
// set of skills — e.g. every chat on @Gentleborn_bot gets the EHR-ranking
// skill without each person having to be taught it individually. Memories
// stay strictly per-userId regardless — those are personal facts, never
// shared across a bot's whole userbase.
export async function getMemoryContext(userId, sharedSkillScope) {
  if (!supabase) return "";

  const skillScopes = sharedSkillScope ? [userId, sharedSkillScope] : [userId];

  const [{ data: skills }, { data: memories }] = await Promise.all([
    supabase.from("skills").select("name, instructions").in("user_id", skillScopes),
    supabase
      .from("memories")
      .select("content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_MEMORIES),
  ]);

  const parts = [];
  if (skills?.length) {
    parts.push(
      "Skills you've been taught to follow automatically:\n" +
        skills.map((s) => `- ${s.name}: ${s.instructions}`).join("\n")
    );
  }
  if (memories?.length) {
    parts.push(
      "Things you remember about this user:\n" + memories.map((m) => `- ${m.content}`).join("\n")
    );
  }
  return parts.join("\n\n");
}

export async function saveMemory(userId, content) {
  if (!supabase) throw new Error("Memory isn't configured yet (missing Supabase credentials).");
  const { error } = await supabase.from("memories").insert({ user_id: userId, content });
  if (error) throw new Error(error.message);
  return `Remembered: ${content}`;
}

export async function saveSkill(userId, name, instructions) {
  if (!supabase) throw new Error("Memory isn't configured yet (missing Supabase credentials).");
  const { error } = await supabase
    .from("skills")
    .upsert(
      { user_id: userId, name, instructions, updated_at: new Date().toISOString() },
      { onConflict: "user_id,name" }
    );
  if (error) throw new Error(error.message);
  return `Saved skill "${name}".`;
}
