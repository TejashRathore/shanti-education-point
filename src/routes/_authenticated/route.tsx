import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, MessageCircleQuestion, LogOut, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/lib/use-admin";
import logo from "@/assets/shanti-logo.png";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/library" className="flex items-center gap-2.5">
            <img src={logo} alt="Shanti Education" width={32} height={32} className="size-8" />
            <span className="font-display text-base font-semibold">Shanti Education</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link
                to="/library"
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              >
                <BookOpen className="size-4" />
                <span className="hidden sm:inline">Library</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/chat" activeProps={{ className: "bg-secondary" }}>
                <MessageCircleQuestion className="size-4" />
                <span className="hidden sm:inline">AI tutor</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </nav>
        </div>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
