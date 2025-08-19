const languageConfig = require("../config/languageConfig");

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

module.exports = { extractEntities };