const aposToLexForm = require("apos-to-lex-form");
const diacritics = require("diacritics");
const { tokenizer, spellCorrector } = require("./nlp");
const languageConfig = require("../config/languageConfig");
const logger = require("../config/logger");

function preprocessText(text, language = "pt") {
  try {
    const noAccents = diacritics.remove(text.toLowerCase());
    const lexedText = aposToLexForm(noAccents);
    const correctedText = lexedText
      .split(" ")
      .map((word) => spellCorrector.correct(word))
      .join(" ");
    const tokens = tokenizer.tokenize(correctedText);
    const filteredTokens = require("stopword").removeStopwords(
      tokens,
      languageConfig[language].stopwords
    );
    const stemmedTokens = filteredTokens.map((token) =>
      languageConfig[language].stemmer.stem(token)
    );
    return stemmedTokens.join(" ");
  } catch (error) {
    logger.error(`Error preprocessing text: ${error.message}`);
    return text.toLowerCase();
  }
}

module.exports = { preprocessText };