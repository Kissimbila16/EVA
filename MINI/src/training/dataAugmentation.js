const synonyms = require("../config/synonyms");

function augmentData(trainingData) {
  const augmented = [...trainingData];
  trainingData.forEach(({ text, intent }) => {
    if (synonyms[text]) {
      synonyms[text].forEach((syn) => augmented.push({ text: syn, intent }));
    }
  });
  return augmented;
}

module.exports = { augmentData };