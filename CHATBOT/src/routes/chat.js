const express = require("express");
const fs = require("fs").promises;
const { FILE_PATH } = require("../config");
const { generateReply } = require("../nlp");

const router = express.Router();
let conversations = [];
let pendingWrite = null;

async function saveConversations() {
  if (pendingWrite) clearTimeout(pendingWrite);
  pendingWrite = setTimeout(async () => {
    await fs.writeFile(FILE_PATH, JSON.stringify(conversations, null, 2));
    pendingWrite = null;
  }, 1000);
}

(async () => {
  try {
    await fs.access(FILE_PATH);
    conversations = JSON.parse(await fs.readFile(FILE_PATH, "utf-8"));
  } catch {
    conversations = [];
  }
})();

router.post("/", async (req, res) => {
  try {
    const { text, pred = 2 } = req.body;
    if (!text) return res.status(400).json({ error: "Texto é obrigatório" });

    const reply = generateReply(pred, text);
    conversations.push({ user: text, bot: reply });
    await saveConversations();

    res.json({ reply });
  } catch (err) {
    console.error("Erro em /chat:", err);
    res.status(500).json({ error: "Erro ao processar a solicitação" });
  }
});

module.exports = router;
