const CONTACTS_KEY = "outreach_contacts";
const TEMPLATE_KEY = "outreach_template";
const SAVED_MESSAGES_KEY = "outreach_saved_messages";
const PARAGRAPHS_KEY = "outreach_paragraphs";

const contactForm = document.getElementById("contactForm");
const firstNameInput = document.getElementById("firstName");
const familyNameInput = document.getElementById("familyName");
const phoneNumberInput = document.getElementById("phoneNumber");
const notesInput = document.getElementById("notes");
const preferencesInput = document.getElementById("preferences");
const formMessagePreview = document.getElementById("formMessagePreview");
const savedMessageSelect = document.getElementById("savedMessageSelect");
const savedMessageForm = document.getElementById("savedMessageForm");
const savedMessageFamily = document.getElementById("savedMessageFamily");
const savedMessageName = document.getElementById("savedMessageName");
const savedMessageText = document.getElementById("savedMessageText");
const savedMessageList = document.getElementById("savedMessageList");
const paragraphForm = document.getElementById("paragraphForm");
const paragraphEditId = document.getElementById("paragraphEditId");
const paragraphLabel = document.getElementById("paragraphLabel");
const paragraphText = document.getElementById("paragraphText");
const paragraphList = document.getElementById("paragraphList");
const paragraphSubmitBtn = document.getElementById("paragraphSubmitBtn");
const paragraphCancelBtn = document.getElementById("paragraphCancelBtn");
const paragraphCheckboxes = document.getElementById("paragraphCheckboxes");
const familyListEl = document.getElementById("familyList");
const responseListEl = document.getElementById("responseList");
const searchInput = document.getElementById("searchInput");
const templateInput = document.getElementById("templateInput");
const saveTemplateBtn = document.getElementById("saveTemplateBtn");
const templateSavedMsg = document.getElementById("templateSavedMsg");

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  ghosted: "Ghosted",
};

