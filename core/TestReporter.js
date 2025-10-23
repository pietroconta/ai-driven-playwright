// ============================================
// FILE: core/TestReporter.js
// ============================================
import fs from "fs";

/**
 * Gestisce logging e reporting dei test
 */
export class TestReporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || "./generated/aidriven";
    this.stepsPack = options.stepsPack || null;
    this.runResults = [];
    this.startTime = Date.now();
  }

  /**
   * Log inizio tentativo
   */
  logAttemptStart(step, attemptNumber, maxAttempts) {
    const prefix = step.usedCache ? "📦" : "🤖";
    console.log(
      `\n${prefix} Step ${step.index}/${step.totalSteps} [Tentativo ${attemptNumber}/${maxAttempts}]`
    );
    console.log(`   Task: "${step.subPrompt}"`);
  }

  /**
   * Log successo tentativo
   */
  logAttemptSuccess(step, attemptNumber) {
    const cacheInfo = step.usedCache ? " (da cache)" : "";
    console.log(`✅ Step ${step.index} completato${cacheInfo}`);
    
    if (!step.usedCache && step.inputToken) {
      console.log(`   Tokens: ${step.inputToken} in, ${step.outputToken} out, ${step.cachedToken} cached`);
    }
  }

  /**
   * Log errore tentativo
   */
  logAttemptError(step, attemptNumber, error) {
    console.error(`❌ Step ${step.index} fallito (tentativo ${attemptNumber})`);
    console.error(`   Errore: ${error.message}`);
  }

  /**
   * Registra risultato di uno step
   */
  recordStepResult(step, result) {
    this.runResults.push({
      index: step.index,
      id: step.id,
      prompt: step.subPrompt,
      status: result.success ? "success" : "error",
      attempts: result.attempts,
      usedCache: step.usedCache || false,
      error: result.error ? result.error.message : null,
      tokens: {
        input: step.inputToken || 0,
        output: step.outputToken || 0,
        cached: step.cachedToken || 0,
      },
    });
  }

  /**
   * Calcola metriche totali
   */
  calculateTotalUsage(steps, costConfig = {}) {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedTokens = 0;

    for (const step of steps) {
      totalInputTokens += step.inputToken || 0;
      totalOutputTokens += step.outputToken || 0;
      totalCachedTokens += step.cachedToken || 0;
    }

    const totalTokens = totalInputTokens + totalOutputTokens;

    const cost =
      totalInputTokens * (costConfig.input || 0) +
      totalOutputTokens * (costConfig.output || 0) +
      totalCachedTokens * (costConfig.cached || 0);

    return {
      total_tokens: totalTokens,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cached_tokens: totalCachedTokens,
      calculated_cost: cost,
    };
  }

  /**
   * Genera report finale
   */
  generateFinalReport(steps, options = {}) {
    const duration = Date.now() - this.startTime;
    const usage = this.calculateTotalUsage(steps, options.costConfig);

    const successCount = this.runResults.filter(r => r.status === "success").length;
    const failureCount = this.runResults.filter(r => r.status === "error").length;

    console.log("\n" + "=".repeat(50));
    console.log("🏁 ESECUZIONE COMPLETATA");
    console.log("=".repeat(50));
    console.log(`Durata: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Step totali: ${this.runResults.length}`);
    console.log(`✅ Successi: ${successCount}`);
    console.log(`❌ Fallimenti: ${failureCount}`);
    console.log("\n📊 Token Usage:");
    console.log(`   Input: ${usage.input_tokens}`);
    console.log(`   Output: ${usage.output_tokens}`);
    console.log(`   Cached: ${usage.cached_tokens}`);
    console.log(`   Totale: ${usage.total_tokens}`);
    console.log(`   Costo stimato: $${usage.calculated_cost.toFixed(4)}`);

    return { usage, duration, successCount, failureCount };
  }

  /**
   * Salva report su file JSON
   */
  saveJsonReport(steps, options = {}) {
    const reportFile = `${this.outputDir}/run-logs.json`;
    const usage = this.calculateTotalUsage(steps, options.costConfig);

    const currentRun = {
      results: this.runResults,
      usage,
      duration_ms: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
      config: {
        mock_mode: options.mockMode || false,
        strength: options.strength,
        cache_enabled: options.cacheEnabled,
        stepspack: this.stepsPack,
      },
    };

    // Leggi file esistente
    let reportData = {
      stepspack: this.stepsPack,
      runs: [],
    };

    if (fs.existsSync(reportFile)) {
      try {
        const fileContent = fs.readFileSync(reportFile, "utf-8");
        if (fileContent.trim()) {
          reportData = JSON.parse(fileContent);
          if (!reportData.runs) reportData.runs = [];
        }
      } catch (error) {
        console.warn("⚠️ Errore parsing JSON esistente, creo backup");
        const backupFile = `${this.outputDir}/run-logs.backup.${Date.now()}.json`;
        fs.copyFileSync(reportFile, backupFile);
      }
    }

    // Aggiungi nuova run
    reportData.runs.push(currentRun);

    // Salva
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 Report salvato: ${reportFile}`);

    return reportFile;
  }

  /**
   * Genera report HTML (opzionale)
   */
  generateHtmlReport(steps) {
    const htmlPath = `${this.outputDir}/report.html`;
    
    const successSteps = this.runResults.filter(r => r.status === "success");
    const failedSteps = this.runResults.filter(r => r.status === "error");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Report - ${this.stepsPack || 'Default'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    h1 { color: #333; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .card { padding: 15px; border-radius: 6px; background: #f9f9f9; }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
    .step { margin: 10px 0; padding: 15px; border: 1px solid #ddd; border-radius: 4px; }
    .step.success { border-left: 4px solid #28a745; }
    .step.error { border-left: 4px solid #dc3545; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 Test Execution Report</h1>
    <p><strong>StepsPack:</strong> ${this.stepsPack || "N/A"}</p>
    <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
    
    <div class="summary">
      <div class="card success">
        <h3>✅ ${successSteps.length}</h3>
        <p>Successi</p>
      </div>
      <div class="card error">
        <h3>❌ ${failedSteps.length}</h3>
        <p>Fallimenti</p>
      </div>
    </div>

    <h2>Step Details</h2>
    ${this.runResults.map(r => `
      <div class="step ${r.status}">
        <strong>Step ${r.index}:</strong> ${r.prompt}
        <br><small>Status: ${r.status} | Attempts: ${r.attempts}${r.usedCache ? ' | 📦 Cached' : ''}</small>
        ${r.error ? `<br><span style="color: #dc3545;">Error: ${r.error}</span>` : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>
    `;

    fs.writeFileSync(htmlPath, html);
    console.log(`📄 Report HTML: ${htmlPath}`);
  }
}
