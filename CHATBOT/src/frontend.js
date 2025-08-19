module.exports = (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<title>Mini Gemini JS</title>
<style>
  body {
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 0;
    background: #f5f7fa;
    color: #333;
  }
  header {
    background: #0077cc;
    color: white;
    padding: 1rem 2rem;
    text-align: center;
  }
  h1 { margin: 0; font-size: 1.8rem; }
  main {
    padding: 2rem;
    max-width: 900px;
    margin: auto;
  }
  .card {
    background: white;
    border-radius: 10px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 8px rgba(0,0,0,0.08);
  }
  h3 { margin-top: 0; color: #0077cc; }
  pre {
    background: #272822;
    color: #f8f8f2;
    padding: 10px;
    border-radius: 6px;
    white-space: pre-wrap;
    max-height: 200px;
    overflow-y: auto;
  }
  .error { color: #d9534f; }
  .chat-box {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #ddd;
    padding: 0.8rem;
    border-radius: 6px;
    margin-bottom: 0.8rem;
    background: #fafafa;
    font-size: 0.95rem;
  }
  .msg-user {
    margin: 0.4rem 0;
    text-align: right;
    color: #333;
  }
  .msg-bot {
    margin: 0.4rem 0;
    text-align: left;
    color: #0077cc;
  }
  .chat-input {
    width: 70%;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #ccc;
  }
  .chat-button {
    padding: 0.5rem 1rem;
    margin-left: 0.5rem;
    border: none;
    background: #0077cc;
    color: white;
    border-radius: 6px;
    cursor: pointer;
  }
  .chat-button:hover { background: #005fa3; }
  input[type="text"], input[type="file"] {
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #ccc;
    margin-bottom: 0.5rem;
    width: calc(100% - 1rem);
  }
  button {
    padding: 0.5rem 1rem;
    border: none;
    background: #0077cc;
    color: white;
    border-radius: 6px;
    cursor: pointer;
  }
  button:hover { background: #005fa3; }
</style>
</head>
<body>
<header>
  <h1>Mini Gemini JS</h1>
</header>
<main>

<!-- CHAT -->
<div class="card">
  <h3>💬 Chat com o Bot</h3>
  <div id="chatBox" class="chat-box"></div>
  <input id="chatInput" class="chat-input" type="text" placeholder="Digite sua mensagem..." onkeydown="if(event.key==='Enter') sendChat()" />
  <button class="chat-button" onclick="sendChat()">Enviar</button>
</div>

<!-- CLASSIFICAR TEXTO -->
<div class="card">
  <h3>📝 Classificar Texto</h3>
  <input id="textInput" type="text" placeholder="Digite um texto para classificar..." />
  <button onclick="classifyText()">Classificar</button>
  <pre id="textResult"></pre>
</div>

<!-- CLASSIFICAR IMAGEM -->
<div class="card">
  <h3>🖼️ Classificar Imagem</h3>
  <input type="file" id="imgInput" accept="image/*"/>
  <button onclick="classifyImage()">Classificar</button>
  <pre id="imgResult"></pre>
</div>

</main>

<script>
// ================== CHAT ==================
async function sendChat() {
  const input = document.getElementById("chatInput");
  const chatBox = document.getElementById("chatBox");
  const text = input.value.trim();
  if (!text) return;

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