function loadContacts() {
  const raw = localStorage.getItem(CONTACTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveContacts(contacts) {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

function loadTemplate() {
  return localStorage.getItem(TEMPLATE_KEY) || templateInput.value;
}

function saveTemplate(text) {
  localStorage.setItem(TEMPLATE_KEY, text);
}

function loadSavedMessages() {
  const raw = localStorage.getItem(SAVED_MESSAGES_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveSavedMessages(messages) {
  localStorage.setItem(SAVED_MESSAGES_KEY, JSON.stringify(messages));
}

function loadParagraphs() {
  const raw = localStorage.getItem(PARAGRAPHS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveParagraphs(paragraphs) {
  localStorage.setItem(PARAGRAPHS_KEY, JSON.stringify(paragraphs));
}

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function buildMessage(template, firstName, familyName) {
  return template.replace(/{name}/gi, firstName).replace(/{family}/gi, familyName);
}

function buildFullMessage(template, firstName, familyName, paragraphIds) {
  const greeting = buildMessage(template, firstName, familyName);
  const allParagraphs = loadParagraphs();
  const paragraphTexts = (paragraphIds || [])
    .map((id) => allParagraphs.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => buildMessage(p.text, firstName, familyName));
  return [greeting, ...paragraphTexts].join("\n\n");
}

function updateContact(id, changes) {
  const contacts = loadContacts();
  const next = contacts.map((c) => (c.id === id ? { ...c, ...changes } : c));
  saveContacts(next);
  renderAll();
}

function setStatus(id, status) {
  if (status === "rejected") {
    const reason = window.prompt("Why did they reject? (this will be saved for future matching)") || "";
    updateContact(id, { status, rejectReason: reason });
  } else {
    updateContact(id, { status, rejectReason: "" });
  }
}

function renderAll() {
  renderFamilyList();
  renderResponseList();
  renderSavedMessages();
  renderParagraphs();
}

function statusControls(c) {
  if (c.status === "pending" || !c.status) {
    return `
      <div class="status-actions">
        <button type="button" class="status-btn accept-btn" data-id="${c.id}" data-status="accepted">Accept</button>
        <button type="button" class="status-btn reject-btn" data-id="${c.id}" data-status="rejected">Reject</button>
        <button type="button" class="status-btn ghost-btn" data-id="${c.id}" data-status="ghosted">Ghosted</button>
      </div>
    `;
  }
  return `
    <div class="status-actions">
      <span class="status-badge status-${c.status}">${STATUS_LABELS[c.status]}</span>
      <button type="button" class="status-btn reset-btn" data-id="${c.id}" data-status="pending">Reset</button>
    </div>
  `;
}

function renderFamilyList() {
  const contacts = loadContacts();
  const query = searchInput.value.trim().toLowerCase();

  const filtered = contacts.filter((c) => {
    if (!query) return true;
    return (
      c.firstName.toLowerCase().includes(query) ||
      c.familyName.toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    familyListEl.innerHTML = '<p class="empty-state">No contacts yet. Add one above.</p>';
    return;
  }

  const groups = {};
  filtered.forEach((c) => {
    if (!groups[c.familyName]) groups[c.familyName] = [];
    groups[c.familyName].push(c);
  });

  const sortedFamilyNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));
  const defaultTemplate = loadTemplate();

  familyListEl.innerHTML = sortedFamilyNames
    .map((familyName) => {
      const members = groups[familyName].sort((a, b) => a.firstName.localeCompare(b.firstName));
      const rows = members
        .map((c) => {
          const template = c.customTemplate || defaultTemplate;
          const message = buildFullMessage(template, c.firstName, c.familyName, c.paragraphIds);
          const waLink = `https://wa.me/${normalizePhone(c.phoneNumber)}?text=${encodeURIComponent(message)}`;
          return `
            <div class="contact-row">
              <div class="contact-info">
                <span class="contact-name">${escapeHtml(c.firstName)}</span>
                <span class="contact-meta">${escapeHtml(c.phoneNumber)}${c.notes ? " · " + escapeHtml(c.notes) : ""}${c.customMessageLabel ? " · using \"" + escapeHtml(c.customMessageLabel) + "\"" : ""}</span>
                <p class="message-preview">${escapeHtml(message)}</p>
              </div>
              <div class="contact-actions">
                <a href="${waLink}" target="_blank" rel="noopener"><button type="button" class="send-btn">Send</button></a>
                ${statusControls(c)}
                <button type="button" class="delete-btn" data-id="${c.id}">Delete</button>
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <div class="family-group">
          <div class="family-group-header">
            <span>${escapeHtml(familyName)} Family</span>
            <span class="family-group-count">${members.length} contact${members.length > 1 ? "s" : ""}</span>
          </div>
          ${rows}
        </div>
      `;
    })
    .join("");

  attachRowListeners(familyListEl);
}

function renderResponseList() {
  const contacts = loadContacts().filter((c) => c.status && c.status !== "pending");

  if (contacts.length === 0) {
    responseListEl.innerHTML = '<p class="empty-state">No responses recorded yet.</p>';
    return;
  }

  const sorted = contacts.slice().sort((a, b) => a.firstName.localeCompare(b.firstName));

  responseListEl.innerHTML = sorted
    .map((c) => {
      return `
        <div class="contact-row response-row">
          <div class="contact-info">
            <span class="contact-name">${escapeHtml(c.firstName)} <span class="contact-meta">(${escapeHtml(c.familyName)} family)</span></span>
            <span class="status-badge status-${c.status}">${STATUS_LABELS[c.status]}</span>
            ${c.status === "rejected" && c.rejectReason ? `<p class="reject-reason">Reason: ${escapeHtml(c.rejectReason)}</p>` : ""}
            ${c.preferences ? `<p class="preferences-text">Preferences: ${escapeHtml(c.preferences)}</p>` : ""}
          </div>
          <div class="contact-actions">
            <button type="button" class="status-btn reset-btn" data-id="${c.id}" data-status="pending">Reset</button>
          </div>
        </div>
      `;
    })
    .join("");

  attachRowListeners(responseListEl);
}

function renderSavedMessages() {
  const messages = loadSavedMessages();

  if (messages.length === 0) {
    savedMessageList.innerHTML = '<p class="empty-state">No saved messages yet.</p>';
  } else {
    const groups = {};
    messages.forEach((m) => {
      if (!groups[m.familyName]) groups[m.familyName] = [];
      groups[m.familyName].push(m);
    });
    const sortedFamilyNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));

    savedMessageList.innerHTML = sortedFamilyNames
      .map((familyName) => {
        const rows = groups[familyName]
          .map((m) => `
            <div class="contact-row">
              <div class="contact-info">
                <span class="contact-name">${escapeHtml(m.name)}</span>
                <p class="message-preview">${escapeHtml(m.text)}</p>
              </div>
              <div class="contact-actions">
                <button type="button" class="delete-btn" data-saved-id="${m.id}">Delete</button>
              </div>
            </div>
          `)
          .join("");
        return `
          <div class="family-group">
            <div class="family-group-header">
              <span>${escapeHtml(familyName)} Family</span>
              <span class="family-group-count">${groups[familyName].length} saved</span>
            </div>
            ${rows}
          </div>
        `;
      })
      .join("");

    savedMessageList.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-saved-id");
        saveSavedMessages(loadSavedMessages().filter((m) => m.id !== id));
        renderSavedMessages();
        populateSavedMessageSelect();
      });
    });
  }

  populateSavedMessageSelect();
}

function populateSavedMessageSelect() {
  const familyName = familyNameInput.value.trim().toLowerCase();
  const messages = loadSavedMessages().filter(
    (m) => !familyName || m.familyName.toLowerCase() === familyName
  );

  const previousValue = savedMessageSelect.value;
  savedMessageSelect.innerHTML =
    '<option value="">Default template</option>' +
    messages.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join("");

  if (messages.some((m) => m.id === previousValue)) {
    savedMessageSelect.value = previousValue;
  }
}

function renderParagraphs() {
  const paragraphs = loadParagraphs();

  if (paragraphs.length === 0) {
    paragraphList.innerHTML = '<p class="empty-state">No standard paragraphs yet.</p>';
  } else {
    paragraphList.innerHTML = paragraphs
      .map(
        (p) => `
          <div class="contact-row">
            <div class="contact-info">
              <span class="contact-name">${escapeHtml(p.label)}</span>
              <p class="message-preview">${escapeHtml(p.text)}</p>
            </div>
            <div class="contact-actions">
              <button type="button" class="status-btn edit-btn" data-edit-id="${p.id}">Edit</button>
              <button type="button" class="delete-btn" data-paragraph-id="${p.id}">Delete</button>
            </div>
          </div>
        `
      )
      .join("");

    paragraphList.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = loadParagraphs().find((x) => x.id === btn.getAttribute("data-edit-id"));
        if (!p) return;
        paragraphEditId.value = p.id;
        paragraphLabel.value = p.label;
        paragraphText.value = p.text;
        paragraphSubmitBtn.textContent = "Update Paragraph";
        paragraphCancelBtn.style.display = "inline-block";
      });
    });

    paragraphList.querySelectorAll(".delete-btn[data-paragraph-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-paragraph-id");
        saveParagraphs(loadParagraphs().filter((p) => p.id !== id));
        renderParagraphs();
        renderAll();
      });
    });
  }

  renderParagraphCheckboxes();
}

