// ============================================
// FILE: core/TestRunner.js
// ============================================
import { chromium } from "playwright";

/**
 * Orchestratore principale che coordina l'esecuzione dei test
 */
export class TestRunner {
  constructor(config) {
    this.config = config;
    this.executor = config.executor;
    this.codeGenerator = config.codeGenerator;
    this.retryManager = config.retryManager;
    this.reporter = config.reporter;
  }

  /**
   * Esegue tutti gli step in sequenza
   */
  async run(steps, entryUrl) {
    const browser = await chromium.launch({
      headless: this.config.headless !== false,
    });

    const page = await browser.newPage();
    
    try {
      console.log(`\n🚀 Avvio esecuzione`);
      console.log(`🌐 URL: ${entryUrl}`);
      console.log(`📋 Step totali: ${steps.length}`);
      console.log(`⚙️  Strategia: ${this.config.strength}`);

      // Navigazione iniziale
      await page.goto(entryUrl, { waitUntil: "domcontentloaded" });

      // Import expect di Playwright
      const { expect } = await import("@playwright/test");

      // Esegui ogni step
      for (const step of steps) {
        const result = await this._executeStep(step, page, expect);

        // Registra risultato
        this.reporter.recordStepResult(step, result);

        // Se lo step ha successo, attendi timeout prima del prossimo
        if (result.success) {
          await this._pause(step.timeout);
        } else if (this.config.stopOnError) {
          console.error(`\n🛑 Esecuzione interrotta per errore critico`);
          break;
        }
      }

      // Genera report finale
      const summary = this.reporter.generateFinalReport(steps, {
        costConfig: this.config.costConfig,
        strength: this.config.strength,
        cacheEnabled: !this.config.noCache,
        mockMode: this.config.mockMode,
      });

      // Salva report JSON
      this.reporter.saveJsonReport(steps, {
        costConfig: this.config.costConfig,
        strength: this.config.strength,
        cacheEnabled: !this.config.noCache,
        mockMode: this.config.mockMode,
      });

      // Genera HTML report (opzionale)
      if (this.config.generateHtmlReport) {
        this.reporter.generateHtmlReport(steps);
      }

      return summary;
    } catch (error) {
      console.error(`\n💥 ERRORE CRITICO:`, error.message);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Esegue un singolo step con gestione retry
   */
  async _executeStep(step, page, expect) {
    const context = {
      step,
      codeGenerator: this.codeGenerator,
      executor: this.executor,
      page,
      expect,
      logger: this.reporter,
    };

    return await this.retryManager.executeWithRetry(null, context);
  }

  /**
   * Pausa per il timeout specificato
   */
  async _pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}