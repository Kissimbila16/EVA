const natural = require("natural");
const { preprocessText } = require("../core/preprocess");
const logger = require("../config/logger");

function checkBalance(trainingData) {
  const counts = trainingData.reduce((acc, { intent }) => {
    acc[intent] = (acc[intent] || 0) + 1;
    return acc;
  }, {});
  logger.info("Distribuição de intenções:", counts);
  return counts;
}

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

module.exports = { checkBalance, kFoldCrossValidation, evaluateClassifier };