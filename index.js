/**
 * mini-gemini-js
 * Single-file multimodal prototype:
 * - text embeddings (hash-bow 256) + linear head (tfjs) for classification & train
 * - image histogram 256 + linear head for classification & train
 * - heuristic image caption
 * - audio transcription via whisper.cpp CLI or OpenAI (optional)
 *
 * Run:
 *  npm install
 *  node index.js
 *
 * Endpoints documented below.
 */



const express = require("express");
const bodyParser = require("body-parser");
const tf = require("@tensorflow/tfjs-node");
const sharp = require("sharp");
const crypto = require("crypto");
const fs = require("fs");
const { spawn } = require("child_process");
const axios = require("axios");
const natural = require("natural");

const formidable = require("formidable");
const wavDecoder = require("wav-decoder");

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

// ---------------------------
// Config
// ---------------------------
const PORT = process.env.PORT || 8080;
const TEXT_DIM = 256;
const IMAGE_DIM = 256;
const DEFAULT_CLASSES = 4;
const CHECKPOINT_DIR = "./checkpoints";

// Make checkpoint dir
if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });

// ---------------------------
// Utility: text -> 256-d hash-BOW vector
// ---------------------------
function textToVec(text) {
  const v = new Array(TEXT_DIM).fill(0.0);
  if (!text) return v;
  const toks = text.toLowerCase().split(/\s+/).filter(Boolean);
  toks.forEach((t, i) => {
    const h = crypto.createHash("sha256").update(t).digest();
    // take first 4 bytes as unsigned int
    const idx = (h.readUInt32LE(0) % TEXT_DIM);
    v[idx] += 1.0 + ((i % 3) * 0.1);
  });
  // l2 normalize
  const norm = Math.sqrt(v.reduce((s,x)=>s+x*x,0)) || 1.0;
  return v.map(x => x / norm);
}

// ---------------------------
// Utility: image -> grayscale histogram 256
// input: Buffer of image bytes
// ---------------------------
async function imageToHist(buffer) {
  const img = sharp(buffer).resize(256,256, { fit: "inside" }).ensureAlpha();
  const raw = await img.raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw; // data is RGBA
  const hist = new Array(IMAGE_DIM).fill(0.0);
  for (let i = 0; i < data.length; i += info.channels) {
    // convert to luminance
    const r = data[i], g = data[i+1], b = data[i+2];
    const y = Math.round(0.2126*r + 0.7152*g + 0.0722*b);
    hist[Math.max(0, Math.min(255, y))] += 1.0;
  }
  const norm = Math.sqrt(hist.reduce((s,x)=>s+x*x,0)) || 1.0;
  return hist.map(x => x / norm);
}

// ---------------------------
// Simple caption heuristic
// ---------------------------
async function heuristicCaption(buffer) {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const small = await img.resize(32,32).raw().toBuffer();
  // compute average brightness
  let sum=0, count=0;
  for (let i=0;i<small.length;i+=meta.channels) {
    const r=small[i], g=small[i+1], b=small[i+2];
    const y = (0.2126*r + 0.7152*g + 0.0722*b) / 255.0;
    sum += y; count++;
  }
  const avg = sum / Math.max(1,count);
  const mood = avg > 0.6 ? "clara" : (avg < 0.35 ? "escura" : "neutra");
  return `Imagem ${meta.width || "?"}x${meta.height || "?"}, iluminação ${mood}.`;
}

// ---------------------------
// Models (tfjs) - linear heads
// ---------------------------
let textClasses = DEFAULT_CLASSES;
let imageClasses = DEFAULT_CLASSES;

// build or load models
let textModel = createLinearModel(TEXT_DIM, textClasses);
let imageModel = createLinearModel(IMAGE_DIM, imageClasses);

function createLinearModel(inputDim, outDim) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [inputDim], units: outDim, activation: "linear" }));
  // using sparseCategoricalCrossentropy expects logits + from_logits false if softmax, so we'll use logits + softmax for prediction.
  model.compile({ optimizer: tf.train.sgd(0.1), loss: tf.losses.softmaxCrossEntropy });
  return model;
}