function renderParagraphCheckboxes() {
  const paragraphs = loadParagraphs();
  const previouslyChecked = new Set(
    Array.from(paragraphCheckboxes.querySelectorAll("input:checked")).map((el) => el.value)
  );

  if (paragraphs.length === 0) {
    paragraphCheckboxes.innerHTML = '<span class="hint">No standard paragraphs yet.</span>';
    return;
  }

  paragraphCheckboxes.innerHTML = paragraphs
    .map(
      (p) => `
        <label>
          <input type="checkbox" value="${p.id}" ${previouslyChecked.has(p.id) ? "checked" : ""}>
          ${escapeHtml(p.label)}
        </label>
      `
    )
    .join("");

  paragraphCheckboxes.querySelectorAll("input[type=checkbox]").forEach((el) => {
    el.addEventListener("change", updateFormPreview);
  });
}

function getCheckedParagraphIds() {
  return Array.from(paragraphCheckboxes.querySelectorAll("input:checked")).map((el) => el.value);
}

function attachRowListeners(container) {
  container.querySelectorAll(".status-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setStatus(btn.getAttribute("data-id"), btn.getAttribute("data-status"));
    });
  });
  container.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const remaining = loadContacts().filter((c) => c.id !== id);
      saveContacts(remaining);
      renderAll();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function selectedSavedMessage() {
  const id = savedMessageSelect.value;
  if (!id) return null;
  return loadSavedMessages().find((m) => m.id === id) || null;
}

