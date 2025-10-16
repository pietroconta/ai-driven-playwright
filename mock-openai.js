// mock-openai.js
// Simula le risposte di OpenAI per il debugging senza costi

export class MockOpenAI {
  constructor(config) {
    this.config = config;
    console.log("🔧 MockOpenAI inizializzato - Nessuna chiamata API reale");
  }

  chat = {
    completions: {
      create: async (params) => {
        console.log("🔧 MOCK MODE - Generazione codice simulata");
        
        // Estrae il prompt dall'ultimo messaggio
        const userMessage = params.messages.find(m => m.role === "user");
        const prompt = userMessage?.content || "";
        
        // Genera codice di esempio basato sul prompt
        let mockCode = this.generateMockCode(prompt);
        
        // Simula ritardo API (opzionale, per realismo)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Simula una risposta con statistiche realistiche
        return {
          choices: [{
            message: {
              content: `\`\`\`javascript\n${mockCode}\n\`\`\``
            }
          }],
          usage: {
            prompt_tokens: Math.floor(Math.random() * 500) + 100,
            completion_tokens: Math.floor(Math.random() * 150) + 50,
            prompt_tokens_details: {
              cached_tokens: Math.floor(Math.random() * 200)
            }
          }
        };
      }
    }
  };

  generateMockCode(prompt) {
    return `await expect(page.locator('#btnLoginHrCore')).toBeVisible();
await page.click('#btnLoginHrCore');`;
  }
}