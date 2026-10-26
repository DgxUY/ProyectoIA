import {
  normalizeCaseState,
  createNewCaseObject,
  loadCasesFromStorage,
  saveCasesToStorage
} from "./storage.js";
import { compressImage } from "./image.js";
import {
  dom,
  renderCaseSelector,
  renderCasePanel,
  renderMessages,
  appendMessageDom,
  renderPendingImages
} from "./ui.js";

let cases = loadCasesFromStorage();
let activeCaseId = cases[0]?.id || null;
let pendingImages = [];
let isSending = false;

function getActiveCase() {
  let found = cases.find((c) => c.id === activeCaseId);
  if (!found) {
    found = createNewCaseObject();
    cases.unshift(found);
    activeCaseId = found.id;
  }
  found.caseState = normalizeCaseState(found.caseState);
  return found;
}

function syncView() {
  const current = getActiveCase();
  renderCaseSelector(cases, activeCaseId);
  renderCasePanel(current);
}

async function sendDiagnosticTurn(text, { advanceCurrentStepWithReading = null } = {}) {
  const cleanText = text.trim();
  const imagesToSend = [...pendingImages];

  if ((!cleanText && imagesToSend.length === 0) || isSending) return;

  isSending = true;
  dom.sendBtn.disabled = true;

  const currentCase = getActiveCase();

  if (advanceCurrentStepWithReading && currentCase.caseState.nextTest?.title) {
    currentCase.caseState.completedTests.push({
      test: currentCase.caseState.nextTest.title,
      reading: advanceCurrentStepWithReading,
      conclusion: "Evaluando resultado..."
    });
    renderCasePanel(currentCase);
  }

  const displayMessage = cleanText || "Fotografía de placa adjunta para inspección.";
  const userMsg = {
    role: "user",
    text: displayMessage,
    photos: imagesToSend.map((i) => i.previewUrl)
  };
  currentCase.messages.push(userMsg);
  appendMessageDom(userMsg);

  dom.messageInput.value = "";
  pendingImages = [];
  renderPendingImages(pendingImages);

  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message assistant";
  loadingDiv.textContent = "Analizando lectura y actualizando pasos...";
  dom.messages.appendChild(loadingDiv);
  dom.messages.scrollTop = dom.messages.scrollHeight;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: cleanText,
        images: imagesToSend.map((i) => ({ mimeType: i.mimeType, data: i.data })),
        history: currentCase.messages.slice(0, -1).map((m) => ({
          role: m.role,
          text: m.text
        })),
        caseState: currentCase.caseState
      })
    });

    const data = await res.json();
    loadingDiv.remove();

    const assistantMsg = {
      role: "assistant",
      text: data.response || "Sin respuesta del servidor."
    };
    currentCase.messages.push(assistantMsg);
    appendMessageDom(assistantMsg);

    if (data.caseState) {
      currentCase.caseState = normalizeCaseState(data.caseState);
      const modelName = currentCase.caseState.device.model;
      if (modelName && modelName !== "Pendiente" && modelName !== "Pendiente de identificar") {
        currentCase.title = `${currentCase.caseState.device.type}: ${modelName}`.slice(0, 50);
      } else if (currentCase.messages.length <= 2 && cleanText) {
        currentCase.title = cleanText.slice(0, 45);
      }
    }

    userMsg.photos = [];
    saveCasesToStorage(cases);
    syncView();
  } catch {
    loadingDiv.remove();
    appendMessageDom({
      role: "assistant",
      text: "No se pudo conectar con el servidor."
    });
  } finally {
    isSending = false;
    dom.sendBtn.disabled = false;
    dom.messageInput.focus();
  }
}

dom.chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendDiagnosticTurn(dom.messageInput.value);
});

dom.stepResultForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const reading = dom.stepReadingInput.value.trim();
  if (!reading) {
    dom.stepReadingInput.focus();
    return;
  }
  const currentCase = getActiveCase();
  const stepNum = currentCase.caseState.completedTests.length + 1;
  const testTitle = currentCase.caseState.nextTest?.title || `Paso ${stepNum}`;
  dom.stepReadingInput.value = "";

  sendDiagnosticTurn(
    `Paso ${stepNum} (${testTitle}): lectura medida = ${reading}. Evaluá este valor, actualizá las hipótesis y dame el Paso ${stepNum + 1}.`,
    { advanceCurrentStepWithReading: reading }
  );
});

