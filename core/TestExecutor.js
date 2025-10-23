// ============================================
// FILE: core/TestExecutor.js
// ============================================
import fs from "fs";
import { JSDOM } from "jsdom";

/**
 * Gestisce l'esecuzione del codice Playwright generato dall'AI
 */
export class TestExecutor {
  constructor(options = {}) {
    this.outputDir = options.outputDir || "./generated/aidriven";
    this.cleaningRules = {
      remove: options.removeItems || ["comments", "script", "style"],
      keep: options.keepItems || [],
    };
  }

  /**
   * Esegue il codice per uno step
   */
  async execute(code, page, expect) {
    try {
      await page.waitForLoadState("networkidle");

      const asyncCode = `
        (async (page, expect) => {
          ${code}
        })
      `;

      const fn = eval(asyncCode);
      await fn(page, expect);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      };
    }
  }

  /**
   * Carica codice dalla cache
   */
  loadCachedCode(stepId) {
    const path = `${this.outputDir}/step-${stepId}.js`;

    if (!fs.existsSync(path)) {
      throw new Error(`Cache file not found: ${path}`);
    }

    return fs.readFileSync(path, "utf8");
  }

  /**
   * Salva codice generato
   */
  saveCachedCode(stepId, code) {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const filePath = `${this.outputDir}/step-${stepId}.js`;
    fs.writeFileSync(filePath, code);

    return filePath;
  }

  /**
   * Estrae e pulisce l'HTML della pagina per l'AI
   */
  async extractCleanHtml(page, debugInfo = null) {
    const rawHtml = await page.$eval("body", (el) => el.outerHTML);

    // Salva HTML pre-pulizia (debug)
    if (debugInfo) {
      this._saveDebugHtml(rawHtml, debugInfo.stepIndex, "pre-clean");
    }

    const cleanedHtml = this._cleanHtml(rawHtml);

    // Salva HTML post-pulizia (debug)
    if (debugInfo) {
      this._saveDebugHtml(cleanedHtml, debugInfo.stepIndex, "post-clean");
    }

    return cleanedHtml;
  }

  /**
   * Pulizia HTML (rimozione elementi non rilevanti)
   */
  _cleanHtml(html) {
    let cleaned = html;
    const { remove, keep } = this.cleaningRules;

    const shouldRemove = (item) =>
      remove.includes("all") || (remove.includes(item) && !keep.includes(item));

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
      cleaned = cleaned.replace(/<img\b[^>]*\s+src=["'][^"']*["']/gi, (match) =>
        match.replace(/\s+src=["'][^"']*["']/, "")
      );
    }

    if (shouldRemove("inlinestyle")) {
      cleaned = cleaned.replace(/\s+style="[^"]*"/gi, "");
    }

    if (shouldRemove("attributes")) {
      cleaned = cleaned.replace(/\s+data-(?!testid)[a-z-]+=["'][^"']*["']/gi, "");
      cleaned = cleaned.replace(/\s+aria-(?!label)[a-z-]+=["'][^"']*["']/gi, "");
    }

    if (shouldRemove("longtext")) {
      cleaned = this._removeLongText(cleaned, 25);
    }

    // Compattazione whitespace
    cleaned = cleaned.replace(/\s+/g, " ");
    cleaned = cleaned.replace(/>\s+</g, "><");

    return cleaned.trim();
  }

  /**
   * Rimuove testi lunghi dall'HTML
   */
  _removeLongText(html, maxLength = 30) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    function cleanNode(node) {
      node.childNodes.forEach((child) => {
        if (child.nodeType === 3 && child.textContent.trim().length > maxLength) {
          child.textContent = "";
        } else if (child.nodeType === 1) {
          cleanNode(child);
        }
      });
    }

    cleanNode(doc.body);
    return doc.body.innerHTML;
  }

  /**
   * Salva HTML per debug
   */
  _saveDebugHtml(html, stepIndex, type) {
    const debugPath = `${this.outputDir}/debug/${type}`;

    if (!fs.existsSync(debugPath)) {
      fs.mkdirSync(debugPath, { recursive: true });
    }

    fs.writeFileSync(`${debugPath}/${stepIndex}.html`, html);
  }
}
