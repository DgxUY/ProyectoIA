import { normalizeCaseState } from "./storage.js";

export const dom = {
  messages: document.getElementById("messages"),
  welcomeHtml: document.getElementById("welcome").outerHTML,
  chatForm: document.getElementById("chat-form"),
  messageInput: document.getElementById("message-input"),
  sendBtn: document.getElementById("send-btn"),
  imageInput: document.getElementById("image-input"),
  attachBtn: document.getElementById("attach-btn"),
  imagePreviews: document.getElementById("image-previews"),

  caseSelect: document.getElementById("case-select"),
  newCaseBtn: document.getElementById("new-case-btn"),
  deleteCaseBtn: document.getElementById("delete-case-btn"),

  deviceTypeBadge: document.getElementById("device-type-badge"),
  caseStatusBadge: document.getElementById("case-status-badge"),
  resolveCaseBtn: document.getElementById("resolve-case-btn"),
  deviceModel: document.getElementById("device-model"),
  deviceSymptom: document.getElementById("device-symptom"),
  resolutionBanner: document.getElementById("resolution-banner"),
  resolutionText: document.getElementById("resolution-text"),
  resolveForm: document.getElementById("resolve-form"),
  resolveInput: document.getElementById("resolve-input"),
  cancelResolveBtn: document.getElementById("cancel-resolve-btn"),

  stepProgressBadge: document.getElementById("step-progress-badge"),
  completedStepsList: document.getElementById("completed-steps-list"),
  activeStepBox: document.getElementById("active-step-box"),
  stepResultForm: document.getElementById("step-result-form"),
  stepReadingInput: document.getElementById("step-reading-input"),

  hypothesesCount: document.getElementById("hypotheses-count"),
  hypothesesList: document.getElementById("hypotheses-list")
};

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatMarkdown(text) {
  const lines = escapeHtml(text).split("\n");
  let html = "";
  let listTag = null;

  const formatInline = (s) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const closeList = () => {
    if (listTag) {
      html += `</${listTag}>`;
      listTag = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);

    if (heading) {
      closeList();
      html += `<h3>${formatInline(heading[1])}</h3>`;
    } else if (bullet || numbered) {
      const tag = numbered ? "ol" : "ul";
      if (listTag !== tag) {
        closeList();
        html += `<${tag}>`;
        listTag = tag;
      }
      html += `<li>${formatInline((numbered || bullet)[1])}</li>`;
    } else {
      closeList();
      html += `<p>${formatInline(line)}</p>`;
    }
  }

  closeList();
  return html;
}

export function renderCaseSelector(cases, activeCaseId) {
  dom.caseSelect.innerHTML = cases
    .map((c) => {
      const stateTag = c.caseState?.status === "resuelto" ? "[Resuelto] " : "";
      return `<option value="${escapeHtml(c.id)}" ${c.id === activeCaseId ? "selected" : ""}>
        ${stateTag}${escapeHtml(c.title)}
      </option>`;
    })
    .join("");
}

