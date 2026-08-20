import "dotenv/config";
import express from "express";
import { getHermesReply } from "./hermes.js";
import { verifyWebhook, extractIncomingMessage, sendWhatsAppMessage } from "./whatsapp.js";
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
    const reply = await getHermesReply(messages);
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
    const reply = await getHermesReply(history);
    appendTurn(incoming.from, "assistant", reply);
    await sendWhatsAppMessage(incoming.from, reply);
  } catch (err) {
    console.error("WhatsApp reply failed:", err);
  }
});

app.get("/healthz", (req, res) => res.send("ok"));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Hermes listening on port ${port}`));
