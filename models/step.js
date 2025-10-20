import crypto from "crypto";
import fs from "fs";

export class Step {
  static maxAttempts = 1; 
  static cacheFirst = true; 
  constructor({ index, subPrompt, timeout, stepPath }) {
    this.id = this._generateId(subPrompt);
    let steps = stepPath
        ? `${stepPath}/step-${this.id}.js`
        : `generated/aidriven/step-${this.id}.js`;
    this.cache = Step.cacheFirst
  ? fs.existsSync(
      steps
    )
  : false;
    //console.log(`cache dello step index ${index}: `, this.cache);
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
