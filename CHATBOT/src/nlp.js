const natural = require("natural");
const aposToLexForm = require("apos-to-lex-form");
const SpellCorrector = require("spelling-corrector");
const SW = require("stopword");
const winston = require("winston");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs").promises;
const diacritics = require("diacritics");
const axios = require("axios"); // For external API integration

// Logger setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "miniIA.log" }),
    new winston.transports.Console(),
  ],
});

// Initialize NLP components
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const classifier = new natural.BayesClassifier();
const sentimentAnalyzer = new natural.SentimentAnalyzer(
  "English",
  natural.PorterStemmer,
  "afinn"
);
const spellCorrector = new SpellCorrector();
spellCorrector.loadDictionary();

// Language configuration
const languageConfig = {
  pt: {
    stemmer: natural.PorterStemmerPt,
    stopwords: SW.pt,
    sentimentLexicon: "afinn",
    entityPatterns: [
      { pattern: /\b(hoje|amanhã|ontem)\b/i, type: "time" },
      { pattern: /\b(\d{1,2}:\d{2})\b/, type: "hour" },
      { pattern: /\b(rio|são paulo|londres)\b/i, type: "location" },
    ],
  },
  en: {
    stemmer: natural.PorterStemmer,
    stopwords: SW.en,
    sentimentLexicon: "afinn",
    entityPatterns: [
      { pattern: /\b(today|tomorrow|yesterday)\b/i, type: "time" },
      { pattern: /\b(\d{1,2}:\d{2})\b/, type: "hour" },
      { pattern: /\b(london|new york|tokyo)\b/i, type: "location" },
    ],
  },
};

// Context storage for tracking interactions
const interactionContext = new Map();

// External knowledge base with real API integration
const knowledgeBase = {
  async query(topic) {
    try {
      // Example: Integrate with Wikipedia API
      const response = await axios.get(
        `https://pt.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(topic)}`
      );
      const pages = response.data.query.pages;
      const page = Object.values(pages)[0];
      return page.extract || "Não encontrei informações sobre esse tópico.";
    } catch (error) {
      logger.error(`Erro na API de conhecimento: ${error.message}`);
      return "Não sei sobre isso, mas posso pesquisar mais!";
    }
  },
};

// Data augmentation with synonyms
const synonyms = {
  oi: ["olá", "e aí", "alô"],
  tchau: ["até logo", "adeus", "falou"],
  "estou feliz": ["tô animado", "estou contente", "tô de boa"],
  "estou triste": ["tô pra baixo", "estou chateado", "tô triste"],
  "qual é o sentido da vida": ["o que é a vida", "qual o propósito da vida"],
};

// Preprocessing function
function preprocessText(text, language = "pt") {
  try {
    const noAccents = diacritics.remove(text.toLowerCase());
    const lexedText = aposToLexForm(noAccents);
    const correctedText = lexedText
      .split(" ")
      .map((word) => spellCorrector.correct(word))
      .join(" ");
    const tokens = tokenizer.tokenize(correctedText);
    const filteredTokens = SW.removeStopwords(tokens, languageConfig[language].stopwords);
    const stemmedTokens = filteredTokens.map((token) =>
      languageConfig[language].stemmer.stem(token)
    );
    return stemmedTokens.join(" ");
  } catch (error) {
    logger.error(`Error preprocessing text: ${error.message}`);
    return text.toLowerCase();
  }
}

// Entity recognition
function extractEntities(text, language = "pt") {
  const entities = [];
  languageConfig[language].entityPatterns.forEach(({ pattern, type }) => {
    const match = text.match(pattern);
    if (match) {
      entities.push({ type, value: match[0] });
    }
  });
  return entities;
}

// Data augmentation
function augmentData(trainingData) {
  const augmented = [...trainingData];
  trainingData.forEach(({ text, intent }) => {
    if (synonyms[text]) {
      synonyms[text].forEach((syn) => augmented.push({ text: syn, intent }));
    }
  });
  return augmented;
}

// Check data balance
function checkBalance(trainingData) {
  const counts = trainingData.reduce((acc, { intent }) => {
    acc[intent] = (acc[intent] || 0) + 1;
    return acc;
  }, {});
  logger.info("Distribuição de intenções:", counts);
  return counts;
}

