import "dotenv/config";
import fs from "fs";
import readline from "readline";
import { chromium } from "playwright";
import OpenAI from "openai";
import { program } from "commander";
import { Step } from "./models/step.js";

/* -----------------------------------------------
   CONFIGURAZIONE (comportamento esecuzione in base ai parametri dati all'avvio, comportamento del driven ai, step ecc)
-------------------------------------------------- */
//todo: timestamp su json, token in and token out
program.option(
  "-m, --mode <type>",
  'Modalità di esecuzione: "config" o "interactive"',
  "config"
);
program.parse(process.argv);
const options = program.opts();

const settings = JSON.parse(fs.readFileSync("aidriven-settings.json", "utf8"));
const { execution, ai_agent } = settings;

var stepArr = [];
var isHeadless = execution.headless;

var isNotInpt = !options.mode || options.mode == "config";

/* -----------------------------------------------
   CONFIGURAZIONE CLIENT OPENAI (Azure endpoint)
-------------------------------------------------- */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: ai_agent.endpoint, //endpoint dentro il file di config aidriven-settings.json
  defaultQuery: { "api-version": "2024-12-01-preview" },
});

/* -----------------------------------------------
     Utility: funzione di pausa asincrona
   Esegue un delay (in ms) tra uno step e l’altro
-------------------------------------------------- */
const pauseOf = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* -----------------------------------------------
     Utility: funzione per chiedere input da console
   - Mostra una domanda
   - Attende la risposta dell’utente
   - Restituisce la risposta come stringa
-------------------------------------------------- */
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
     Funzione principale di generazione codice AI
   Genera solo codice Playwright basato su:
   - Descrizione del task (es. “clicca login”)
   - URL corrente
   - HTML corrente della pagina

   Output:
   - File ./generated/stepX.js contenente il codice
   - Restituisce la stringa JS del codice generato
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

  //   Richiesta al modello OpenAI
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

  //   Pulisce eventuali blocchi Markdown dal codice AI
  const code = response.choices[0].message.content
    .replace(/```[a-z]*|```/g, "")
    .trim();

  //   Salva il codice generato in ./generated/
  const dir = "./generated/aidriven";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = `${dir}/step${stepIndex}.js`;
  fs.writeFileSync(filePath, code);

  console.log(`✅ Step ${stepIndex} generato in: ${filePath}`);
  console.log("prompted token: ", response.usage.prompt_tokens);
  return {
    code: code,
    tokenIn: response.usage.prompt_tokens,
    tokenOut: response.usage.completion_tokens,
    cachedToken: response.usage.prompt_tokens_details.cached_tokens,
  };
  //return code;
}

/* -----------------------------------------------
   Funzione che passandogli un array di Step ritorna
   un oggetto che contiene:
        total_token: x
        input_token: x
        output_token: x
        calculated_cost: x
-------------------------------------------------- */
function getTotalUsage(stepArr) {
  var totToken = 0;
  var totInToken = 0;
  var totOutToken = 0;
  var totCachedToken = 0;
  for (var step in stepArr) {
    totInToken += step.inputToken;
    totOutToken += step.outputToken;
    totToken += step.inputToken + step.outputToken;
    totCachedToken += step.cachedToken;
  }

  return {
    total_token: totToken,
    input_token: totInToken,
    output_token: totOutToken,
    calculated_cost:
      totInToken * ai_agent.cost_input_token +
      totOutToken * ai_agent.cost_output_token +
      totCachedToken * ai_agent.cost_cached_token,
  };
}

/* -----------------------------------------------
     MAIN SCRIPT – Flusso principale
   1  Chiede all’utente URL e descrizione delle azioni
   2  Divide la descrizione in step
   3  Per ogni step:
       - Chiede al modello di generare il codice
       - Esegue il codice generato nel browser reale
-------------------------------------------------- */
/* -----------------------------------------------
     MAIN SCRIPT – Flusso principale
     Modalità supportate:
     - config: legge URL e step da file JSON
     - interactive: chiede tutto da console
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

    // Creiamo oggetti Step anche per l'input utente
    stepArr = taskList.map(
      (t, i) =>
        new Step({
          index: i + 1,
          subPrompt: t,
          timeout: 10000, // default timeout, opzionale
        })
    );
  } else {
    const data = JSON.parse(fs.readFileSync(execution.steps_file, "utf8"));
    steps = data.steps; // assegna all’array globale già definito
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

  console.log(`\nURL iniziale: ${url}`);
  console.log(`Numero step da eseguire: ${stepArr.length}`);
  console.log(stepArr[0].subPrompt);
  // Avvio browser Playwright
  const browser = await chromium.launch({ headless: isHeadless });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const { expect } = await import("@playwright/test");

  // Array per salvare risultati (success/error)
  const results = [];

  for (const step of stepArr) {
    step.logStart();

    const html = await page.content();

    try {
      // Genera codice Playwright con AI
      const responseObj = await generateAndGetPwCode(
        step.subPrompt,
        page.url(),
        html,
        step.index
      );

      //assegno all'oggetto step il numero dei token
      step.inputToken = responseObj.tokenIn;
      step.outputToken = responseObj.tokenOut;
      step.cachedToken = responseObj.cachedToken;

      // Esegue il codice generato
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
  await browser.close();

  // Salva risultati in un file JSON
  const resultFile = "./generated/aidriven/run-log.json";

  const output = {
    results,
    usage: usageObj,
  };

  fs.writeFileSync(resultFile, JSON.stringify(output, null, 2));

  console.log(`Log salvato in: ${resultFile}`);
})();
