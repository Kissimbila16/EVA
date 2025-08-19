const fs = require("fs").promises;
const CHECKPOINT_DIR = process.env.CHECKPOINT_DIR || "./checkpoints";

module.exports = {
  PORT: process.env.PORT || 8080,
  TEXT_DIM: Number(process.env.TEXT_DIM) || 256,
  IMAGE_DIM: Number(process.env.IMAGE_DIM) || 256,
  DEFAULT_CLASSES: Number(process.env.DEFAULT_CLASSES) || 4,
  CHECKPOINT_DIR,
  FILE_PATH: process.env.CONVERSATIONS_FILE || "./conversations.json",
  async init() {
    if (!(await fs.exists(CHECKPOINT_DIR))) {
      await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
    }
  },
};