// K-fold cross-validation
function kFoldCrossValidation(trainingData, k = 5) {
  const foldSize = Math.floor(trainingData.length / k);
  let accuracies = [];
  
  for (let i = 0; i < k; i++) {
    const testData = trainingData.slice(i * foldSize, (i + 1) * foldSize);
    const trainData = [
      ...trainingData.slice(0, i * foldSize),
      ...trainingData.slice((i + 1) * foldSize),
    ];
    const tempClassifier = new natural.BayesClassifier();
    trainData.forEach(({ text, intent }) => tempClassifier.addDocument(preprocessText(text), intent));
    tempClassifier.train();
    
    let correct = 0;
    testData.forEach(({ text, intent }) => {
      if (tempClassifier.classify(preprocessText(text)) === intent) correct++;
    });
    accuracies.push(correct / testData.length);
  }
  
  const avgAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / k;
  logger.info(`Acurácia média (k-fold): ${avgAccuracy * 100}%`);
  return avgAccuracy;
}

// Evaluate classifier
async function evaluateClassifier(trainingData) {
  const testSize = Math.floor(trainingData.length * 0.2);
  const testData = trainingData.slice(0, testSize);
  const trainData = trainingData.slice(testSize);
  
  const tempClassifier = new natural.BayesClassifier();
  trainData.forEach(({ text, intent }) => {
    tempClassifier.addDocument(preprocessText(text), intent);
  });
  tempClassifier.train();
  
  let correct = 0;
  testData.forEach(({ text, intent }) => {
    if (tempClassifier.classify(preprocessText(text)) === intent) {
      correct++;
    }
  });
  const accuracy = (correct / testData.length) * 100;
  logger.info(`Acurácia: ${accuracy}%`);
  return accuracy;
}

// Save classifier
async function saveClassifier() {
  return new Promise((resolve, reject) => {
    classifier.save("classifier.json", (err) => {
      if (err) {
        logger.error(`Erro ao salvar: ${err.message}`);
        reject(err);
      } else {
        logger.info("Classificador salvo.");
        resolve();
      }
    });
  });
}

// Load classifier
async function loadClassifier() {
  return new Promise((resolve, reject) => {
    natural.BayesClassifier.load("classifier.json", null, (err, loadedClassifier) => {
      if (err) {
        logger.error(`Erro ao carregar: ${err.message}`);
        reject(err);
      } else {
        classifier.events = loadedClassifier.events;
        classifier.classifier = loadedClassifier.classifier;
        logger.info("Classificador carregado.");
        resolve();
      }
    });
  });
}

