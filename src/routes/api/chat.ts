import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPT = `You are the Shanti Education AI tutor, helping Indian school students from class 1 to class 12 (CBSE/state board style).

How you answer:
- Be accurate above all. For any calculation, work it out carefully, then verify the result by a second method or by substituting back before you state the final answer.
- For maths and physics problems: restate what is given, show every step in order with the reasoning for each step, and end with a clearly marked final answer.
- Use LaTeX for all mathematics: inline as $...$ and display as $$...$$. Never write maths as plain ASCII.
- Match the student's class level. For young classes use short sentences and simple words; for classes 9-12 use proper terminology and exam-style presentation.
- For non-maths questions (science, English, social studies, study advice, exam stress) answer clearly and kindly, with short paragraphs or bullet points.
- If a question is ambiguous or missing data, say exactly what is missing and give the most likely interpretation instead of guessing silently.
- Never invent facts, formulas, dates or citations. If you are unsure, say so.
- Do not simply hand over answers to what looks like graded homework without explanation — always teach the method.
- Keep a warm, patient, encouraging tone. Reply in the language the student writes in.`;

type ChatRequestBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("AI is not configured", { status: 500 });
        }

        const lovableAi = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: {
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
        });

        const result = streamText({
          model: lovableAi.responses("openai/gpt-6-astra"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "medium",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
          sendReasoning: true,
        });
      },
    },
  },
});
