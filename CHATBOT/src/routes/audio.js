const express = require("express");
const fs = require("fs").promises;
const axios = require("axios");
const { runCmd, decodeDataUrl } = require("../utils");

const router = express.Router();

router.post("/transcriptions", async (req, res) => {
  try {
    const { audio_base64_wav, language = "auto" } = req.body;
    if (!audio_base64_wav) return res.status(400).json({ error: "audio_base64_wav é obrigatório" });
    const buf = decodeDataUrl(audio_base64_wav);
    const tmp = `/tmp/mini_gemini_${Date.now()}.wav`;
    await fs.writeFile(tmp, buf);
    try {
      const whisperCli = process.env.WHISPER_CPP_PATH;
      if (whisperCli && (await fs.exists(whisperCli))) {
        const out = await runCmd(whisperCli, [
          "-m",
          process.env.WHISPER_MODEL || "models/ggml-base.bin",
          "-f",
          tmp,
          "-otxt",
        ]);
        return res.json({ text: out });
      }
      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      if (OPENAI_KEY) {
        const formData = new (require("form-data"))();
        formData.append("file", require("fs").createReadStream(tmp));
        formData.append("model", "whisper-1");
        if (language !== "auto") formData.append("language", language);
        const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, ...formData.getHeaders() },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });
        return res.json({ text: response.data.text });
      }
      return res.status(400).json({ error: "Nenhum backend de transcrição configurado" });
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  } catch (err) {
    console.error("Erro em /v1/audio/transcriptions:", err);
    res.status(500).json({ error: err.response?.status === 429 ? "Limite de taxa da API excedido" : "Erro ao processar a solicitação" });
  }
});

module.exports = router;