// Load training data from file
async function loadTrainingData(filePath = "trainingData.json") {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Erro ao carregar dados de treinamento: ${error.message}`);
    return [];
  }
}

// Training pipeline
async function trainPipeline(language = "pt", filePath = "trainingData.json") {
  try {
    let trainingData = [
      { text: "oi", intent: "saudacao" },
      { text: "olá", intent: "saudacao" },
      { text: "bom dia", intent: "saudacao" },
      { text: "e aí, tudo bem?", intent: "saudacao" },
      { text: "alô, como tá?", intent: "saudacao" },
      { text: "até logo", intent: "despedida" },
      { text: "tchau", intent: "despedida" },
      { text: "adeus", intent: "despedida" },
      { text: "falou, até mais", intent: "despedida" },
      { text: "como você está", intent: "status" },
      { text: "tô de boa, e tu?", intent: "status" },
      { text: "preciso de ajuda", intent: "ajuda" },
      { text: "me ajuda com isso", intent: "ajuda" },
      { text: "me conta uma piada", intent: "piada" },
      { text: "conta outra piada", intent: "piada" },
      { text: "estou feliz", intent: "positivo" },
      { text: "tô animado", intent: "positivo" },
      { text: "estou triste", intent: "negativo" },
      { text: "tô pra baixo", intent: "negativo" },
      { text: "qual é o sentido da vida", intent: "filosofia" },
      { text: "o que é a vida?", intent: "filosofia" },
      { text: "me fale sobre o universo", intent: "curiosidade" },
      { text: "fala sobre buracos negros", intent: "curiosidade" },
      { text: "como está o clima em são paulo", intent: "clima" },
      { text: "clima em rio amanhã", intent: "clima" },
      { text: "qualquer coisa aleatória", intent: "desconhecido" },
      { text: "não sei o que dizer", intent: "desconhecido" },
    ];

    // Load additional data from file
    const fileData = await loadTrainingData(filePath);
    trainingData = [...trainingData, ...fileData];

    // Augment data
    trainingData = augmentData(trainingData);
    checkBalance(trainingData);

    // K-fold cross-validation
    const avgAccuracy = kFoldCrossValidation(trainingData);

    // Train classifier
    trainingData.forEach(({ text, intent }) => {
      classifier.addDocument(preprocessText(text, language), intent);
    });
    classifier.train();

    // Evaluate and save
    await evaluateClassifier(trainingData);
    await saveClassifier();
    logger.info(`Pipeline de treinamento concluído para ${language}. Acurácia média: ${avgAccuracy * 100}%`);
  } catch (error) {
    logger.error(`Erro no pipeline de treinamento: ${error.message}`);
    throw new Error("Failed to run training pipeline");
  }
}

// Initialize classifier
async function initClassifier(language = "pt") {
  try {
    await trainPipeline(language);
    logger.info(`Classifier initialized for ${language}`);
  } catch (error) {
    logger.error(`Error initializing classifier: ${error.message}`);
    throw new Error("Failed to initialize classifier");
  }
}

// Analyze sentiment
function analyzeSentiment(text, language = "pt") {
  try {
    const tokens = tokenizer.tokenize(preprocessText(text, language));
    const sentimentScore = sentimentAnalyzer.getSentiment(tokens);
    return {
      score: sentimentScore,
      sentiment: sentimentScore > 0 ? "positive" : sentimentScore < 0 ? "negative" : "neutral",
    };
  } catch (error) {
    logger.error(`Error in sentiment analysis: ${error.message}`);
    return { score: 0, sentiment: "neutral" };
  }
}

// Process input and generate response
async function processInput(text, sessionId = uuidv4(), language = "pt") {
  try {
    const processedText = preprocessText(text, language);
    const entities = extractEntities(text, language);
    const classification = classifier.getClassifications(processedText);
    const intent = classification[0].label;
    const confidence = classification[0].value;
    const sentiment = analyzeSentiment(text, language);

    // Update context
    if (!interactionContext.has(sessionId)) {
      interactionContext.set(sessionId, { lastIntent: null, history: [] });
    }
    const sessionContext = interactionContext.get(sessionId);
    sessionContext.history.push({ text, intent, entities, timestamp: Date.now() });
    if (sessionContext.history.length > 10) sessionContext.history.shift();
    sessionContext.lastIntent = intent;
    interactionContext.set(sessionId, sessionContext);

    // Log interaction
    logger.info(`Session: ${sessionId}, Intent: ${intent}, Confidence: ${confidence}, Sentiment: ${sentiment.sentiment}`);

    // Handle low confidence
    if (confidence < 0.7) {
      return handleLowConfidence(text, sentiment, sessionContext, entities);
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

    return responses[intent] || `Interessante! Me dá mais detalhes.`;
  } catch (error) {
    logger.error(`Error processing input: ${error.message}`);
    return "Ops, algo deu errado. Pode repetir, por favor?";
  }
}

// Handle low-confidence cases
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

// Export functions
module.exports = {
  initClassifier,
  processInput,
  preprocessText,
  analyzeSentiment,
  extractEntities,
  trainPipeline,
  evaluateClassifier,
  saveClassifier,
  loadClassifier,
};


   [
     { "text": "qual o clima em londres", "intent": "clima" },
     { "text": "tô muito chateado", "intent": "negativo" },
     { "text": "fala sobre galáxias", "intent": "curiosidade" },
     { "text": "o que é inteligência artificial", "intent": "curiosidade" }
   ]

   const { trainPipeline, processInput } = require("./miniIA");

   (async () => {
     await trainPipeline("pt", "trainingData.json");
     console.log(await processInput("Oi, estou feliz!", "session123", "pt"));
     // e.g., "Que bom! Conta mais sobre essa vibe positiva!"
     console.log(await processInput("Fala sobre o universo", "session123", "pt"));
     // e.g., "O universo é fascinante! [Informação da Wikipedia] Quer saber mais?"
   })();


     async function saveUserInput(text, intent, sessionId) {
       const entry = { text, intent, sessionId, timestamp: Date.now() };
       const data = await loadTrainingData();
       data.push(entry);
       await fs.writeFile("trainingData.json", JSON.stringify(data, null, 2));
     }


  function logLowConfidence(text, classification) {
    if (classification[0].value < 0.7) {
      logger.warn(`Baixa confiança: ${text}, Sugestão: ${classification[0].label}`);
      // Salvar em um arquivo para revisão
    }
  }
  const ngramTokenizer = new natural.NGramTokenizer({ n: 2 });
  function preprocessText(text, language = "pt") {
    // ... (após stemming)
    const ngrams = ngramTokenizer.tokenize(stemmedTokens.join(" "));
    return ngrams.join(" ");
  }
