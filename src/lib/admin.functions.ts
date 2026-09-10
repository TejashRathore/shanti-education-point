import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

/** Returns every student with their email, for the admin dashboard. */
export const listStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw new Error(error.message);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, class_level");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: progress } = await supabaseAdmin
      .from("study_progress")
      .select("user_id, status, minutes_spent");

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const adminIds = new Set(
      (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );

    return users.users.map((u) => {
      const mine = (progress ?? []).filter((p) => p.user_id === u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        joined: u.created_at,
        lastSeen: u.last_sign_in_at ?? null,
        fullName: profileMap.get(u.id)?.full_name ?? "",
        classLevel: profileMap.get(u.id)?.class_level ?? null,
        isAdmin: adminIds.has(u.id),
        opened: mine.length,
        completed: mine.filter((p) => p.status === "completed").length,
        minutes: mine.reduce((sum, p) => sum + (p.minutes_spent ?? 0), 0),
      };
    });
  });

/** Grants or removes admin access for an existing account, by email. */
export const setAdminByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; makeAdmin: boolean }) => {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Please enter a valid email address.");
    return { email, makeAdmin: Boolean(input.makeAdmin) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw new Error(error.message);

    const match = users.users.find((u) => (u.email ?? "").toLowerCase() === data.email);
    if (!match) throw new Error("No account with that email has signed up yet.");

    if (data.makeAdmin) {
      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: match.id, role: "admin" }, { onConflict: "user_id,role" });
      if (insertError) throw new Error(insertError.message);
    } else {
      if (match.id === context.userId) throw new Error("You cannot remove your own access.");
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", match.id)
        .eq("role", "admin");
      if (deleteError) throw new Error(deleteError.message);
    }

    return { ok: true };
  });
