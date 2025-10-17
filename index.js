import "dotenv/config";
import fs from "fs";
import { chromium } from "playwright";
import OpenAI from "openai";
import { program } from "commander";
import { Step } from "./models/step.js";
import { MockOpenAI } from "./mock-openai.js";

/* -----------------------------------------------
   CONFIGURAZIONE
-------------------------------------------------- */
//TODO: implement --strength onlycache, --strength medium, --strenght high
//TODO: implement --nocache
program
  .option("--mock", "Usa mock OpenAI invece di chiamate API reali (per debug)")
  .option("--strength <level>", "Livello di forza AI (onlycache, medium, high)", "medium")
  .option("--nocache", "Disabilita completamente l'uso della cache");

program.parse(process.argv);
const options = program.opts();

const strength = options.strength;
const noCache = options.nocache;

switch (strength) {
  case "onlycache":
    Step.maxAttempts = 1;
    Step.cacheFirst = true;
    break;
  case "medium":
    Step.maxAttempts = 2; // cache, poi API
    Step.cacheFirst = true;
    break;
  case "high":
    Step.maxAttempts = 3; // cache, poi API x2
    Step.cacheFirst = true;
    break;
}

if(noCache && strength == "onlycache"){
  console.log("--strength onlycache e --nocache sono ozpioni incompatibili");
  process.exit(1);
}

if (noCache) {
  Step.cacheFirst = false;
}

const settings = !options.mock
  ? JSON.parse(fs.readFileSync("aidriven-settings.json", "utf8"))
  : JSON.parse(fs.readFileSync("aidriven-settings.mock.json", "utf8"));
const { execution, ai_agent } = settings;

var stepArr = [];
var isHeadless = execution.headless;

/* -----------------------------------------------
   CONFIGURAZIONE CLIENT OPENAI 
-------------------------------------------------- */
const client = options.mock
  ? new MockOpenAI({
      apiKey: "mock-key",
      baseURL: "mock-url",
    })
  : new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: ai_agent.endpoint,
      defaultQuery: { "api-version": "2024-12-01-preview" },
    });

/* -----------------------------------------------
     Utility functions
-------------------------------------------------- */
const pauseOf = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* -----------------------------------------------
     Generazione codice Playwright
