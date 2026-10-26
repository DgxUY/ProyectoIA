const { isTransient, generateDiagnostic, mergeCompletedTests } = require("./gemini");

function buildContents({ history, images, currentCase, message }) {
  const contents = [];

  for (const msg of history) {
    if (msg && typeof msg.text === "string" && msg.text.trim()) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.text }]
      });
    }
  }

  const currentParts = [];

  for (const img of images) {
    if (img?.data && img?.mimeType) {
      currentParts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: String(img.data).replace(/^data:[^;]+;base64,/, "")
        }
      });
    }
  }

  const stepCount = Array.isArray(currentCase?.completedTests)
    ? currentCase.completedTests.length
    : 0;

  const contextHeader = currentCase
    ? `[Estado actual del caso (Pasos completados: ${stepCount} - NO repetir estas pruebas en nextTest): ${JSON.stringify(currentCase)}]\n\n`
    : "";

  const userPrompt =
    message ||
    "Analizá las fotografías adjuntas de la placa, identificá zonas sospechosas y proponé el siguiente paso de prueba.";

  currentParts.push({ text: `${contextHeader}${userPrompt}` });
  contents.push({ role: "user", parts: currentParts });

  return contents;
}

module.exports = async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const images = Array.isArray(req.body?.images) ? req.body.images.slice(0, 4) : [];
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-14) : [];
    const currentCase = req.body?.caseState || null;

    if (!message && images.length === 0) {
      return res.status(400).json({ response: "Ingresá una descripción, medición o fotografía." });
    }

    const contents = buildContents({ history, images, currentCase, message });
    const result = await generateDiagnostic(contents);

    let parsed;
    try {
      parsed = JSON.parse((result.text || "").replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      return res.json({ response: result.text || "El modelo no devolvió contenido." });
    }

    if (parsed.caseState) {
      parsed.caseState.completedTests = mergeCompletedTests(
        currentCase?.completedTests,
        parsed.caseState.completedTests
      );
    }

    res.json({
      response: parsed.reply,
      caseState: parsed.caseState
    });
  } catch (error) {
    console.error("Error en /api/chat:", error);
    const detail = String(error?.message || error).slice(0, 300);
    const busy = isTransient(error);
    res.status(busy ? 503 : 500).json({
      response: busy
        ? "El modelo de IA está saturado en este momento. Probá de nuevo en unos segundos; tu caso no se perdió."
        : `No se pudo procesar el diagnóstico.\n\nDetalle del error: ${detail}`
    });
  }
};
