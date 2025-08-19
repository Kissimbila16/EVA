const express = require("express");
const tf = require("@tensorflow/tfjs-node");
const { textToVec, argmax, oneHot } = require("../utils");
const { textModel, textClasses, compileModel } = require("../models");

const router = express.Router();

router.post("/classify", async (req, res) => {
  try {
    const { text = "" } = req.body;
    if (!text) return res.status(400).json({ error: "Texto é obrigatório" });
    const vec = textToVec(text);
    const logits = tf.tidy(() => textModel().predict(tf.tensor2d([vec])).arraySync()[0]);
    const pred = argmax(logits);
    res.json({ logits, pred });
  } catch (err) {
    console.error("Erro em /v1/text/classify:", err);
    res.status(500).json({ error: "Erro ao processar a solicitação" });
  }
});

router.post("/train", async (req, res) => {
  try {
    const { text, label, lr = 0.1 } = req.body;
    if (!text || !Number.isInteger(label) || label < 0 || label >= textClasses()) {
      return res.status(400).json({ error: "Texto e label válido são obrigatórios" });
    }
    compileModel(textModel(), lr);
    const vec = textToVec(text);
    const xs = tf.tensor2d([vec]);
    const ys = tf.tensor2d([oneHot(label, textClasses())]);
    const h = await textModel().fit(xs, ys, { epochs: 1, verbose: 0 });
    xs.dispose();
    ys.dispose();
    res.json({ status: "ok", loss: h.history.loss ? h.history.loss[0] : null });
  } catch (err) {
    console.error("Erro em /v1/train/text:", err);
    res.status(500).json({ error: "Erro ao processar a solicitação" });
  }
});

module.exports = router;