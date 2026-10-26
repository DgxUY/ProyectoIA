const STORAGE_KEY = "labdiag_cases_v2";

export function createEmptyCaseState() {
  return {
    status: "en_progreso",
    resolution: "",
    device: {
      type: "Sin registrar",
      model: "Pendiente",
      symptom: "Sin datos"
    },
    hypotheses: [],
    nextTest: null,
    completedTests: []
  };
}

export function normalizeCaseState(raw) {
  const base = createEmptyCaseState();
  if (!raw || typeof raw !== "object") return base;

  return {
    status: raw.status === "resuelto" ? "resuelto" : "en_progreso",
    resolution: typeof raw.resolution === "string" ? raw.resolution : "",
    device: {
      type: raw.device?.type || base.device.type,
      model: raw.device?.model || base.device.model,
      symptom: raw.device?.symptom || base.device.symptom
    },
    hypotheses: Array.isArray(raw.hypotheses) ? raw.hypotheses : [],
    nextTest: raw.nextTest?.title ? raw.nextTest : null,
    completedTests: Array.isArray(raw.completedTests) ? raw.completedTests : []
  };
}

export function createNewCaseObject() {
  return {
    id: `case-${Date.now()}`,
    title: "Nuevo caso",
    messages: [],
    caseState: createEmptyCaseState()
  };
}

export function loadCasesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((c) => ({
        ...c,
        messages: Array.isArray(c.messages) ? c.messages : [],
        caseState: normalizeCaseState(c.caseState)
      }));
    }
  } catch (err) {
    console.warn("No se pudo leer el historial local:", err);
  }
  return [createNewCaseObject()];
}

export function saveCasesToStorage(cases) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.warn("No se pudo guardar en localStorage:", err);
  }
}