export function renderCasePanel(activeCase) {
  const cs = normalizeCaseState(activeCase.caseState);
  const isResolved = cs.status === "resuelto";

  dom.deviceTypeBadge.textContent = cs.device.type;
  dom.deviceModel.textContent = cs.device.model;
  dom.deviceSymptom.textContent = cs.device.symptom;

  if (isResolved) {
    dom.caseStatusBadge.textContent = "Resuelto";
    dom.caseStatusBadge.className = "badge badge-resolved";
    dom.resolveCaseBtn.textContent = "Reabrir caso";
    dom.resolutionBanner.classList.remove("hidden");
    dom.resolutionText.textContent = cs.resolution || "Falla confirmada y cerrada.";
    dom.resolveForm.classList.add("hidden");
  } else {
    dom.caseStatusBadge.textContent = "En curso";
    dom.caseStatusBadge.className = "badge badge-accent";
    dom.resolveCaseBtn.textContent = "Marcar resuelto";
    dom.resolutionBanner.classList.add("hidden");
  }

  const completed = cs.completedTests;
  const currentStepNumber = completed.length + 1;

  dom.completedStepsList.innerHTML = completed
    .map(
      (t, idx) => `
      <li class="step-done-item">
        <div class="step-done-top">
          <span class="step-num-done">Paso ${idx + 1}: ${escapeHtml(t.test)}</span>
          <span class="test-reading">${escapeHtml(t.reading)}</span>
        </div>
        <div class="hyp-evidence">${escapeHtml(t.conclusion)}</div>
      </li>`
    )
    .join("");

  if (isResolved) {
    dom.stepProgressBadge.textContent = `${completed.length} pasos`;
    dom.activeStepBox.innerHTML = `<p class="empty-hint">Diagnóstico cerrado. Usá "Reabrir caso" si necesitás registrar más pruebas.</p>`;
    dom.stepResultForm.classList.add("hidden");
  } else if (cs.nextTest) {
    dom.stepProgressBadge.textContent = `Paso ${currentStepNumber}`;
    dom.activeStepBox.innerHTML = `
      <div class="active-step-header">
        <span class="active-step-label">Paso ${currentStepNumber} en curso</span>
        <span class="badge badge-accent">${escapeHtml(cs.nextTest.instrumentMode || "Multímetro")}</span>
      </div>
      <div class="next-test-title">${escapeHtml(cs.nextTest.title)}</div>
      <p><strong>Procedimiento:</strong> ${escapeHtml(cs.nextTest.procedure)}</p>
      <p><strong>Referencia:</strong> ${escapeHtml(cs.nextTest.expectedValue)}</p>
    `;
    dom.stepResultForm.classList.remove("hidden");
  } else {
    dom.stepProgressBadge.textContent = "Paso 1";
    dom.activeStepBox.innerHTML = `<p class="empty-hint">Describí la falla en el chat para generar el Paso 1.</p>`;
    dom.stepResultForm.classList.add("hidden");
  }

  const hypotheses = cs.hypotheses;
  dom.hypothesesCount.textContent = String(hypotheses.length);

  if (hypotheses.length === 0) {
    dom.hypothesesList.innerHTML = `<li class="empty-hint">Sin hipótesis cargadas todavía.</li>`;
    return;
  }

  dom.hypothesesList.innerHTML = hypotheses
    .map(
      (h, idx) => `
      <li class="hypothesis-item status-${escapeHtml(h.status)}">
        <div class="hyp-top">
          <span class="hyp-cause">${escapeHtml(h.cause)}</span>
          <div class="hyp-badges">
            <span class="badge prob-${escapeHtml(h.probability)}">${escapeHtml(h.probability)}</span>
            <span class="badge">${escapeHtml(h.status)}</span>
          </div>
        </div>
        <div class="hyp-evidence">${escapeHtml(h.evidence)}</div>
        <div class="hyp-actions">
          ${
            h.status !== "Confirmada"
              ? `<button type="button" class="hyp-btn confirm" data-confirm-hyp="${idx}">Confirmar causa</button>`
              : ""
          }
          <button type="button" class="hyp-btn discard" data-toggle-hyp="${idx}">
            ${h.status === "Descartada" ? "Reactivar" : "Descartar"}
          </button>
        </div>
      </li>`
    )
    .join("");
}

export function appendMessageDom(msg) {
  const welcome = dom.messages.querySelector("#welcome");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.className = `message ${msg.role}`;

  if (msg.role === "user") {
    const photosHtml =
      Array.isArray(msg.photos) && msg.photos.length > 0
        ? `<div class="msg-photos">${msg.photos
            .map((src) => `<img src="${src}" alt="Fotografía de placa">`)
            .join("")}</div>`
        : "";
    div.innerHTML = `${photosHtml}<div>${escapeHtml(msg.text)}</div>`;
  } else {
    div.innerHTML = formatMarkdown(msg.text);
  }

  dom.messages.appendChild(div);
  dom.messages.scrollTop = dom.messages.scrollHeight;
}

export function renderMessages(activeCase) {
  if (activeCase.messages.length === 0) {
    dom.messages.innerHTML = dom.welcomeHtml;
    return;
  }

  dom.messages.innerHTML = "";
  for (const msg of activeCase.messages) {
    appendMessageDom(msg);
  }
}

export function renderPendingImages(pendingImages) {
  if (pendingImages.length === 0) {
    dom.imagePreviews.classList.add("hidden");
    dom.imagePreviews.innerHTML = "";
    return;
  }

  dom.imagePreviews.classList.remove("hidden");
  dom.imagePreviews.innerHTML = pendingImages
    .map(
      (img, idx) => `
      <div class="preview-item">
        <img src="${img.previewUrl}" alt="${escapeHtml(img.name)}">
        <button type="button" data-remove-img="${idx}" title="Quitar">x</button>
      </div>`
    )
    .join("");
}