-------------------------------------------------- */
async function generateAndGetPwCode(
  taskDescription,
  url,
  html,
  stepIndex,
  stepId,
  errorMessage = null
) {
  let prompt = `
Sei un assistente che genera SOLO codice Playwright (senza test(), describe() o import).
Genera codice che esegue ESATTAMENTE le seguenti azioni sulla pagina corrente:
"${taskDescription}"

La pagina corrente è: ${url}
`;

  if (errorMessage) {
    prompt += `\nATTENZIONE: Il tentativo precedente ha fallito con questo errore:\n"${errorMessage}"\nCorreggi il codice tenendo conto di questo problema.`;
  }

  prompt += `
Devi usare l'oggetto "page" già aperto (non aprire un nuovo browser o una nuova pagina).
Puoi anche usare "expect" se serve per validare elementi visibili o testi.
Non aggiungere testo extra, solo codice JavaScript eseguibile.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Sei un esperto di automazione browser con Playwright." },
      { role: "user", content: `${prompt}\n\nHTML:\n${html}` },
    ],
  });

  const code = response.choices[0].message.content
    .replace(/```[a-z]*|```/g, "")
    .trim();

  const dir = "./generated/aidriven";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = `${dir}/step-${stepId}.js`;
  fs.writeFileSync(filePath, code);

  console.log(`✅ Step ${stepIndex} generato in: ${filePath}`);

  return {
    code,
    tokenIn: response.usage.prompt_tokens,
    tokenOut: response.usage.completion_tokens,
    cachedToken: response.usage.prompt_tokens_details.cached_tokens,
  };
}

/* -----------------------------------------------
   Calcolo usage totale
-------------------------------------------------- */
function getTotalUsage(stepArr) {
  var totToken = 0;
  var totInToken = 0;
  var totOutToken = 0;
  var totCachedToken = 0;

  for (const step of stepArr) {
    totInToken += step.inputToken || 0;
    totOutToken += step.outputToken || 0;
    totToken += (step.inputToken || 0) + (step.outputToken || 0);
    totCachedToken += step.cachedToken || 0;
  }

  return {
    total_token: totToken,
    input_token: totInToken,
    output_token: totOutToken,
    cached_token: totCachedToken,
    calculated_cost:
      totInToken * (ai_agent.cost_input_token || 0) +
      totOutToken * (ai_agent.cost_output_token || 0) +
      totCachedToken * (ai_agent.cost_cached_token || 0),
  };
}

/* -----------------------------------------------
     Aggiorna file steps
-------------------------------------------------- */
function updateAiDrivenSteps() {
  const output = {
    steps: stepArr.map((step) => ({
      id: step.id,
      sub_prompt: step.subPrompt,
      timeout: step.timeout
    })),
  };

  fs.writeFileSync(execution.steps_file, JSON.stringify(output, null, 2));
}

/* -----------------------------------------------
     Recupera codice dalla cache
-------------------------------------------------- */
function getCachedCode(step) {
  var path = `./generated/aidriven/step-${step.id}.js`;
  if (fs.existsSync(path)) {
    return fs.readFileSync(path, "utf8");
  } else {
    throw new Error(`Cache file not found for step "${step.subPrompt}"`);
  }
}

/* -----------------------------------------------
     MAIN SCRIPT
-------------------------------------------------- */
(async () => {
  const data = JSON.parse(fs.readFileSync(execution.steps_file, "utf8"));
  const steps = data.steps;
  const url = execution.entrypoint_url;
  
  stepArr = steps.map(
    (s, i) =>
      new Step({
        index: i + 1,
        subPrompt: s.sub_prompt,
        timeout: s.timeout || 10000,
      })
  );

  console.log(`\nEntry Point URL: ${url}`);
  console.log(`Numero step da eseguire: ${stepArr.length}`);

  const browser = await chromium.launch({ headless: isHeadless });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const { expect } = await import("@playwright/test");

  const results = [];

  for (const step of stepArr) {

    while(step.attemps > 0 && !step.success){
    step.logStart();
    
    const html = await page.content();

    try {
      var code = "";
      if (step.cache && !noCache) {
        code = getCachedCode(step);
        console.log(`📦 Usando codice dalla cache`);
        step.cache = false;
      } else {
        const errorMsg = step.attemps === 1 && strength == "high" && step.error ? step.error.message : null;
        const responseObj = await generateAndGetPwCode(
          step.subPrompt,
          page.url(),
          html,
          step.index,
          step.id,
          errorMsg
        );

        code = responseObj.code;
        step.inputToken = responseObj.tokenIn;
        step.outputToken = responseObj.tokenOut;
        step.cachedToken = responseObj.cachedToken;
      }

      const asyncCode = `
        (async (page, expect) => {
          ${code}
        })
      `;
      const fn = eval(asyncCode);
      await fn(page, expect);
    
      step.success = true;
      step.logSuccess();
      results.push({
        index: step.index,
        prompt: step.subPrompt,
        status: "success",
      });
      await pauseOf(step.timeout);
    } catch (err) {
      step.logError(err);
      step.error = err;
      results.push({
        index: step.index,
        prompt: step.subPrompt,
        status: "error",
        error: err.message,
      });
      //break;
    }finally{
      step.attemps--;
    }
    
    }
  }

  var usageObj = getTotalUsage(stepArr);
  console.log("\n🏁 Tutte le task completate.");
  console.log(JSON.stringify(usageObj, null, 2));

  await browser.close();

  const resultFile = "./generated/aidriven/run-log.json";
  const output = {
    results,
    usage: usageObj,
    timestamp: new Date().toISOString(),
    mock_mode: options.mock || false,
  };

  fs.writeFileSync(resultFile, JSON.stringify(output, null, 2));
  updateAiDrivenSteps();
  console.log(`Log salvato in: ${resultFile}`);
})();