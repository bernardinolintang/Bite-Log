export class TelegramError extends Error {}

const API = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new TelegramError("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

async function call<T>(method: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new TelegramError(`${method} failed: ${json.description ?? res.status}`);
  return json.result as T;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export async function sendMessage(
  chatId: string,
  text: string,
  buttons?: InlineButton[][],
): Promise<void> {
  await call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export async function sendChatAction(chatId: string, action = "typing"): Promise<void> {
  // Best-effort: a missing "typing…" indicator must never fail the request.
  await call("sendChatAction", { chat_id: chatId, action }).catch(() => undefined);
}

export async function answerCallbackQuery(id: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) }).catch(
    () => undefined,
  );
}

export async function editMessageText(
  chatId: string,
  messageId: number,
  text: string,
): Promise<void> {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  }).catch(() => undefined);
}

/** Download a Telegram photo and return it as a data URL for the vision model. */
export async function fetchPhotoDataUrl(fileId: string): Promise<string> {
  const file = await call<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new TelegramError("photo has no file_path");
  const res = await fetch(`${API}/file/bot${token()}/${file.file_path}`);
  if (!res.ok) throw new TelegramError(`photo download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = file.file_path.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function setMyCommands(
  commands: { command: string; description: string }[],
): Promise<void> {
  await call("setMyCommands", { commands });
}

/** Escape user/model text before embedding it in a parse_mode: "HTML" message. */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
