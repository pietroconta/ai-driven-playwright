export class Step {
  constructor({ index, subPrompt, timeout }) {
    this.subPrompt = subPrompt;
    this.index = index;
    this.timeout = timeout;
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
