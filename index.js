//TODO: se l'errore è un errore lanciato dalla funzione fn, quindi un errore del prodotto anzichè del test driver ai allora il fallback non dovrà essere eseguito e nel json dovrà essere inserito solo il msg di erorre non tutta l'eccezione

//TODO verificare funizionamento controllo errore
// ============================================
// FILE: index.js
// ============================================
import dotenv from "dotenv";
import "dotenv/config";
import fs from "fs";
import { chromium } from "playwright";
import OpenAI from "openai";
import { program } from "commander";
import { Step } from "./models/step.js";
import { MockOpenAI } from "./mock-openai.js";
import { JSDOM } from "jsdom";
/* -----------------------------------------------
   CONFIGURAZIONE CLI
-------------------------------------------------- */
program
  .option("--mock", "Usa mock OpenAI invece di chiamate API reali (per debug)")
  .option(
    "--strength <level>",
    "Livello di forza AI (onlycache, medium, high)",
    "medium"
  )
  /*.option(
    "--cxtclean <level>",
    "Livello di pulizia del dom che verrà passato all'agent (low, medium, high)",
    "medium"
  )*/
  .option(
    "--htmlclean-remove <items>",
    "Elenco elementi da rimuovere separati da virgola (es: script,style,svg,img,comments,attributes,longtext)",
    "comments, script, style, svg, img, attributes, longtext"
  )
  .option(
    "--htmlclean-keep <items>",
    "Elenco elementi da tenere separati da virgola (es:script, comments, img, style)",
    ""
  )
  .option("--nocache", "Disabilita completamente l'uso della cache")
  .option(
    "--stepspack <name>",
    "Usa un pack di steps dalla cartella ./stepspacks/<name>"
  );

program.parse(process.argv);
const options = program.opts();

const strength = options.strength;
const noCache = options.nocache;
const stepsPack = options.stepspack;

const removeItems = options.htmlcleanRemove.split(",").map((i) => i.trim());
const keepItems = options.htmlcleanKeep.split(",").map((i) => i.trim());
console.log(removeItems);
/* -----------------------------------------------
   VALIDAZIONE OPZIONI
-------------------------------------------------- */
switch (strength) {
  case "onlycache":
    Step.maxAttempts = 1;
    Step.cacheFirst = true;
    break;
  case "medium":
    Step.maxAttempts = 2;
    Step.cacheFirst = true;
    break;
  case "high":
    Step.maxAttempts = 3;
    Step.cacheFirst = true;
    break;
}

if (noCache && strength == "onlycache") {
  console.log("--strength onlycache e --nocache sono opzioni incompatibili");
  process.exit(1);
}

if (options.mock && stepsPack) {
  console.log("--mock e --stepspack sono opzioni incompatibili");
  process.exit(1);
}

if (noCache) {
  Step.cacheFirst = false;
}

/* -----------------------------------------------
   CARICAMENTO CONFIGURAZIONE (CON STEPSPACK)
-------------------------------------------------- */
let settings;
let stepsPackPath = null;
let outputDir = "./generated/aidriven";

if (stepsPack) {
  // Modalità StepsPack
  stepsPackPath = `./stepspacks/${stepsPack}`;

  if (stepsPackPath && fs.existsSync(`${stepsPackPath}/.env`)) {
    dotenv.config({ path: `${stepsPackPath}/.env` });
    console.log("API key caricata da StepsPack .env");
  }

  if (!fs.existsSync(stepsPackPath)) {
    console.error(`❌ ERRORE: StepsPack non trovato: ${stepsPackPath}`);
    console.error(`Cartelle disponibili in ./stepspacks/:`);

    if (fs.existsSync("./stepspacks")) {
      const packs = fs
        .readdirSync("./stepspacks")
        .filter((f) => fs.statSync(`./stepspacks/${f}`).isDirectory());

      if (packs.length > 0) {
        packs.forEach((p) => console.error(`   - ${p}`));
      } else {
        console.error("(nessun pack disponibile)");
      }
    }

    process.exit(1);
  }

  const settingsPath = `${stepsPackPath}/settings.json`;
  if (!fs.existsSync(settingsPath)) {
    console.error(
      `❌ ERRORE: File settings.json non trovato in ${stepsPackPath}`
    );
    process.exit(1);
  }

  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

  // Override steps_file path per puntare al pack
  settings.execution.steps_file = `${stepsPackPath}/steps.json`;

  // Output directory dedicato per il pack
  outputDir = `${stepsPackPath}/generated`;

  console.log(`📦 Usando StepsPack: ${stepsPack}`);
  console.log(`📁 Output directory: ${outputDir}`);
} else {
  // Modalità standard
  settings = !options.mock
    ? JSON.parse(fs.readFileSync("aidriven-settings.json", "utf8"))
    : JSON.parse(fs.readFileSync("aidriven-settings.mock.json", "utf8"));
}

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
      hardCode: settings.hc_code,
    })
  : new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: ai_agent.endpoint,
      defaultQuery: { "api-version": "2024-12-01-preview" },
    });