function updateFormPreview() {
  const saved = selectedSavedMessage();
  const template = saved ? saved.text : loadTemplate();
  const firstName = firstNameInput.value.trim() || "[name]";
  const familyName = familyNameInput.value.trim() || "[family]";
  formMessagePreview.textContent = buildFullMessage(template, firstName, familyName, getCheckedParagraphIds());
}

contactForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const saved = selectedSavedMessage();
  const contacts = loadContacts();
  contacts.push({
    id: crypto.randomUUID(),
    firstName: firstNameInput.value.trim(),
    familyName: familyNameInput.value.trim(),
    phoneNumber: phoneNumberInput.value.trim(),
    notes: notesInput.value.trim(),
    preferences: preferencesInput.value.trim(),
    status: "pending",
    rejectReason: "",
    customTemplate: saved ? saved.text : "",
    customMessageLabel: saved ? saved.name : "",
    paragraphIds: getCheckedParagraphIds(),
  });
  saveContacts(contacts);
  contactForm.reset();
  renderAll();
  updateFormPreview();
});

firstNameInput.addEventListener("input", updateFormPreview);
familyNameInput.addEventListener("input", () => {
  populateSavedMessageSelect();
  updateFormPreview();
});
savedMessageSelect.addEventListener("change", updateFormPreview);

savedMessageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const messages = loadSavedMessages();
  messages.push({
    id: crypto.randomUUID(),
    familyName: savedMessageFamily.value.trim(),
    name: savedMessageName.value.trim(),
    text: savedMessageText.value.trim(),
  });
  saveSavedMessages(messages);
  savedMessageForm.reset();
  renderSavedMessages();
  updateFormPreview();
});

function resetParagraphForm() {
  paragraphEditId.value = "";
  paragraphForm.reset();
  paragraphSubmitBtn.textContent = "Save Paragraph";
  paragraphCancelBtn.style.display = "none";
}

paragraphForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const editId = paragraphEditId.value;
  const paragraphs = loadParagraphs();
  if (editId) {
    const next = paragraphs.map((p) =>
      p.id === editId ? { ...p, label: paragraphLabel.value.trim(), text: paragraphText.value.trim() } : p
    );
    saveParagraphs(next);
  } else {
    paragraphs.push({
      id: crypto.randomUUID(),
      label: paragraphLabel.value.trim(),
      text: paragraphText.value.trim(),
    });
    saveParagraphs(paragraphs);
  }
  resetParagraphForm();
  renderParagraphs();
  renderAll();
  updateFormPreview();
});

paragraphCancelBtn.addEventListener("click", resetParagraphForm);

searchInput.addEventListener("input", renderFamilyList);

saveTemplateBtn.addEventListener("click", () => {
  saveTemplate(templateInput.value);
  templateSavedMsg.textContent = "Saved!";
  setTimeout(() => (templateSavedMsg.textContent = ""), 1500);
  renderFamilyList();
  updateFormPreview();
});

templateInput.value = loadTemplate();
templateInput.addEventListener("input", () => {
  renderFamilyList();
  updateFormPreview();
});
renderAll();
updateFormPreview();
