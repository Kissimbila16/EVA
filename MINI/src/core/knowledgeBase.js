const axios = require("axios");
const logger = require("../config/logger");

const knowledgeBase = {
  async query(topic) {
    try {
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

module.exports = knowledgeBase;