import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
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
import logo from "@/assets/shanti-education-point-logo.png.asset.json";

export function FloatingTutor() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, stop } = useChat({
    id: "floating-tutor",
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    sendMessage({ text: trimmed });
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(32rem,80vh)] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-lift)]">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <img src={logo.url} alt="" width={28} height={28} className="h-7 w-auto" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Ask Shanti Sir</p>
              <p className="text-xs text-muted-foreground">Quick help, any time</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close the tutor"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <Conversation className="flex-1">
            <ConversationContent>
              {messages.length === 0 ? (
                <div className="px-2 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Ask me any doubt — maths, science, English or homework.
                  </p>
                  <div className="mt-4 grid gap-2">
                    {["Solve 2x + 5 = 17", "Explain gravity simply"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => submit(s)}
                        className="rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
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

          <div className="border-t border-border p-3">
            <PromptInput
              onSubmit={(message, event) => {
                event.preventDefault();
                submit(message.text ?? input);
              }}
            >
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question..."
              />
              <PromptInputFooter className="justify-between">
                <Link
                  to="/chat"
                  className="px-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Open full tutor
                </Link>
                <PromptInputSubmit status={status} onStop={stop} disabled={!input.trim()} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask the AI tutor"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-lift)] transition-transform hover:scale-[1.03]"
        >
          <MessageCircle className="size-5" />
          <span className="hidden sm:inline">Ask a doubt</span>
        </button>
      )}
    </>
  );
}
