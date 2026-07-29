import OpenAI from "openai";
import { analysisSchema, type Analysis } from "./schema";
import { buildMessages } from "./prompt";
import type { AnalyzeInput, ChatMessage } from "./types";

export class AnalysisError extends Error {}

/** The model provider throttled us — retrying immediately cannot help. */
export class RateLimitError extends AnalysisError {}

export type Completer = (messages: ChatMessage[]) => Promise<string>;

function extractJson(raw: string): unknown {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  return JSON.parse(trimmed);
}

export async function analyzeWith(complete: Completer, input: AnalyzeInput): Promise<Analysis> {
  const messages = buildMessages(input);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptMessages: ChatMessage[] =
      attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: "user",
              content: `Your previous reply was not valid (${lastError}). Reply again with ONLY the JSON object in the required shape.`,
            },
          ];
    let raw: string;
    try {
      raw = await complete(attemptMessages);
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }
    let json: unknown;
    try {
      json = extractJson(raw);
    } catch {
      lastError = "response was not valid JSON";
      continue;
    }
    const parsed = analysisSchema.safeParse(json);
    if (parsed.success) return parsed.data;
    lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  throw new AnalysisError(`AI analysis failed: ${lastError}`);
}

/** Vision-capable model on Groq. Kept in one place so a decommission is a one-line fix. */
export const DEFAULT_GROQ_MODEL = "qwen/qwen3.6-27b";

export interface CompleterOptions {
  /** Force a JSON object reply. Off for conversational answers. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export function groqCompleter(opts: CompleterOptions = {}): Completer {
  const { json = true, maxTokens = 3000, temperature = 0.2 } = opts;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new AnalysisError("GROQ_API_KEY is not set");
  const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  return async (messages) => {
    // `reasoning_effort: "none"` is a Groq extension the OpenAI SDK types don't model.
    // These models "think" before answering; left on, the reasoning eats the completion
    // budget (truncating the JSON mid-object) and costs ~30x the latency — 35s vs 1.2s
    // on a photo. Nutrition estimation does not need it.
    const params = {
      model,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      temperature,
      max_completion_tokens: maxTokens,
      reasoning_effort: "none",
    } as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;
    let res;
    try {
      res = await client.chat.completions.create(params);
    } catch (err) {
      if (err instanceof OpenAI.APIError && err.status === 429) {
        throw new RateLimitError("rate limited by Groq");
      }
      throw err;
    }
    const choice = res.choices[0];
    // A truncated reply is invalid JSON anyway; say so plainly so the retry is informed.
    if (choice?.finish_reason === "length" && json) {
      throw new AnalysisError("reply was cut off before the JSON was complete");
    }
    return choice?.message?.content ?? "";
  };
}

export async function analyzeMeal(input: AnalyzeInput): Promise<Analysis> {
  return analyzeWith(groqCompleter(), input);
}
