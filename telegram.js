const apiUrl = (method) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export function extractIncomingMessage(body) {
  const message = body?.message;
  if (!message || typeof message.text !== "string") return null;
  return { chatId: message.chat.id, text: message.text };
}

// Telegram sends this header on every webhook call once a secret_token is
// registered via setWebhook — cheap way to reject requests that didn't
// actually come from Telegram.
export function verifyTelegramSecret(req) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true; // not configured yet — skip check rather than block everything
  return req.get("X-Telegram-Bot-Api-Secret-Token") === expected;
}

export async function sendTelegramMessage(chatId, text) {
  const res = await fetch(apiUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    throw new Error(`Telegram send failed: ${res.status} ${await res.text()}`);
  }
}
