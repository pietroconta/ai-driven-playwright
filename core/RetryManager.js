// ============================================
// FILE: core/RetryManager.js
// ============================================

/**
 * Gestisce la logica di retry con strategie configurabili
 */
export class RetryManager {
  constructor(options = {}) {
    this.strategy = options.strategy || "medium"; // onlycache, medium, high
    this.maxAttempts = this._getMaxAttempts(options.strategy);
    this.useCacheFirst = options.strategy !== "nocache";
  }

  /**
   * Determina il numero massimo di tentativi
   */
  _getMaxAttempts(strategy) {
    const strategies = {
      onlycache: 1,
      medium: 2,
      high: 3,
    };

    return strategies[strategy] || 2;
  }

  /**
   * Esegue una funzione con retry automatico
   */
  async executeWithRetry(fn, context) {
    const { step, codeGenerator, executor, page, expect, logger } = context;

    let lastError = null;
    let attemptsRemaining = this.maxAttempts;

    while (attemptsRemaining > 0 && !step.success) {
      const attemptNumber = this.maxAttempts - attemptsRemaining + 1;

      logger.logAttemptStart(step, attemptNumber, this.maxAttempts);

      try {
        // 1. Ottieni il codice (cache o generazione)
        const code = await this._getCode(
          step,
          executor,
          codeGenerator,
          page,
          lastError,
          attemptNumber
        );

        // 2. Esegui il codice
        const result = await executor.execute(code, page, expect);

        if (result.success) {
          step.success = true;
          logger.logAttemptSuccess(step, attemptNumber);
          return { success: true, attempts: attemptNumber };
        } else {
          throw new Error(result.error.message);
        }
      } catch (error) {
        lastError = error;
        step.error = error;

        logger.logAttemptError(step, attemptNumber, error);
        console.log("error: ", typeof (error + ""));
        if (`${error}`.includes("Test failed:")) {
          attemptsRemaining = 0;
          console.log("Test Fallito, fine esecuzione");

          return {
            success: false,
            attempts: attemptNumber,
            error: error,
          };
        }

        // Se è onlycache e manca la cache, fallimento critico
        if (this.strategy === "onlycache" && this._isCacheError(error)) {
          throw new Error(
            `Cache mancante per step "${step.subPrompt}" in modalità onlycache`
          );
        }
      } finally {
        attemptsRemaining--;
      }
    }

    // Tutti i tentativi falliti
    return {
      success: false,
      attempts: this.maxAttempts,
      error: lastError,
    };
  }

  /**
   * Ottiene il codice da eseguire (cache o generazione)
   */
  async _getCode(
    step,
    executor,
    codeGenerator,
    page,
    lastError,
    attemptNumber
  ) {
    // Tentativo 1: usa cache se disponibile e abilitata
    if (attemptNumber === 1 && this.useCacheFirst) {
      try {
        console.log("Sto usando la cache");
        const cachedCode = executor.loadCachedCode(step.id);
        step.usedCache = true;
        return cachedCode;
      } catch (cacheError) {
        // Cache non trovata, fallback a generazione
        if (this.strategy === "onlycache") {
          throw cacheError; // In onlycache mode, cache mancante è critico
        }
      }
    }

    // Generazione codice con AI
    const html = await executor.extractCleanHtml(page, {
      stepIndex: step.index,
      stepsPack: step.stepsPack,
    });

    const context = {
      taskDescription: step.subPrompt,
      url: page.url(),
      html,
      errorMessage: lastError ? lastError.message : null,
    };

    const result = await codeGenerator.generate(step, context);

    // Aggiorna metriche step
    step.inputToken = result.usage.inputTokens;
    step.outputToken = result.usage.outputTokens;
    step.cachedToken = result.usage.cachedTokens;

    // Salva in cache per prossime esecuzioni
    executor.saveCachedCode(step.id, result.code);

    return result.code;
  }

  /**
   * Verifica se l'errore è dovuto a cache mancante
   */
  _isCacheError(error) {
    return error.message.includes("Cache file not found");
  }
}
