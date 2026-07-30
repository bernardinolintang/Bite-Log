export interface Clarification {
  question: string;
  answer: string;
}

export interface AnalyzeInput {
  imageDataUrl?: string;
  description?: string;
  mealType: string;
  clarifications?: Clarification[];
  /** A previous breakdown being revised, as plain text. */
  previous?: string;
  /** What the user says was wrong with it. */
  correction?: string;
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};
