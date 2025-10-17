import crypto from "crypto";
import fs from "fs";

export class Step {
  static maxAttempts = 1; 
  static cacheFirst = true; 
  constructor({ index, subPrompt, timeout }) {
    this.id = this._generateId(subPrompt);
    this.cache = Step.cacheFirst ? fs.existsSync(`./generated/aidriven/step-${this.id}.js`) : false;
    this.subPrompt = subPrompt;
    this.index = index;
    this.timeout = timeout;
    this.inputToken = 0;
    this.outputToken = 0;
    this.cachedToken = 0;
    this.attemps = Step.maxAttempts;
    this.success = false;
    this.error = "";
  }

  _generateId(subPrompt) {
    // console.log(subPrompt);
    return crypto.createHash("md5").update(subPrompt).digest("hex").slice(0, 8);
  }

  logStart() {
    console.log(`\n➡️ Step ${this.index}: ${this.subPrompt}`);
  }

  logSuccess() {
    console.log(`✅ Step ${this.index} completato.`);
    this.status = "success";
  }

  logError(err) {
    console.error(`❌ Errore nello step ${this.index}:`, err);
    this.status = "error";
    this.error = err;
  }
}
