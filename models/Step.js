// ============================================
// FILE: models/Step.js (REFACTORED)
// ============================================
import crypto from "crypto";

/**
 * Modello che rappresenta un singolo step di test
 */
export class Step {
  // Configurazioni statiche (saranno impostate dal main)
  static maxAttempts = 2;
  static cacheFirst = true;
  static outputDir = "./generated/aidriven";

  constructor(config) {
    this.index = config.index;
    this.subPrompt = config.subPrompt;
    this.timeout = config.timeout || 10000;
    this.totalSteps = config.totalSteps || 1;
    this.stepsPack = config.stepsPack || null;

    // Genera ID univoco basato sul prompt
    this.id = this._generateId(config.subPrompt);

    // Stato esecuzione
    this.success = false;
    this.error = null;
    this.usedCache = false;

    // Metriche
    this.inputToken = 0;
    this.outputToken = 0;
    this.cachedToken = 0;
    this.executionTime = 0;
  }

  /**
   * Genera ID deterministico per lo step
   */
  _generateId(prompt) {
    return crypto.createHash("md5").update(prompt).digest("hex").substring(0, 8);
  }

  /**
   * Verifica se esiste codice in cache
   */
  get cache() {
    const fs = require("fs");
    const path = `${Step.outputDir}/step-${this.id}.js`;
    return fs.existsSync(path);
  }

  /**
   * Ottiene il numero massimo di tentativi per questo step
   */
  get maxAttemptsForStep() {
    return Step.maxAttempts;
  }

  /**
   * Verifica se lo step deve usare la cache come primo tentativo
   */
  get shouldUseCacheFirst() {
    return Step.cacheFirst && this.cache;
  }

  /**
   * Crea una copia dello step per retry
   */
  clone() {
    return new Step({
      index: this.index,
      subPrompt: this.subPrompt,
      timeout: this.timeout,
      totalSteps: this.totalSteps,
      stepsPack: this.stepsPack,
    });
  }

  /**
   * Serializza lo step per salvataggio
   */
  toJSON() {
    return {
      id: this.id,
      index: this.index,
      sub_prompt: this.subPrompt,
      timeout: this.timeout,
      success: this.success,
      usedCache: this.usedCache,
      tokens: {
        input: this.inputToken,
        output: this.outputToken,
        cached: this.cachedToken,
      },
      error: this.error ? this.error.message : null,
    };
  }

  /**
   * Resetta lo stato dello step (per retry)
   */
  reset() {
    this.success = false;
    this.error = null;
    this.usedCache = false;
  }
}
