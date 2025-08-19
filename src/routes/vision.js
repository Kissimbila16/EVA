const express = require("express");
const tf = require("@tensorflow/tfjs-node");
const { imageToHist, heuristicCaption, decodeDataUrl, argmax, oneHot, cosine } = require("../utils");
const { imageModel, imageClasses, compileModel } = require("../models");

const router = express.Router();

router.post("/caption", async (req, res) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) return res.status(400).json({ error: "image_base64 é obrigatório" });
    const buf = decodeDataUrl(image_base64);
    const caption = await heuristicCaption(buf);
    const meta = await require("sharp")(buf).metadata();
    res.json({ caption, width: meta.width, height: meta.height });
  } catch (err) {
    console.error("Erro em /v1/vision/caption:", err);
    res.status(500).json({ error: "Erro ao processar a solicitação" });
  }
});

router.post("/classify", async (req, res) => {
  try {
    const { image_base64 } = req.body;
    if (!image_base64) return res.status(400).json({ error: "image_base64 é obrigatório" });
    const buf = decodeDataUrl(image_base64);
    const hist = await imageToHist(buf);
    const logits = tf.tidy(() => imageModel().predict(tf.tensor2d([hist])).arraySync()[0]);
    const pred = argmax(logits);
    res.json({ logits, pred });
  } catch (err) {
    console.error("Erro em /v1/vision/classify:", err);
    res.status(500).json({ error: "Erro ao processar a solicitação" });
  }
});

router.post("/train", async (req, res) => {
  try {
    const { image_base64, label, lr = 0.1 } = req.body;
    if (!image_base64 || !Number.isInteger(label) || label < 0 || label >= imageClasses()) {
      return res.status(400).json({ error: "Imagem e label válido são obrigatórios" });
    }
    compileModel(imageModel(), lr);
    const buf = decodeDataUrl(image_base64);
    const hist = await imageToHist(buf);
    const xs = tf.tensor2d([hist]);
    const ys = tf.tensor2d([oneHot(label, imageClasses())]);
    const h = await imageModel().fit(xs, ys, { epochs: 1, verbose: 0 });
    xs.dispose();
    ys.dispose();
    res.json({ status: "ok", loss: h.history.loss ? h.history.loss[0] : null });
  } catch (err) {
    console.error("Erro em /v1/train/image:", err);
    res.status(500).json({ error: "Erro ao processar a solicitação" });
  }
});

router.post("/match", async (req, res) => {
  try {
    const { text, image_base64 } = req.body;
    if (!text || !image_base64) return res.status(400).json({ error: "Texto e image_base64 são obrigatórios" });
    const tvec = require("../utils").textToVec(text);
    const buf = decodeDataUrl(image_base64);
    const hist = await imageToHist(buf);
    const score = cosine(tvec, hist);
    res.json({ score });
  } catch (err) {
    console.error("Erro em /v1/vision/match:", err);
    res.status(500).json({ error: "Erro ao processar a solicitação" });
  }
});

module.exports = router;