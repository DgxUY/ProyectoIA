const { GoogleGenAI } = require("@google/genai");
const { SYSTEM_INSTRUCTION, CASE_RESPONSE_SCHEMA } = require("./schema");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransient(error) {
  const text = String(error?.message || error);
  return (
    /"code":\s*(429|500|503|504)|UNAVAILABLE|high demand|overloaded/i.test(text) ||
    [429, 500, 503, 504].includes(error?.status)
  );
}

async function generateDiagnostic(contents) {
  const models = MODEL === FALLBACK_MODEL ? [MODEL] : [MODEL, FALLBACK_MODEL];
  const config = {
    thinkingConfig: { thinkingBudget: 1024 },
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: "application/json",
    responseJsonSchema: CASE_RESPONSE_SCHEMA
  };

  let lastError;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await ai.models.generateContent({ model, contents, config });
      } catch (error) {
        lastError = error;
        if (!isTransient(error)) throw error;
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  throw lastError;
}

function mergeCompletedTests(previousTests = [], modelTests = []) {
  const prev = Array.isArray(previousTests) ? previousTests : [];
  const next = Array.isArray(modelTests) ? modelTests : [];

  if (next.length >= prev.length) return next;

  const merged = [...prev];
  for (const item of next) {
    const idx = merged.findIndex(
      (p) => p.test && item.test && p.test.toLowerCase() === item.test.toLowerCase()
    );
    if (idx !== -1) {
      merged[idx] = {
        test: merged[idx].test,
        reading: item.reading || merged[idx].reading,
        conclusion:
          item.conclusion && item.conclusion !== "Evaluando resultado..."
            ? item.conclusion
            : merged[idx].conclusion
      };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

module.exports = {
  isTransient,
  generateDiagnostic,
  mergeCompletedTests
};