// ---------------------------
// Save / Load checkpoint helpers
// ---------------------------
async function saveCheckpoint(name="text-model") {
  const path = `file://${CHECKPOINT_DIR}/${name}`;
  await textModel.save(path + "_text");
  await imageModel.save(path + "_image");
  return { savedTo: CHECKPOINT_DIR };
}
async function loadCheckpoint(name="text-model") {
  const textPath = `file://${CHECKPOINT_DIR}/${name}_text/model.json`;
  const imagePath = `file://${CHECKPOINT_DIR}/${name}_image/model.json`;
  if (!fs.existsSync(`${CHECKPOINT_DIR}/${name}_text/model.json`) || !fs.existsSync(`${CHECKPOINT_DIR}/${name}_image/model.json`)) {
    throw new Error("Checkpoint não encontrado. Salve primeiro.");
  }
  textModel = await tf.loadLayersModel(textPath);
  imageModel = await tf.loadLayersModel(imagePath);
  return { loaded: true };
}

// ---------------------------
// Cosine similarity helper
// ---------------------------
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i=0;i<a.length;i++){ dot += a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i];}
  return (dot / (Math.sqrt(na)*Math.sqrt(nb) + 1e-9) + 1) / 2;
}

// ---------------------------
// Endpoints
// ---------------------------

app.get("/v1/health", (req,res)=>res.json({status:"ok"}));



// === NLP Configuração ===
const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();

// Treinamento simples de intenções
classifier.addDocument("oi", "saudacao");
classifier.addDocument("olá", "saudacao");
classifier.addDocument("bom dia", "saudacao");
classifier.addDocument("até logo", "despedida");
classifier.addDocument("tchau", "despedida");
classifier.addDocument("como você está", "status");
classifier.addDocument("preciso de ajuda", "ajuda");
classifier.addDocument("me conta uma piada", "piada");
classifier.addDocument("estou feliz", "positivo");
classifier.addDocument("estou triste", "negativo");

classifier.train();

// === Função para gerar respostas ===
function generateReply(pred, text) {
  const intent = classifier.classify(text.toLowerCase());

  switch (intent) {
    case "saudacao":
      return "Olá! Como você está hoje?";
    case "despedida":
      return "Até logo! Foi ótimo conversar com você.";
    case "status":
      return "Estou bem, obrigado por perguntar! E você?";
    case "ajuda":
      return "Claro, estou aqui para ajudar. Qual é a sua dúvida?";
    case "piada":
      return "😄 Aqui vai uma: Qual o animal mais antigo do mundo? A zebra, porque ainda é preta e branca!";
    case "positivo":
      return "Que bom! Isso me deixa feliz também.";
    case "negativo":
      return "Sinto muito ouvir isso. Quer conversar sobre o que aconteceu?";
    default:
      switch (pred) {
        case 0:
          return "Isso parece algo positivo! Pode me contar mais?";
        case 1:
          return "Parece uma situação complicada. Quer me explicar melhor?";
        default:
          return "Interessante! Me dê mais detalhes.";
      }
  }
}


// === Carregar conversas ===
let conversations = [];
const FILE_PATH = "./conversations.json";

if (fs.existsSync(FILE_PATH)) {
  conversations = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
}

app.post("/chat", (req, res) => {
  const { text, pred = 2 } = req.body;

  const reply = generateReply(pred, text);

  // Guardar no histórico
  conversations.push({ user: text, bot: reply });
  fs.writeFileSync(FILE_PATH, JSON.stringify(conversations, null, 2));

  res.json({ reply });
});

// TEXT classify
app.post("/v1/text/classify", async (req,res) => {
  const text = req.body.text || "";
  const vec = textToVec(text);
  const logits = tf.tidy(()=> textModel.predict(tf.tensor2d([vec])).arraySync()[0]);
  const pred = argmax(logits);
  res.json({logits, pred});
});

// TRAIN text
app.post("/v1/train/text", async (req,res) => {
  const { text, label, lr } = req.body;
  const L = Number.isFinite(+lr) ? +lr : 0.1;
  if (label == null) return res.status(400).json({error:"label required"});
  // recompile with new lr
  textModel.compile({ optimizer: tf.train.sgd(L), loss: tf.losses.softmaxCrossEntropy });
  const vec = textToVec(text);
  const y = oneHot(label, textClasses);
  const xs = tf.tensor2d([vec]);
  const ys = tf.tensor2d([y]);
  const h = await textModel.fit(xs, ys, { epochs: 1, verbose: 0 });
  xs.dispose(); ys.dispose();
  res.json({ status: "ok", loss: h.history.loss ? h.history.loss[0] : null });
});

