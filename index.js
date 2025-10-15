import "dotenv/config";
import fs from "fs";
import readline from "readline";
import { exec } from "child_process";
import { chromium } from "playwright";
import OpenAI from "openai";
//npx playwright test generated/test.generated.js
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL:
    "https://afp-ai-for-test-resource.openai.azure.com/openai/deployments/gpt-4o",
  defaultQuery: {
    "api-version": "2024-12-01-preview",
  },
});

// helper per chiedere input da console in modo "await"
function ask(question) {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
//https://clienteprova2.guru-hrm.it/pages/login.aspx
(async () => {
  const browser = await chromium.launch({ headless: true });

  const userPrompt = await ask("Inserisci cosa vuoi che il test faccia: ");
  const url = await ask("Dammi l'url della pagina di test: ");

  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });

  const html = await page.content();
  await browser.close();

  console.log("Prompt ricevuto:", userPrompt);
  console.log("Invio HTML a GPT per generare codice Playwright...");

  const prompt = `
Sei un assistente che scrive SOLO codice Playwright per testare una pagina di login.
Genera un test che:
${userPrompt}
La pagina da testare test è ${url}
Type: module
Rispondi SOLO con il codice eseguibile che faccia solamente ed esattamente quello appena detto, senza codice aggiuntivo, senza testo aggiuntivo prima o dopo.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Sei un esperto di test Playwright." },
      { role: "user", content: `${prompt}\n\nHTML:\n${html}` },
    ],
  });

  const code = response.choices[0].message.content
    .replace(/```[a-z]*|```/g, "")
    .trim();
  console.log("code: ", code);

  const filePath = "./generated/manual/test.generated.spec.js";
  if (!fs.existsSync("./manual/generated")) {
    fs.mkdirSync("./manual/generated", { recursive: true });
  }
  fs.writeFileSync(filePath, code);
  console.log("Codice Playwright generato in:", filePath);

  console.log("Esecuzione test generato...");
  /*
  exec(`npx playwright test ${filePath}`, (err, stdout, stderr) => {
    if (err) console.error("Errore:", stderr);
    else console.log(stdout);
  });
  */
})();
