import "dotenv/config";
import fs from "fs";
import readline from "readline";
import { chromium } from "playwright";
import OpenAI from "openai";
import { program } from "commander";
import { Step } from "./models/step.js";
import { MockOpenAI } from "./mock-openai.js";  // ← Import del mock

/* -----------------------------------------------
   CONFIGURAZIONE
-------------------------------------------------- */
program.option(
  "-m, --mode <type>",
  'Modalità di esecuzione: "config" o "interactive"',
  "config"
);
program.option(
  "--mock",
  "Usa mock OpenAI invece di chiamate API reali (per debug)"
);
program.parse(process.argv);
const options = program.opts();

const settings = !options.mock ? 
JSON.parse(fs.readFileSync("aidriven-settings.json", "utf8"))  : 
JSON.parse(fs.readFileSync("aidriven-settings.mock.json", "utf8"));
const { execution, ai_agent } = settings;

var stepArr = [];
var isHeadless = execution.headless;

/* -----------------------------------------------
   CONFIGURAZIONE CLIENT OPENAI 
   Usa MockOpenAI se --mock è attivo
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

if (options.mock) {
  console.log("🔧 MODALITÀ MOCK ATTIVA - Nessun costo API");
}

/* -----------------------------------------------
     Utility functions
-------------------------------------------------- */
const pauseOf = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

/* -----------------------------------------------
     Generazione codice Playwright
-------------------------------------------------- */
async function generateAndGetPwCode(taskDescription, url, html, stepIndex) {
  const prompt = `
Sei un assistente che genera SOLO codice Playwright (senza test(), describe() o import).
Genera codice che esegue ESATTAMENTE le seguenti azioni sulla pagina corrente:
"${taskDescription}"

La pagina corrente è: ${url}
Devi usare l'oggetto "page" già aperto (non aprire un nuovo browser o una nuova pagina).
Puoi anche usare "expect" se serve per validare elementi visibili o testi.
Non aggiungere testo extra, solo codice JavaScript eseguibile.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Sei un esperto di automazione browser con Playwright.",
      },
      { role: "user", content: `${prompt}\n\nHTML:\n${html}` },
      
    ],
  });

  const code = response.choices[0].message.content
    .replace(/```[a-z]*|```/g, "")
    .trim();

  const dir = "./generated/aidriven";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = `${dir}/step${stepIndex}.js`;
  fs.writeFileSync(filePath, code);

  console.log(`✅ Step ${stepIndex} generato in: ${filePath}`);
  //console.log("prompted token: ", response.usage.prompt_tokens);
  
  return {
    code: code,
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
     MAIN SCRIPT
-------------------------------------------------- */
(async () => {
  let url;
  let steps = [];

  if (options.mode === "interactive") {
    console.log("Modalità INTERACTIVE.");

    url = await ask("Inserisci l'URL iniziale: ");
    const fullTask = await ask(
      "Descrivi le azioni (es: 'clicca login, inserisci username e password, vai alla dashboard'): "
    );

    const taskList = fullTask.split(",").map((t) => t.trim());

    stepArr = taskList.map(
      (t, i) =>
        new Step({
          index: i + 1,
          subPrompt: t,
          timeout: 10000,
        })
    );
  } else {
    const data = JSON.parse(fs.readFileSync(execution.steps_file, "utf8"));
    steps = data.steps;
    url = execution.entrypoint_url;
    stepArr = steps.map(
      (s, i) =>
        new Step({
          index: i + 1,
          subPrompt: s.sub_prompt,
          timeout: s.timeout || 10000,
        })
    );
  }

  console.log(`\nEntry Point URL: ${url}`);
  console.log(`Numero step da eseguire: ${stepArr.length}`);

  const browser = await chromium.launch({ headless: isHeadless });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const { expect } = await import("@playwright/test");

  const results = [];

  for (const step of stepArr) {
    step.logStart();

    const html = await page.content();

    try {
      const responseObj = await generateAndGetPwCode(
        step.subPrompt,
        page.url(),
        html,
        step.index
      );

      step.inputToken = responseObj.tokenIn;
      step.outputToken = responseObj.tokenOut;
      step.cachedToken = responseObj.cachedToken;

      const asyncCode = `
        (async (page, expect) => {
          ${responseObj.code}
        })
      `;
      const fn = eval(asyncCode);
      await fn(page, expect);

      step.logSuccess();
      results.push({
        index: step.index,
        prompt: step.subPrompt,
        status: "success",
      });
      await pauseOf(step.timeout);
    } catch (err) {
      step.logError(err);
      results.push({
        index: step.index,
        prompt: step.subPrompt,
        status: "error",
        error: err.message,
      });
      break;
    }
  }
  
  var usageObj = getTotalUsage(stepArr);
  console.log("\n🏁 Tutte le task completate.");
  //console.log("\n📊 Usage totale:");
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

  console.log(`Log salvato in: ${resultFile}`);
})();