// IMAGE caption
app.post("/v1/vision/caption", async (req,res) => {
  // accept image as base64 or uploaded file via multipart (field 'image')
  try {
    const b64 = req.body.image_base64;
    if (!b64) return res.status(400).json({error:"image_base64 required (data URL or base64)"});
    const buf = decodeDataUrl(b64);
    const caption = await heuristicCaption(buf);
    const img = sharp(buf);
    const meta = await img.metadata();
    res.json({ caption, width: meta.width, height: meta.height });
  } catch (err) { res.status(500).json({ error: String(err) }) }
});

// IMAGE classify
app.post("/v1/vision/classify", async (req,res) => {
  try {
    const b64 = req.body.image_base64;
    if (!b64) return res.status(400).json({error:"image_base64 required"});
    const buf = decodeDataUrl(b64);
    const hist = await imageToHist(buf);
    const logits = tf.tidy(()=> imageModel.predict(tf.tensor2d([hist])).arraySync()[0]);
    const pred = argmax(logits);
    res.json({ logits, pred });
  } catch (err) { res.status(500).json({ error: String(err) }) }
});

// TRAIN image
app.post("/v1/train/image", async (req,res) => {
  try {
    const { image_base64, label, lr } = req.body;
    if (label==null) return res.status(400).json({error:"label required"});
    const buf = decodeDataUrl(image_base64);
    const hist = await imageToHist(buf);
    const L = Number.isFinite(+lr) ? +lr : 0.1;
    imageModel.compile({ optimizer: tf.train.sgd(L), loss: tf.losses.softmaxCrossEntropy });
    const xs = tf.tensor2d([hist]);
    const ys = tf.tensor2d([oneHot(label, imageClasses)]);
    const h = await imageModel.fit(xs, ys, { epochs: 1, verbose: 0 });
    xs.dispose(); ys.dispose();
    res.json({ status:"ok", loss: h.history.loss ? h.history.loss[0] : null });
  } catch (err) { res.status(500).json({ error: String(err) }) }
});

// VISION match (text vs image)
app.post("/v1/vision/match", async (req,res)=> {
  try {
    const { text, image_base64 } = req.body;
    if (!text || !image_base64) return res.status(400).json({error:"text and image_base64 required"});
    const tvec = textToVec(text);
    const buf = decodeDataUrl(image_base64);
    const hist = await imageToHist(buf);
    const score = cosine(tvec, hist);
    res.json({ score });
  } catch (err) { res.status(500).json({ error: String(err) }) }
});

// Checkpoints save/load
app.post("/v1/checkpoint/save", async (req,res) => {
  try {
    const name = req.body.name || "default";
    await textModel.save(`file://${CHECKPOINT_DIR}/${name}_text`);
    await imageModel.save(`file://${CHECKPOINT_DIR}/${name}_image`);
    res.json({ status:"ok", saved_to: CHECKPOINT_DIR });
  } catch (err) { res.status(500).json({ error: String(err) }) }
});
app.post("/v1/checkpoint/load", async (req,res) => {
  try {
    const name = req.body.name || "default";
    const textPath = `file://${CHECKPOINT_DIR}/${name}_text/model.json`;
    const imagePath = `file://${CHECKPOINT_DIR}/${name}_image/model.json`;
    if (!fs.existsSync(`${CHECKPOINT_DIR}/${name}_text/model.json`) ) return res.status(400).json({error:"checkpoint missing"});
    textModel = await tf.loadLayersModel(textPath);
    imageModel = await tf.loadLayersModel(imagePath);
    res.json({ status:"ok", loaded: name });
  } catch (err) { res.status(500).json({ error: String(err) }) }
});

