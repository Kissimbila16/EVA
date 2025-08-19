const tf = require("@tensorflow/tfjs-node");
const { DEFAULT_CLASSES, CHECKPOINT_DIR } = require("./config");

let textClasses = DEFAULT_CLASSES;
let imageClasses = DEFAULT_CLASSES;
let textModel, imageModel;
let currentLr = 0.1;

function createLinearModel(inputDim, outDim) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [inputDim], units: outDim, activation: "linear" }));
  model.compile({ optimizer: tf.train.sgd(currentLr), loss: tf.losses.softmaxCrossEntropy });
  return model;
}

function compileModel(model, lr) {
  if (lr !== currentLr) {
    model.compile({ optimizer: tf.train.sgd(lr), loss: tf.losses.softmaxCrossEntropy });
    currentLr = lr;
  }
}

async function initModels() {
  textModel = createLinearModel(require("./config").TEXT_DIM, textClasses);
  imageModel = createLinearModel(require("./config").IMAGE_DIM, imageClasses);
}

async function saveCheckpoint(name = "default") {
  await textModel.save(`file://${CHECKPOINT_DIR}/${name}_text`);
  await imageModel.save(`file://${CHECKPOINT_DIR}/${name}_image`);
  return { savedTo: CHECKPOINT_DIR };
}

async function loadCheckpoint(name = "default") {
  const textPath = `file://${CHECKPOINT_DIR}/${name}_text/model.json`;
  const imagePath = `file://${CHECKPOINT_DIR}/${name}_image/model.json`;
  const fs = require("fs").promises;
  if (!(await fs.exists(`${CHECKPOINT_DIR}/${name}_text/model.json`)) ||
      !(await fs.exists(`${CHECKPOINT_DIR}/${name}_image/model.json`))) {
    throw new Error("Checkpoint não encontrado.");
  }
  textModel = await tf.loadLayersModel(textPath);
  imageModel = await tf.loadLayersModel(imagePath);
  return { loaded: true };
}

module.exports = {
  initModels,
  textModel: () => textModel,
  imageModel: () => imageModel,
  textClasses: () => textClasses,
  imageClasses: () => imageClasses,
  compileModel,
  saveCheckpoint,
  loadCheckpoint,
};