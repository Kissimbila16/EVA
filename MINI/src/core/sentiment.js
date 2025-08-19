const { tokenizer, sentimentAnalyzer } = require("./nlp");
const { preprocessText } = require("./preprocess");
const logger = require("../config/logger");

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

module.exports = { analyzeSentiment };