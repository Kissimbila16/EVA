const natural = require("natural");
const SpellCorrector = require("spelling-corrector");

const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();
const sentimentAnalyzer = new natural.SentimentAnalyzer(
  "English",
  natural.PorterStemmer,
  "afinn"
);
const spellCorrector = new SpellCorrector();
spellCorrector.loadDictionary();

module.exports = { tokenizer, classifier, sentimentAnalyzer, spellCorrector };