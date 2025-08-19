module.exports = (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<title>Mini Gemini JS</title>
<style>
  body { font-family: sans-serif; margin: 2rem; }
  .card { border: 1px solid #ccc; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; }
  pre { background: #f4f4f4; padding: 10px; border-radius: 4px; white-space: pre-wrap; }
  .error { color: red; }
  .chat-box { max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 0.5rem; border-radius: 6px; margin-bottom: 0.5rem; background: #fafafa; }
  .msg-user { color: #333; margin: 0.3rem 0; }
  .msg-bot { color: #0077cc; margin: 0.3rem 0; }
  .chat-input { width: 70%; padding: 0.4rem; }
  .chat-button { padding: 0.4rem 1rem; }
</style>
</head>
<body>
<h1>Mini Gemini JS (Frontend)</h1>

<!-- CHAT -->
<div class="card">
  <h3>Chat com o Bot</h3>
  <div id="chatBox" class="chat-box"></div>
  <input id="chatInput" class="chat-input" type="text" placeholder="Digite sua mensagem..." />
  <button class="chat-button" onclick="sendChat()">Enviar</button>
</div>

<!-- CLASSIFICAR TEXTO -->
<div class="card">
  <h3>Classificar Texto</h3>
  <input id="textInput" type="text" placeholder="Digite um texto..." size="50"/>
  <button onclick="classifyText()">Classificar</button>
  <pre id="textResult"></pre>
</div>

<!-- CLASSIFICAR IMAGEM -->
<div class="card">
  <h3>Classificar Imagem</h3>
  <input type="file" id="imgInput" accept="image/*"/>
  <button onclick="classifyImage()">Classificar</button>
  <pre id="imgResult"></pre>
</div>

<script>
// ================== CHAT ==================
async function sendChat() {
  const input = document.getElementById("chatInput");
  const chatBox = document.getElementById("chatBox");
  const text = input.value.trim();
  if (!text) return;

  // Mostra mensagem do usuário
  chatBox.innerHTML += '<div class="msg-user"><b>Você:</b> ' + text + '</div>';
  input.value = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error("Erro " + res.status);
    const out = await res.json();
    chatBox.innerHTML += '<div class="msg-bot"><b>Bot:</b> ' + out.reply + '</div>';
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (err) {
    chatBox.innerHTML += '<div class="msg-bot error"><b>Erro:</b> ' + err.message + '</div>';
  }
}

// ================== TEXTO ==================
async function classifyText() {
  const resultEl = document.getElementById("textResult");
  try {
    const text = document.getElementById("textInput").value;
    if (!text) throw new Error("Digite um texto");
    const res = await fetch("/v1/text/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error(\`Erro \${res.status}: \${await res.text()}\`);
    const out = await res.json();
    resultEl.textContent = JSON.stringify(out, null, 2);
    resultEl.className = "";
  } catch (err) {
    resultEl.textContent = \`Erro: \${err.message}\`;
    resultEl.className = "error";
  }
}

// ================== IMAGEM ==================
async function classifyImage() {
  const resultEl = document.getElementById("imgResult");
  try {
    const file = document.getElementById("imgInput").files[0];
    if (!file) throw new Error("Selecione uma imagem");
    const b64 = await toBase64(file);
    const res = await fetch("/v1/vision/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: b64 })
    });
    if (!res.ok) throw new Error(\`Erro \${res.status}: \${await res.text()}\`);
    const out = await res.json();
    resultEl.textContent = JSON.stringify(out, null, 2);
    resultEl.className = "";
  } catch (err) {
    resultEl.textContent = \`Erro: \${err.message}\`;
    resultEl.className = "error";
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
</script>
</body>
</html>
  `);
};