dom.stepResultForm.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-outcome]");
  if (!chip) return;
  const outcome = chip.dataset.outcome;
  const currentCase = getActiveCase();
  const stepNum = currentCase.caseState.completedTests.length + 1;
  const testTitle = currentCase.caseState.nextTest?.title || `Paso ${stepNum}`;

  sendDiagnosticTurn(
    `Paso ${stepNum} (${testTitle}): resultado = ${outcome}. Actualizá las hipótesis y pasá al Paso ${stepNum + 1}.`,
    { advanceCurrentStepWithReading: outcome }
  );
});

dom.resolveCaseBtn.addEventListener("click", () => {
  const cs = getActiveCase().caseState;
  if (cs.status === "resuelto") {
    cs.status = "en_progreso";
    saveCasesToStorage(cases);
    syncView();
    return;
  }
  dom.resolveForm.classList.toggle("hidden");
  if (!dom.resolveForm.classList.contains("hidden")) {
    const confirmedHyp = cs.hypotheses.find((h) => h.status === "Confirmada");
    dom.resolveInput.value = cs.resolution || confirmedHyp?.cause || "";
    dom.resolveInput.focus();
  }
});

dom.cancelResolveBtn.addEventListener("click", () => {
  dom.resolveForm.classList.add("hidden");
});

dom.resolveForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const summary = dom.resolveInput.value.trim() || "Falla resuelta en banco.";
  const cs = getActiveCase().caseState;
  cs.status = "resuelto";
  cs.resolution = summary;
  dom.resolveForm.classList.add("hidden");
  saveCasesToStorage(cases);
  syncView();
});

dom.hypothesesList.addEventListener("click", (e) => {
  const confirmBtn = e.target.closest("[data-confirm-hyp]");
  const toggleBtn = e.target.closest("[data-toggle-hyp]");
  const cs = getActiveCase().caseState;

  if (confirmBtn) {
    const idx = Number(confirmBtn.dataset.confirmHyp);
    const target = cs.hypotheses[idx];
    if (!target) return;

    cs.hypotheses.forEach((h, i) => {
      h.status = i === idx ? "Confirmada" : "Descartada";
    });
    cs.status = "resuelto";
    cs.resolution = `Causa confirmada: ${target.cause}`;
    saveCasesToStorage(cases);
    syncView();
    return;
  }

  if (toggleBtn) {
    const idx = Number(toggleBtn.dataset.toggleHyp);
    const target = cs.hypotheses[idx];
    if (!target) return;
    target.status = target.status === "Descartada" ? "Activa" : "Descartada";
    saveCasesToStorage(cases);
    renderCasePanel(getActiveCase());
  }
});

dom.attachBtn.addEventListener("click", () => dom.imageInput.click());

dom.imageInput.addEventListener("change", async () => {
  const files = Array.from(dom.imageInput.files || []).slice(0, 4 - pendingImages.length);
  dom.imageInput.value = "";
  for (const file of files) {
    try {
      const compressed = await compressImage(file);
      pendingImages.push(compressed);
    } catch (err) {
      alert(err.message);
    }
  }
  renderPendingImages(pendingImages);
});

dom.imagePreviews.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove-img]");
  if (!btn) return;
  pendingImages.splice(Number(btn.dataset.removeImg), 1);
  renderPendingImages(pendingImages);
});

dom.messages.addEventListener("click", (e) => {
  const quick = e.target.closest(".quick-case");
  if (quick?.dataset.prompt) {
    sendDiagnosticTurn(quick.dataset.prompt);
  }
});

dom.caseSelect.addEventListener("change", () => {
  activeCaseId = dom.caseSelect.value;
  const current = getActiveCase();
  renderMessages(current);
  renderCasePanel(current);
});

dom.newCaseBtn.addEventListener("click", () => {
  const newCase = createNewCaseObject();
  cases.unshift(newCase);
  activeCaseId = newCase.id;
  saveCasesToStorage(cases);
  syncView();
  renderMessages(newCase);
  dom.messageInput.focus();
});

dom.deleteCaseBtn.addEventListener("click", () => {
  if (cases.length <= 1) {
    cases = [createNewCaseObject()];
  } else {
    cases = cases.filter((c) => c.id !== activeCaseId);
  }
  activeCaseId = cases[0].id;
  saveCasesToStorage(cases);
  const current = getActiveCase();
  syncView();
  renderMessages(current);
});

syncView();
renderMessages(getActiveCase());
