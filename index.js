// ============================================
// FILE: index.js (VERSIONE FINALE)
// ============================================
import "dotenv/config";
import OpenAI from "openai";
import { program } from "commander";

// Core components
import { Step } from "./models/Step.js";
import { TestExecutor } from "./core/TestExecutor.js";
import { CodeGenerator } from "./core/CodeGenerator.js";
import { RetryManager } from "./core/RetryManager.js";
import { TestReporter } from "./core/TestReporter.js";
import { TestRunner } from "./core/TestRunner.js";
import { ConfigManager } from "./core/ConfigManager.js";
import { MockOpenAI } from "./mock-openai.js";

/* -----------------------------------------------
   CLI CONFIGURATION
-------------------------------------------------- */
program
  .name("aidriven-test")
  .description("AI-Driven Playwright Test Executor")
  .version("2.0.0")
  .option("--mock", "Use mock OpenAI (debug mode)")
  .option(
    "--strength <level>",
    "AI strength: onlycache, medium, high",
    "medium"
  )
  .option(
    "--htmlclean-remove <items>",
    "Comma-separated elements to remove from HTML",
    "comments,script,style,svg,img,attributes,longtext"
  )
  .option(
    "--htmlclean-keep <items>",
    "Comma-separated elements to keep",
    ""
  )
  .option("--nocache", "Disable cache usage")
  .option("--stepspack <name>", "Use steps pack from ./stepspacks/<name>")
  .option("--html-report", "Generate HTML report")
  .option("--stop-on-error", "Stop execution on first critical error");

program.parse();
const options = program.opts();

/* -----------------------------------------------
   CONFIGURATION LOADING
-------------------------------------------------- */
const configManager = new ConfigManager(options);

try {
  // Validate options compatibility
  configManager.validateOptions();
  configManager.validateStrength(options.strength);

  // Load configuration
  const settings = configManager.load();
  const { execution, ai_agent } = settings;

  /* -----------------------------------------------
     STEP CONFIGURATION
  -------------------------------------------------- */
  const strengthConfig = {
    onlycache: { maxAttempts: 1, cacheFirst: true },
    medium: { maxAttempts: 2, cacheFirst: true },
    high: { maxAttempts: 3, cacheFirst: true },
  };

  const strengthSettings = strengthConfig[options.strength];
  Step.maxAttempts = strengthSettings.maxAttempts;
  Step.cacheFirst = options.nocache ? false : strengthSettings.cacheFirst;
  Step.outputDir = configManager.getOutputDir();

  /* -----------------------------------------------
     OPENAI CLIENT INITIALIZATION
  -------------------------------------------------- */
  const client = options.mock
    ? new MockOpenAI({
        apiKey: "mock-key",
        baseURL: "mock-url",
        hardCode: settings.hc_code,
      })
    : new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: ai_agent.endpoint,
        defaultQuery: { "api-version": "2024-12-01-preview" },
      });

  /* -----------------------------------------------
     HTML CLEANING CONFIGURATION
  -------------------------------------------------- */
  const removeItems = options.htmlcleanRemove
    .split(",")
    .map(i => i.trim())
    .filter(Boolean);

  const keepItems = options.htmlcleanKeep
    .split(",")
    .map(i => i.trim())
    .filter(Boolean);

  /* -----------------------------------------------
     COMPONENT INITIALIZATION
  -------------------------------------------------- */
  const executor = new TestExecutor({
    outputDir: configManager.getOutputDir(),
    removeItems,
    keepItems,
  });

  const codeGenerator = new CodeGenerator(client, {
    model: ai_agent.model || "gpt-4o",
  });

  const retryManager = new RetryManager({
    strategy: options.strength,
  });

  const reporter = new TestReporter({
    outputDir: configManager.getOutputDir(),
    stepsPack: options.stepspack || null,
  });

  const runner = new TestRunner({
    executor,
    codeGenerator,
    retryManager,
    reporter,
    headless: execution.headless,
    strength: options.strength,
    noCache: options.nocache,
    mockMode: options.mock,
    stopOnError: options.stopOnError,
    generateHtmlReport: options.htmlReport,
    costConfig: {
      input: ai_agent.cost_input_token || 0,
      output: ai_agent.cost_output_token || 0,
      cached: ai_agent.cost_cached_token || 0,
    },
  });

  /* -----------------------------------------------
     LOAD AND VALIDATE STEPS
  -------------------------------------------------- */
  const stepsData = configManager.loadSteps();
  const steps = stepsData.map(
    (s, i) =>
      new Step({
        index: i + 1,
        subPrompt: s.sub_prompt,
        timeout: s.timeout || 10000,
        totalSteps: stepsData.length,
        stepsPack: options.stepspack,
      })
  );

  /* -----------------------------------------------
     CACHE VALIDATION (onlycache mode)
  -------------------------------------------------- */
  if (options.strength === "onlycache") {
    if (!configManager.validateCache(steps)) {
      process.exit(1);
    }
  }

  /* -----------------------------------------------
     EXECUTION SUMMARY
  -------------------------------------------------- */
  const summary = configManager.getSummary();
  console.log("\n" + "=".repeat(50));
  console.log("🚀 AI-DRIVEN TEST EXECUTION");
  console.log("=".repeat(50));
  console.log(`📦 StepsPack: ${summary.stepspack || "Standard"}`);
  console.log(`🌐 Entry URL: ${summary.entryUrl}`);
  console.log(`📋 Total Steps: ${steps.length}`);
  console.log(`⚙️  Strength: ${summary.strength}`);
  console.log(`💾 Cache: ${summary.cacheEnabled ? "Enabled" : "Disabled"}`);
  console.log(`🤖 Mode: ${summary.mockMode ? "Mock" : "Live"}`);
  console.log("=".repeat(50) + "\n");

  /* -----------------------------------------------
     MAIN EXECUTION
  -------------------------------------------------- */
  (async () => {
    try {
      const result = await runner.run(steps, summary.entryUrl);

      // Exit with appropriate code
      process.exit(result.failureCount > 0 ? 1 : 0);
    } catch (error) {
      console.error("\n💥 EXECUTION FAILED:", error.message);
      if (error.stack) {
        console.error("\nStack trace:");
        console.error(error.stack);
      }
      process.exit(1);
    }
  })();
} catch (error) {
  console.error("\n❌ CONFIGURATION ERROR:", error.message);
  process.exit(1);
}
