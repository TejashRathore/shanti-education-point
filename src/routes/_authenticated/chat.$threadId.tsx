import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import logo from "@/assets/shanti-logo.png";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "AI tutor — Shanti Education" },
      {
        name: "description",
        content:
          "Ask the Shanti Education AI tutor any question and get step-by-step help with maths, science and more.",
      },
      { property: "og:title", content: "AI tutor — Shanti Education" },
      {
        property: "og:description",
        content: "Step-by-step help with maths, science and every school subject.",
      },
    ],
  }),
  component: ChatPage,
});

type ThreadRow = { id: string; title: string; updated_at: string };
type MessageRow = { id: string; role: string; parts: unknown };

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const threadsQuery = useQuery({
    queryKey: ["chat-threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ThreadRow[];
    },
  });

  const historyQuery = useQuery({
    queryKey: ["chat-messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, parts")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as MessageRow[]).map((row) => ({
        id: row.id,
        role: row.role as UIMessage["role"],
        parts: (row.parts ?? []) as UIMessage["parts"],
      })) satisfies UIMessage[];
    },
  });

  async function newChat() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: userData.user.id, title: "New chat" })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Could not start a new chat.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  async function deleteThread(id: string) {
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete that chat.");
      return;
    }
    const remaining = (threadsQuery.data ?? []).filter((t) => t.id !== id);
    await queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
    if (id === threadId) {
      if (remaining.length > 0) {
        navigate({ to: "/chat/$threadId", params: { threadId: remaining[0].id } });
      } else {
        navigate({ to: "/chat" });
      }
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block">
        <Button className="w-full" onClick={newChat}>
          <Plus className="size-4" /> New chat
        </Button>
        <div className="mt-4 space-y-1">
          {(threadsQuery.data ?? []).map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1 rounded-lg px-1 ${
                t.id === threadId ? "bg-secondary" : "hover:bg-secondary/60"
              }`}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-sm"
              >
                <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{t.title}</span>
              </Link>
              <button
                type="button"
                aria-label="Delete chat"
                onClick={() => deleteThread(t.id)}
                className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="surface-panel flex h-[calc(100vh-8.5rem)] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <span className="text-sm font-medium">AI tutor</span>
          <Button size="sm" variant="outline" onClick={newChat}>
            <Plus className="size-4" /> New
          </Button>
        </div>
        {historyQuery.isLoading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <ChatWindow
            key={threadId}
            threadId={threadId}
            initialMessages={historyQuery.data ?? []}
          />
        )}
      </section>
    </div>
  );
}

const STARTERS = [
  "Solve: if 3x² − 7x + 2 = 0, find x",
  "Explain photosynthesis for class 7",
  "Help me understand fractions with examples",
  "Make a 7-day revision plan for my maths exam",
];

function ChatWindow({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const savedIds = useRef(new Set(initialMessages.map((m) => m.id)));

  const persist = useCallback(
    async (message: UIMessage) => {
      if (savedIds.current.has(message.id)) return;
      savedIds.current.add(message.id);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { error } = await supabase.from("chat_messages").insert({
        thread_id: threadId,
        user_id: userData.user.id,
        role: message.role,
        parts: message.parts,
      });
      if (error) {
        savedIds.current.delete(message.id);
        console.error(error);
        toast.error("This message could not be saved to your history.");
      }
    },
    [threadId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }) => {
      void persist(message);
    },
    onError: (error) => {
      console.error(error);
      toast.error("The tutor could not answer just now. Please try again.");
    },
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const isBusy = status === "submitted" || status === "streaming";

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setInput("");

    const isFirst = messages.length === 0;
    sendMessage({ text: trimmed });

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.from("chat_messages").insert({
        thread_id: threadId,
        user_id: userData.user.id,
        role: "user",
        parts: [{ type: "text", text: trimmed }],
      });
      await supabase
        .from("chat_threads")
        .update(
          isFirst
            ? { title: trimmed.slice(0, 60), updated_at: new Date().toISOString() }
            : { updated_at: new Date().toISOString() },
        )
        .eq("id", threadId);
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
    }
  }

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <img
                src={logo}
                alt="Shanti Education tutor"
                width={64}
                height={64}
                className="size-16"
                loading="lazy"
              />
              <h2 className="mt-4 text-xl font-semibold">Ask me anything</h2>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                Maths, science, English, homework doubts or exam planning — I will explain it
                step by step.
              </p>
              <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) =>
                    part.type === "text" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Shimmer>Thinking...</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-4">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            onSubmit={(message, event) => {
              event.preventDefault();
              void submit(message.text ?? input);
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question, e.g. solve 2x + 5 = 17"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} onStop={stop} disabled={!input.trim()} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </>
  );
}
