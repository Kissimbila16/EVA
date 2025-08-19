const { classifier } = require("./src/core/nlp");
const { preprocessText } = require("./src/core/preprocess");
const { extractEntities } = require("./src/core/entities");
const { analyzeSentiment } = require("./src/core/sentiment");
const knowledgeBase = require("./src/core/knowledgeBase");
const { updateContext, getContext, uuidv4 } = require("./src/core/context");
const { trainPipeline, saveClassifier, loadClassifier } = require("./src/training/pipeline");
const logger = require("./src/config/logger");

async function processInput(text, sessionId = uuidv4(), language = "pt") {
  try {
    const processedText = preprocessText(text, language);
    const entities = extractEntities(text, language);
    const classification = classifier.getClassifications(processedText);
    const intent = classification[0].label;
    const confidence = classification[0].value;
    const sentiment = analyzeSentiment(text, language);

    // Update context
    const sessionContext = updateContext(sessionId, text, intent, entities);

    // Log interaction
    logger.info(`Session: ${sessionId}, Intent: ${intent}, Confidence: ${confidence}, Sentiment: ${sentiment.sentiment}`);

    // Handle low confidence
    if (confidence < 0.7) {
      return { response: handleLowConfidence(text, sentiment, sessionContext, entities), intent, confidence };
    }

    // Fetch knowledge for curiosity intent
    let knowledge = "";
    if (intent === "curiosidade") {
      const topic = entities.find((e) => e.type === "location")?.value || "universe";
      knowledge = await knowledgeBase.query(topic);
    }

    // Generate response based on intent
    const responses = {
      saudacao: `Olá! Como posso te ajudar hoje?`,
      despedida: `Até mais! Foi ótimo processar tua entrada.`,
      status: `Tudo certo por aqui! E contigo? ${sentiment.sentiment === "negative" ? "Parece que estás meio pra baixo." : ""}`,
      ajuda: `Claro, posso ajudar! Qual é a tua necessidade?`,
      piada: `😄 Qual o animal mais antigo? A zebra, porque é preta e branca!`,
      positivo: `Que bom! Conta mais sobre essa vibe positiva!`,
      negativo: `Sinto muito que estás assim. Quer explorar o que aconteceu?`,
      filosofia: `Grande questão! Talvez o sentido da vida seja 42, ou buscar o que te faz feliz. O que achas?`,
      curiosidade: `O universo é fascinante! ${knowledge} Quer saber mais?`,
      clima: `Consulta de clima (simulada): 25°C, ensolarado.`,
      desconhecido: `Hmmm, não entendi direito. Pode explicar de outro jeito?`,
    };

    return { response: responses[intent] || `Interessante! Me dá mais detalhes.`, intent, confidence };
  } catch (error) {
    logger.error(`Error processing input: ${error.message}`);
    return { response: "Ops, algo deu errado. Pode repetir, por favor?", intent: "error", confidence: 0 };
  }
}

function handleLowConfidence(text, sentiment, sessionContext, entities) {
  const lastIntent = sessionContext.lastIntent;
  if (lastIntent && sentiment.sentiment !== "neutral") {
    return `Parece que estás falando algo ${sentiment.sentiment}. Sobre ${lastIntent}, quer aprofundar?`;
  }
  if (entities.length > 0) {
    return `Notei que mencionaste ${entities[0].value}. Quer falar mais sobre isso?`;
  }
  return "Não entendi bem, pode explicar de outro jeito? 😅";
}

async function initClassifier(language = "pt") {
  try {
    await trainPipeline(language);
    logger.info(`Classifier initialized for ${language}`);
  } catch (error) {
    logger.error(`Error initializing classifier: ${error.message}`);
    throw new Error("Failed to initialize classifier");
  }
}

module.exports = {
  initClassifier,
  processInput,
  preprocessText,
  extractEntities,
  analyzeSentiment,
  trainPipeline,
  saveClassifier,
  loadClassifier,
};