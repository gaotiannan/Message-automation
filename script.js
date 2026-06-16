const CONTACTS_KEY = "outreach_contacts";
const TEMPLATE_KEY = "outreach_template";

const contactForm = document.getElementById("contactForm");
const firstNameInput = document.getElementById("firstName");
const familyNameInput = document.getElementById("familyName");
const phoneNumberInput = document.getElementById("phoneNumber");
const notesInput = document.getElementById("notes");
const preferencesInput = document.getElementById("preferences");
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

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function buildMessage(template, firstName, familyName) {
  return template.replace(/{name}/gi, firstName).replace(/{family}/gi, familyName);
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
  const template = loadTemplate();

  familyListEl.innerHTML = sortedFamilyNames
    .map((familyName) => {
      const members = groups[familyName].sort((a, b) => a.firstName.localeCompare(b.firstName));
      const rows = members
        .map((c) => {
          const message = buildMessage(template, c.firstName, c.familyName);
          const waLink = `https://wa.me/${normalizePhone(c.phoneNumber)}?text=${encodeURIComponent(message)}`;
          return `
            <div class="contact-row">
              <div class="contact-info">
                <span class="contact-name">${escapeHtml(c.firstName)}</span>
                <span class="contact-meta">${escapeHtml(c.phoneNumber)}${c.notes ? " · " + escapeHtml(c.notes) : ""}</span>
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

contactForm.addEventListener("submit", (e) => {
  e.preventDefault();
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
  });
  saveContacts(contacts);
  contactForm.reset();
  renderAll();
});

searchInput.addEventListener("input", renderFamilyList);

saveTemplateBtn.addEventListener("click", () => {
  saveTemplate(templateInput.value);
  templateSavedMsg.textContent = "Saved!";
  setTimeout(() => (templateSavedMsg.textContent = ""), 1500);
  renderFamilyList();
});

templateInput.value = loadTemplate();
templateInput.addEventListener("input", renderFamilyList);
renderAll();
