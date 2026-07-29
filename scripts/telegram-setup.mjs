/**
 * Point your bot at this deployment. Run once after setting TELEGRAM_BOT_TOKEN
 * and PUBLIC_URL in .env:
 *
 *   npm run telegram:setup
 */
import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  console.error("✗ TELEGRAM_BOT_TOKEN is not set in .env — paste the token BotFather gave you.");
  process.exit(1);
}
if (!publicUrl || !publicUrl.startsWith("https://")) {
  console.error("✗ PUBLIC_URL must be your https deployment URL, e.g. https://bitelog.vercel.app");
  process.exit(1);
}

const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).then((r) => r.json());

const me = await api("getMe");
if (!me.ok) {
  console.error(`✗ Bad token: ${me.description}`);
  process.exit(1);
}
console.log(`✓ Bot: @${me.result.username} (${me.result.first_name})`);

const hook = await api("setWebhook", {
  url: `${publicUrl}/api/telegram/webhook`,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
  ...(secret ? { secret_token: secret } : {}),
});
if (!hook.ok) {
  console.error(`✗ setWebhook failed: ${hook.description}`);
  process.exit(1);
}
console.log(`✓ Webhook → ${publicUrl}/api/telegram/webhook`);
if (!secret) console.log("  ⚠ TELEGRAM_WEBHOOK_SECRET is unset — anyone who guesses the URL can post updates.");

const cmds = await api("setMyCommands", {
  commands: [
    { command: "menu", description: "Buttons for the common stuff" },
    { command: "today", description: "Today's log and totals" },
    { command: "yesterday", description: "Yesterday's log" },
    { command: "week", description: "Last 7 days" },
    { command: "undo", description: "Remove the last meal logged" },
    { command: "reset", description: "Forget the conversation so far" },
    { command: "help", description: "What I can do" },
  ],
});
console.log(cmds.ok ? "✓ Commands registered" : `⚠ setMyCommands: ${cmds.description}`);

const info = await api("getWebhookInfo");
if (info.ok && info.result.last_error_message) {
  console.log(`⚠ Telegram's last delivery error: ${info.result.last_error_message}`);
}

console.log(`\nDone. Open Telegram, message @${me.result.username}, and send /start.`);
