
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { initModels } = require("./src/models");
const initFrontend = require("./src/frontend");
const chatRoutes = require("./src/routes/chat");
const textRoutes = require("./src/routes/text");

// const middleware = require('./src/middleware');
const app = express();
// app.use(middleware);

const PORT = process.env.PORT || 8080;

app.use(bodyParser.json({ limit: "10mb" }));

// Inicializar modelos
initModels().catch(console.error);


// Rotas
app.get("/v1/health", (req, res) => res.json({ status: "ok" }));
app.use("/chat", chatRoutes);
app.use("/v1/text", textRoutes);
// app.use("/v1/vision", visionRoutes);
// app.use("/v1/audio", audioRoutes);
app.use("/", initFrontend);

// Iniciar servidor
app.listen(PORT, () => console.log(`mini-gemini-js listening http://0.0.0.0:${PORT}`));