/* -----------------------------------------------
   UTILITY FUNCTIONS
-------------------------------------------------- */
const pauseOf = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* -----------------------------------------------
   GENERAZIONE CODICE PLAYWRIGHT (CON OUTPUT DIR)
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

  // Usa la directory di output corretta (pack o default)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let improvedCode = `await page.waitForLoadState('networkidle');
  ${code}`;

  const filePath = `${outputDir}/step-${stepId}.js`;
  fs.writeFileSync(filePath, improvedCode);

  console.log(`✅ Step ${stepIndex} generato in: ${filePath}`);

  //console.log("improved code", improvedCode);
  return {
    code: improvedCode,
    tokenIn: response.usage.prompt_tokens,
    tokenOut: response.usage.completion_tokens,
    cachedToken: response.usage.prompt_tokens_details.cached_tokens,
  };
}

/* -----------------------------------------------
   CALCOLO USAGE TOTALE
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
   AGGIORNA FILE STEPS (CON PATH CORRETTO)
-------------------------------------------------- */
function updateAiDrivenSteps() {
  const output = {
    steps: stepArr.map((step) => ({
      id: step.id,
      sub_prompt: step.subPrompt,
      timeout: step.timeout,
    })),
  };

  fs.writeFileSync(execution.steps_file, JSON.stringify(output, null, 2));
}

/* -----------------------------------------------
   RECUPERA CODICE DALLA CACHE (CON OUTPUT DIR)
-------------------------------------------------- */
function getCachedCode(step) {
  const path = `${outputDir}/step-${step.id}.js`;
  if (fs.existsSync(path)) {
    return fs.readFileSync(path, "utf8");
  } else {
    throw new Error(`Cache file not found for step "${step.subPrompt}"`);
  }
}

/* -----------------------------------------------
   CALCOLA LA DIFFERENZA TRA DUE STRINGHE HTML
   - Restituisce solo le righe presenti in `after` 
     ma assenti in `before`
   - Utile per inviare all'agent solo i nuovi elementi 
     introdotti da uno step
-------------------------------------------------- */
function getHtmlDiff(before, after) {
  const beforeLines = before.split("\n").map((l) => l.trim());
  const afterLines = after.split("\n").map((l) => l.trim());
  const diff = afterLines.filter((line) => !beforeLines.includes(line));
  return diff.join("\n");
}

/**
 * Rimuove contenuti non rilevanti dall'HTML prima di inviarlo all'AI
 * - Commenti HTML
 * - Script inline e esterni
 * - Stili CSS inline
 * - Attributi inutili (data-*, aria-* eccetto aria-label)
 * - Contenuti nascosti (display: none, hidden)
 */
function cleanHtmlForAI(html, removeItems = [], keepItems = []) {
  let cleaned = html;
  const shouldRemove = (item) =>
    removeItems.includes("all") ||
    (removeItems.includes(item) && !keepItems.includes(item));
  console.log("before clean", html.length);
  if (shouldRemove("comments")) {
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  }
  if (shouldRemove("script")) {
    cleaned = cleaned.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ""
    );
  }
  if (shouldRemove("style")) {
    cleaned = cleaned.replace(
      /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
      ""
    );
  }
  if (shouldRemove("svg")) {
    cleaned = cleaned.replace(/<path\b[^>]*\/?>/gi, "");
    cleaned = cleaned.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "");
  }

  if (shouldRemove("img")) {
    cleaned = cleaned.replace(/<img\b[^>]*\s+src=["'][^"']*["']/gi, (match) => {
      return match.replace(/\s+src=["'][^"']*["']/, "");
    });
  }
  if (shouldRemove("inlinestyle")) {
    cleaned = cleaned.replace(/\s+style="[^"]*"/gi, "");
  }

  if (shouldRemove("attributes")) {
    cleaned = cleaned.replace(/\s+data-(?!testid)[a-z-]+=["'][^"']*["']/gi, "");
    cleaned = cleaned.replace(/\s+aria-(?!label)[a-z-]+=["'][^"']*["']/gi, "");
  }

  if (shouldRemove("longtext")) {
    cleaned = removeLongText(cleaned, 25);
  }

  cleaned = cleaned.replace(/\s+/g, " ");
  cleaned = cleaned.replace(/>\s+</g, "><");
  console.log("after clean", cleaned.length);

  return cleaned.trim();
}

function removeLongText(html, maxLength = 30) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  function cleanNode(node) {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        // TEXT_NODE
        if (child.textContent.trim().length > maxLength) {
          child.textContent = "";
        }
      } else if (child.nodeType === 1) {
        // ELEMENT_NODE
        cleanNode(child); // ricorsione sui figli
      }
    });
  }

  cleanNode(doc.body);
  return doc.body.innerHTML;
}

/*async function extractRelevantHtml(page, prompt) {
  const promptLower = prompt.toLowerCase();
  
  // Mappa keyword -> selettori CSS
  const relevanceMap = {
    'login': 'form, input[type="text"], input[type="password"], input[type="email"], button[type="submit"]',
    'username': 'input[type="text"], input[name*="user"], input[id*="user"]',
    'password': 'input[type="password"]',
    'button': 'button, a.btn, input[type="submit"]',
    'click': 'button, a, [role="button"], [onclick]',
    'menu': 'nav, [role="navigation"], .menu, #menu',
    'dropdown': 'select, [role="listbox"], .dropdown',
    'form': 'form, input, textarea, select',
    'table': 'table, [role="table"]',
    'modal': '[role="dialog"], .modal, .popup',
  };

  // Trova selettori rilevanti
  let selectors = [];
  for (const [keyword, selector] of Object.entries(relevanceMap)) {
    if (promptLower.includes(keyword)) {
      selectors.push(selector);
    }
  }

  // Fallback: se nessun keyword match, usa body completo (ma pulito)
  if (selectors.length === 0) {
    const fullHtml = await page.$eval('body', el => el.outerHTML);
    return cleanHtmlForAI(fullHtml);
  }

  // Estrai solo elementi rilevanti
  const relevantHtml = await page.evaluate((selectorsList) => {
    const elements = [];
    selectorsList.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        elements.push(el.outerHTML);
      });
    });
    return elements.join('\n');
  }, selectors);

  return cleanHtmlForAI(relevantHtml);
}*/

/* -----------------------------------------------
   MAIN SCRIPT
-------------------------------------------------- */
(async () => {
  const data = JSON.parse(fs.readFileSync(execution.steps_file, "utf8"));
  const steps = data.steps;
  const url = execution.entrypoint_url;

  // Passa outputDir agli Step per la cache
  Step.outputDir = outputDir;

  stepArr = steps.map(
    (s, i) =>
      new Step({
        index: i + 1,
        subPrompt: s.sub_prompt,
        timeout: s.timeout || 10000,
        stepPath: outputDir,
      })
  );

  if (strength === "onlycache") {
    const missingCache = stepArr.filter((step) => !step.cache);

    if (missingCache.length > 0) {
      console.error("\n❌ ERRORE: Cache mancante per i seguenti step:");
      missingCache.forEach((step) => {
        console.error(`   - Step ${step.index}: "${step.subPrompt}"`);
        console.error(`     File atteso: ${outputDir}/step-${step.id}.js`);
      });

      console.error(
        "\n💡 Suggerimento: Esegui prima con --strength medium o --strength high per generare la cache"
      );
      process.exit(1);
    }

    console.log("✅ Cache completa validata\n");
  }

  console.log(`\n Avvio esecuzione`);
  if (stepsPack) {
    console.log(`📦 StepsPack: ${stepsPack}`);
  }
  console.log(`🌐 Entry Point URL: ${url}`);
  console.log(`Step totali: ${stepArr.length}`);
  console.log(`Strength: ${strength}`);
  console.log(`Cache: ${noCache ? "disabilitata" : "abilitata"}`);

  const browser = await chromium.launch({ headless: isHeadless });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const { expect } = await import("@playwright/test");

  const results = [];

  for (const step of stepArr) {
    while (step.attemps > 0 && !step.success) {
      step.logStart();
      await page.waitForLoadState("networkidle");
      const debugPRECHTMLPath =
        "./stepspacks/" + stepsPack + "/generated/debug/pre-clean";
      if (!fs.existsSync(debugPRECHTMLPath)) {
        fs.mkdirSync(debugPRECHTMLPath, { recursive: true });
      }
      fs.writeFileSync(
        debugPRECHTMLPath + "/" + step.index + ".html",
        await page.content()
      );

      const body = cleanHtmlForAI(
        await page.$eval("body", (el) => el.outerHTML),
        removeItems,
        keepItems
      );

      const debugPCHTMLPath =
        "./stepspacks/" + stepsPack + "/generated/debug/post-clean";
      if (!fs.existsSync(debugPCHTMLPath)) {
        fs.mkdirSync(debugPCHTMLPath, { recursive: true });
      }
      fs.writeFileSync(debugPCHTMLPath + "/" + step.index + ".html", body);

      try {
        var code = "";
        if (step.cache && !noCache) {
          try {
            code = getCachedCode(step);
            console.log(`📦 Usando codice dalla cache`);
            step.cache = false; // Marca cache come usata
          } catch (cacheError) {
            //retrieve cache fallita
            if (strength === "onlycache") {
              //check se onlycache se si throw error, errore critico stop esecuz
              console.error(
                `❌ ERRORE CRITICO: Cache mancante per step ${step.index} in modalità onlycache`
              );
              console.error(`   File atteso: ${outputDir}/step-${step.id}.js`);

              results.push({
                index: step.index,
                prompt: step.subPrompt,
                status: "error",
                error: "Cache not found (onlycache mode)",
                critical: true,
              });

              step.attemps = 0;
              step.success = false;
              step.error = cacheError;

              throw new Error(
                `Esecuzione interrotta: cache mancante per step "${step.subPrompt}" in modalità onlycache`
              );
            }

            // FALLBACK: Cache non trovata, genera codice con API
            console.log(`⚠️  Cache non trovata, genero nuovo codice...`);
            step.cache = false;

            const errorMsg =
              step.attemps === 1 && strength == "high" && step.error
                ? step.error.message
                : null;
            const responseObj = await generateAndGetPwCode(
              step.subPrompt,
              page.url(),
              body,
              step.index,
              step.id,
              errorMsg
            );

            code = responseObj.code;
            step.inputToken = responseObj.tokenIn;
            step.outputToken = responseObj.tokenOut;
            step.cachedToken = responseObj.cachedToken;
          }
        } else {
          const errorMsg =
            step.attemps === 1 && strength == "high" && step.error
              ? step.error.message
              : null;
          const responseObj = await generateAndGetPwCode(
            step.subPrompt,
            page.url(),
            body,
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

        if (
          strength === "onlycache" &&
          err.message.includes("Cache file not found")
        ) {
          await browser.close();
          process.exit(1);
        }

        results.push({
          index: step.index,
          prompt: step.subPrompt,
          status: "error",
          error: err.message,
        });
      } finally {
        step.attemps--;
      }
    }
  }

  var usageObj = getTotalUsage(stepArr);
  console.log("\n🏁 Tutte le task completate.");
  console.log(JSON.stringify(usageObj, null, 2));
  await browser.close();

  const resultFile = `${outputDir}/run-logs.json`;

  // Crea l'oggetto per questa esecuzione
  const currentRun = {
    results: results,
    usage: usageObj,
    timestamp: new Date().toISOString(),
    mock_mode: options.mock || false,
    strength: strength,
    cache_enabled: !noCache,
  };

  // Leggi il file esistente se presente
  let existingOutput = {
    stepspack: stepsPack || null,
    runs: [],
  };

  if (fs.existsSync(resultFile)) {
    try {
      const fileContent = fs.readFileSync(resultFile, "utf-8");

      // Verifica che il file non sia vuoto
      if (fileContent.trim()) {
        existingOutput = JSON.parse(fileContent);

        // Assicurati che esista l'array runs (per retrocompatibilità)
        if (!existingOutput.runs) {
          existingOutput.runs = [];
        }

        // Mantieni lo stepspack se esiste
        if (!existingOutput.stepspack) {
          existingOutput.stepspack = stepsPack || null;
        }
      } else {
        console.warn("⚠️ File JSON vuoto, inizializzo nuovo file");
      }
    } catch (error) {
      console.error("❌ Errore nel parsing del JSON esistente:", error.message);
      console.warn("⚠️ Creo un backup e inizializzo nuovo file");

      // Crea un backup del file corrotto
      const backupFile = `${outputDir}/run-logs.backup.${Date.now()}.json`;
      fs.copyFileSync(resultFile, backupFile);
      console.log(`📦 Backup creato: ${backupFile}`);

      // Reinizializza
      existingOutput = {
        stepspack: stepsPack || null,
        runs: [],
      };
    }
  }

  // Aggiungi la nuova esecuzione
  existingOutput.runs.push(currentRun);

  // Scrivi il file aggiornato
  fs.writeFileSync(resultFile, JSON.stringify(existingOutput, null, 2));
  updateAiDrivenSteps();
  console.log(`Log salvato in: ${resultFile}`);
})();
