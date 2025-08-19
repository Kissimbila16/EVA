const fs = require("fs").promises;
const natural = require("natural");
const { augmentData } = require("./dataAugmentation");
const { checkBalance, kFoldCrossValidation, evaluateClassifier } = require("./evaluation");
const { preprocessText } = require("../core/preprocess");
const logger = require("../config/logger");
const { classifier } = require("../core/nlp");

async function loadTrainingData(filePath = "trainingData.json") {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Erro ao carregar dados de treinamento: ${error.message}`);
    return [];
  }
}

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

module.exports = { trainPipeline, saveClassifier, loadClassifier };