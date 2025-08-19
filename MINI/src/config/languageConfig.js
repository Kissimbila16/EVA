const SW = require("stopword");

const languageConfig = {
  pt: {
    stemmer: require("natural").PorterStemmerPt,
    stopwords: SW.pt,
    sentimentLexicon: "afinn",
    entityPatterns: [
      { pattern: /\b(hoje|amanhã|ontem)\b/i, type: "time" },
      { pattern: /\b(\d{1,2}:\d{2})\b/, type: "hour" },
      { pattern: /\b(rio|são paulo|londres)\b/i, type: "location" },
    ],
  },
  en: {
    stemmer: require("natural").PorterStemmer,
    stopwords: SW.en,
    sentimentLexicon: "afinn",
    entityPatterns: [
      { pattern: /\b(today|tomorrow|yesterday)\b/i, type: "time" },
      { pattern: /\b(\d{1,2}:\d{2})\b/, type: "hour" },
      { pattern: /\b(london|new york|tokyo)\b/i, type: "location" },
    ],
  },
};

module.exports = languageConfig;