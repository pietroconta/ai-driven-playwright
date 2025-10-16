import crypto from "crypto";
import fs from "fs";
export class Step {
 
  _inputToken = 0;
  _outputToken = 0;
  _cachedToken = 0;
  constructor({ index, subPrompt, timeout}) {
    this.id = this._generateId(subPrompt);
    this.cache = fs.existsSync(`step-${id}.js`);
    this.subPrompt = subPrompt;
    this.index = index;
    this.timeout = timeout;
  }

  _generateId(subPrompt) {
    return crypto.createHash("md5").update(subPrompt).digest("hex").slice(0, 8);
  }

  get _cachedToken(){
    return this._inputToken;
  }

  set _cachedToken(_cachedToken){
    this._cachedToken = _cachedToken;
  }

  get _inputToken(){
    return this._inputToken;
  }

  set _inputToken(_inputToken){
    this._inputToken = _inputToken;
  }

  get _outputToken(){
    return this._outputToken;
  }

  set _outputToken(_outputToken){
    this._outputToken = _outputToken;
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
