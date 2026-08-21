import "dotenv/config";
import express from "express";
import { getHermesReply } from "./hermes.js";
import { verifyWebhook, extractIncomingMessage, sendWhatsAppMessage } from "./whatsapp.js";
import {
  getBot,
  extractIncomingMessage as extractTelegramMessage,
  verifyTelegramSecret,
  sendTelegramMessage,
} from "./telegram.js";
import { getHistory, appendTurn } from "./sessions.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// Dev/debug channel — same brain as WhatsApp, useful for testing without Meta.
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  try {
    const reply = await getHermesReply(messages, "web");
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Hermes failed to respond" });
  }
});

// Meta calls this once (GET) to verify you control the webhook URL.
app.get("/webhook/whatsapp", (req, res) => {
  const challenge = verifyWebhook(req.query);
  if (challenge) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// Meta calls this (POST) for every inbound WhatsApp message.
app.post("/webhook/whatsapp", async (req, res) => {
  res.sendStatus(200); // ack immediately — Meta retries aggressively if we're slow

  const incoming = extractIncomingMessage(req.body);
  if (!incoming) return;

  const history = appendTurn(incoming.from, "user", incoming.text);
  try {
    const reply = await getHermesReply(history, incoming.from);
    appendTurn(incoming.from, "assistant", reply);
    await sendWhatsAppMessage(incoming.from, reply);
  } catch (err) {
    console.error("WhatsApp reply failed:", err);
  }
});

// Telegram POSTs every inbound message here — no GET-verification handshake
// needed (unlike Meta). One route per bot, identified by :slug, so each
// person's bot is registered against its own token (multi-bot, same brain).
app.post("/webhook/telegram/:slug", async (req, res) => {
  res.sendStatus(200); // ack immediately

  const bot = getBot(req.params.slug);
  if (!bot) return; // unknown bot slug

  if (!verifyTelegramSecret(req, bot.secret)) return; // silently drop unverified requests

  const incoming = extractTelegramMessage(req.body);
  if (!incoming) return;

  const userId = `telegram:${incoming.chatId}`;
  const history = appendTurn(userId, "user", incoming.text);
  try {
    const reply = await getHermesReply(history, userId);
    appendTurn(userId, "assistant", reply);
    await sendTelegramMessage(bot.token, incoming.chatId, reply);
  } catch (err) {
    console.error(`Telegram (${req.params.slug}) reply failed:`, err);
  }
});

app.get("/healthz", (req, res) => res.send("ok"));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Hermes listening on port ${port}`));
