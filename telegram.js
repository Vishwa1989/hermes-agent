// Each entry is one Telegram bot Hermes answers as. Keyed by the URL slug
// used in the webhook path (/webhook/telegram/:slug), so adding another
// person's bot later is just another env var + registerWebhook call, no
// code changes.
const bots = {
  vishwa: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    secret: process.env.TELEGRAM_WEBHOOK_SECRET,
  },
  rahul: {
    token: process.env.TELEGRAM_BOT_TOKEN_RAHUL,
    secret: process.env.TELEGRAM_WEBHOOK_SECRET_RAHUL,
  },
};

export function getBot(slug) {
  const bot = bots[slug];
  return bot?.token ? bot : null;
}

export function extractIncomingMessage(body) {
  const message = body?.message;
  if (!message || typeof message.text !== "string") return null;
  return { chatId: message.chat.id, text: message.text };
}

// Telegram sends this header on every webhook call once a secret_token is
// registered via setWebhook — cheap way to reject requests that didn't
// actually come from Telegram.
export function verifyTelegramSecret(req, expectedSecret) {
  if (!expectedSecret) return true; // not configured yet — skip check rather than block everything
  return req.get("X-Telegram-Bot-Api-Secret-Token") === expectedSecret;
}

export async function sendTelegramMessage(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    throw new Error(`Telegram send failed: ${res.status} ${await res.text()}`);
  }
}
