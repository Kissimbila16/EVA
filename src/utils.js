const crypto = require("crypto");
const tf = require("@tensorflow/tfjs-node");
const sharp = require("sharp");
const { spawn } = require("child_process");
const { TEXT_DIM, IMAGE_DIM } = require("./config");

function textToVec(text) {
  const v = new Array(TEXT_DIM).fill(0.0);
  if (!text) return v;
  const toks = text.toLowerCase().split(/\s+/).filter(Boolean);
  toks.forEach((t, i) => {
    const h = crypto.createHash("sha256").update(t).digest();
    const idx = h.readUInt32LE(0) % TEXT_DIM;
    v[idx] += 1.0 + (i % 3) * 0.1;
  });
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1.0;
  return v.map(x => x / norm);
}

async function imageToHist(buffer) {
  return tf.tidy(() => {
    const imgTensor = tf.node.decodeImage(buffer).toFloat();
    const resized = tf.image.resizeBilinear(imgTensor, [256, 256]);
    const luminance = resized.mul([0.2126, 0.7152, 0.0722]).sum(2).round();
    const hist = tf.histogram(luminance.flatten(), IMAGE_DIM, 0, 255);
    return hist.div(hist.norm(2)).arraySync();
  });
}

async function heuristicCaption(buffer) {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const small = await img.resize(32, 32).raw().toBuffer();
  let sum = 0, count = 0;
  for (let i = 0; i < small.length; i += meta.channels) {
    const r = small[i], g = small[i + 1], b = small[i + 2];
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
    sum += y; count++;
  }
  const avg = sum / Math.max(1, count);
  const mood = avg > 0.6 ? "clara" : avg < 0.35 ? "escura" : "neutra";
  return `Imagem ${meta.width || "?"}x${meta.height || "?"}, iluminação ${mood}.`;
}

function decodeDataUrl(dataUrl) {
  const b64 = dataUrl.startsWith("data:") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  return Buffer.from(b64, "base64");
}

function argmax(arr) {
  let best = 0, bv = -Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] > bv) { bv = arr[i]; best = i; }
  return best;
}

function oneHot(idx, dim) {
  const v = new Array(dim).fill(0);
  if (idx >= 0 && idx < dim) v[idx] = 1;
  return v;
}

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "", err = "";
    p.stdout.on("data", d => (out += d.toString()));
    p.stderr.on("data", d => (err += d.toString()));
    p.on("close", code => (code === 0 ? resolve(out.trim()) : reject(new Error(`exit ${code}: ${err || out}`))));
  });
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return (dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9) + 1) / 2;
}

module.exports = { textToVec, imageToHist, heuristicCaption, decodeDataUrl, argmax, oneHot, runCmd, cosine };