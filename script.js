const CONTACTS_KEY = "outreach_contacts";
const TEMPLATE_KEY = "outreach_template";

const contactForm = document.getElementById("contactForm");
const firstNameInput = document.getElementById("firstName");
const familyNameInput = document.getElementById("familyName");
const phoneNumberInput = document.getElementById("phoneNumber");
const notesInput = document.getElementById("notes");
const familyListEl = document.getElementById("familyList");
const searchInput = document.getElementById("searchInput");
const templateInput = document.getElementById("templateInput");
const saveTemplateBtn = document.getElementById("saveTemplateBtn");
const templateSavedMsg = document.getElementById("templateSavedMsg");

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

function renderList() {
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

  familyListEl.innerHTML = sortedFamilyNames
    .map((familyName) => {
      const members = groups[familyName].sort((a, b) => a.firstName.localeCompare(b.firstName));
      const rows = members
        .map((c) => {
          const template = loadTemplate();
          const message = buildMessage(template, c.firstName, c.familyName);
          const waLink = `https://wa.me/${normalizePhone(c.phoneNumber)}?text=${encodeURIComponent(message)}`;
          return `
            <div class="contact-row">
              <div class="contact-info">
                <span class="contact-name">${escapeHtml(c.firstName)}</span>
                <span class="contact-meta">${escapeHtml(c.phoneNumber)}${c.notes ? " · " + escapeHtml(c.notes) : ""}</span>
              </div>
              <div class="contact-actions">
                <a href="${waLink}" target="_blank" rel="noopener"><button type="button" class="send-btn">Send</button></a>
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

  familyListEl.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const remaining = loadContacts().filter((c) => c.id !== id);
      saveContacts(remaining);
      renderList();
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
  });
  saveContacts(contacts);
  contactForm.reset();
  renderList();
});

searchInput.addEventListener("input", renderList);

saveTemplateBtn.addEventListener("click", () => {
  saveTemplate(templateInput.value);
  templateSavedMsg.textContent = "Saved!";
  setTimeout(() => (templateSavedMsg.textContent = ""), 1500);
});

templateInput.value = loadTemplate();
renderList();
