const natural = require("natural");

const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();

function initClassifier() {
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
}

function generateReply(pred, text) {
  const intent = classifier.classify(text.toLowerCase());
  switch (intent) {
    case "saudacao": return "Olá! Como você está hoje?";
    case "despedida": return "Até logo! Foi ótimo conversar com você.";
    case "status": return "Estou bem, obrigado por perguntar! E você?";
    case "ajuda": return "Claro, estou aqui para ajudar. Qual é a sua dúvida?";
    case "piada": return "😄 Qual o animal mais antigo do mundo? A zebra, porque ainda é preta e branca!";
    case "positivo": return "Que bom! Isso me deixa feliz também.";
    case "negativo": return "Sinto muito ouvir isso. Quer conversar sobre o que aconteceu?";
    default:
      switch (pred) {
        case 0: return "Isso parece algo positivo! Pode me contar mais?";
        case 1: return "Parece uma situação complicada. Quer me explicar melhor?";
        default: return "Interessante! Me dê mais detalhes.";
      }
  }
}

module.exports = { initClassifier, generateReply };