// Audio transcribe: supports two modes:
// 1) whisper.cpp CLI (set WHISPER_CPP_PATH env var to the CLI executable), that accepts WAV file path
// 2) OpenAI Whisper API (set OPENAI_API_KEY)
// If none configured, returns instructions.
app.post("/v1/audio/transcriptions", async (req,res) => {
  try {
    const b64 = req.body.audio_base64_wav;
    const language = req.body.language || "auto";
    if (!b64) return res.status(400).json({error:"audio_base64_wav required (WAV)"});
    const buf = decodeDataUrl(b64);
    // write to temp wav
    const tmp = `/tmp/mini_gemini_${Date.now()}.wav`;
    fs.writeFileSync(tmp, buf);

    // 1) whisper.cpp CLI path
    const whisperCli = process.env.WHISPER_CPP_PATH;
    if (whisperCli && fs.existsSync(whisperCli)) {
      // spawn whisper.cpp (assume it prints transcription to stdout; adapt if different)
      const out = await runCmd(whisperCli, ["-m", process.env.WHISPER_MODEL || "models/ggml-base.bin", "-f", tmp, "-otxt"]);
      // read generated text file — depends on the CLI flags; for simplicity, return stdout
      return res.json({ text: out });
    }

    // 2) OpenAI whisper (HTTP)
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_KEY) {
      // Use multipart/form-data to call OpenAI /v1/audio/transcriptions
      const formData = new (require("form-data"))();
      formData.append("file", fs.createReadStream(tmp));
      formData.append("model","whisper-1");
      if (language !== "auto") formData.append("language", language);
      const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, ...formData.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      return res.json({ text: response.data.text });
    }

    // nothing configured
    res.json({ error: "Nenhum backend de transcrição configurado. Defina WHISPER_CPP_PATH (whisper.cpp CLI) ou OPENAI_API_KEY (OpenAI Whisper)." });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------
// Helpers
// ---------------------------
function decodeDataUrl(dataUrl) {
  // accepts data URLs or raw base64
  if (dataUrl.startsWith("data:")) {
    const comma = dataUrl.indexOf(",");
    const b64 = dataUrl.slice(comma+1);
    return Buffer.from(b64, "base64");
  } else {
    return Buffer.from(dataUrl, "base64");
  }
}
function argmax(arr) {
  let best = 0, bv = -Infinity;
  for (let i=0;i<arr.length;i++) if (arr[i] > bv) { bv = arr[i]; best = i; }
  return best;
}
function oneHot(idx, dim) {
  const v = new Array(dim).fill(0);
  if (idx >= 0 && idx < dim) v[idx] = 1;
  return v;
}
function randomId() { return crypto.randomBytes(8).toString("hex"); }
function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "", err = "";
    p.stdout.on("data", d => out += d.toString());
    p.stderr.on("data", d => err += d.toString());
    p.on("close", code => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`exit ${code}: ${err || out}`));
    });
  });
}

// ---------------------------
// Start
// ---------------------------


app.get("/", (req,res)=>{
  res.send(`
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<title>Mini Gemini JS</title>
<style>
  body { font-family: sans-serif; margin: 2rem; }
  .card { border: 1px solid #ccc; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; }
</style>
</head>
<body>
<h1>Mini Gemini JS (Frontend)</h1>

<div class="card">
  <h3>Classificar Texto</h3>
  <input id="textInput" type="text" placeholder="Digite um texto..." size="50"/>
  <button onclick="classifyText()">Classificar</button>
  <pre id="textResult"></pre>
</div>

<div class="card">
  <h3>Classificar Imagem</h3>
  <input type="file" id="imgInput" accept="image/*"/>
  <button onclick="classifyImage()">Classificar</button>
  <pre id="imgResult"></pre>
</div>

<script>
async function classifyText() {
  const text = document.getElementById("textInput").value;
  const res = await fetch("/v1/text/classify", {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text })
  });
  const out = await res.json();
  document.getElementById("textResult").textContent = JSON.stringify(out, null, 2);
}

async function classifyImage() {
  const file = document.getElementById("imgInput").files[0];
  if (!file) return alert("Selecione uma imagem");
  const b64 = await toBase64(file);
  const res = await fetch("/v1/vision/classify", {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ image_base64: b64 })
  });
  const out = await res.json();
  document.getElementById("imgResult").textContent = JSON.stringify(out, null, 2);
}

function toBase64(file) {
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
</script>
</body>
</html>
  `);
});




app.listen(PORT, ()=> console.log(`mini-gemini-js listening http://0.0.0.0:${PORT}`));
