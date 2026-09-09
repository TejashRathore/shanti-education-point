import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatEntry,
});

function ChatEntry() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: existing } = await supabase
        .from("chat_threads")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1);

      const latest = existing?.[0];
      if (latest) {
        navigate({
          to: "/chat/$threadId",
          params: { threadId: latest.id },
          replace: true,
        });
        return;
      }

      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: userData.user.id, title: "New chat" })
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Could not open the tutor. Please try again.");
        return;
      }
      navigate({ to: "/chat/$threadId", params: { threadId: data.id }, replace: true });
    })();
  }, [navigate]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Shimmer>Opening your tutor...</Shimmer>
    </div>
  );
}
