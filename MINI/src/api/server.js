const express = require("express");
const cors = require("cors");
const { processInput, initClassifier } = require("../../index"); // Adjusted path
const logger = require("../config/logger");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post("/process", async (req, res) => {
  try {
    const { text, sessionId, language } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Texto é obrigatório" });
    }
    const response = await processInput(text, sessionId, language || "pt");
    res.json({ response: response.response, intent: response.intent, confidence: response.confidence });
  } catch (error) {
    logger.error(`Erro na API /process: ${error.message}`);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

async function startServer() {
  try {
    if (typeof initClassifier !== "function") {
      throw new Error("initClassifier is not a function. Check imports in index.js");
    }
    await initClassifier("pt");
    app.listen(port, () => {
      logger.info(`Servidor rodando na porta ${port}`);
    });
  } catch (error) {
    logger.error(`Erro ao iniciar o servidor: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = { startServer };