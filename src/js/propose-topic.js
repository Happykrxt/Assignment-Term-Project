/* /js/propose-topic.js */
(function () {
    const LS_KEY = "proposals.v1";

    // ===== Helpers =====
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const uid = () => Math.random().toString(36).slice(2, 10);
    const fmtDateTime = (ts) => new Date(ts).toLocaleString();
    const escapeHTML = (str) => String(str)
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    // ===== Elements =====
    const formSection = $("#formSection");
    const addBtn = $("#addTopicBtn");
    const form = $("#proposalForm");
    const titleEl = $("#title");
    const advisorEl = $("#advisor");
    const categoryEl = $("#category");
    const membersEl = $("#members");
    const descEl = $("#description");
    const cancelBtn = $("#cancelBtn");
    const rowsEl = $("#proposalRows");

    const errTitle = $('[data-error-for="title"]');
    const errAdvisor = $('[data-error-for="advisor"]');
    const errCategory = $('[data-error-for="category"]');

    // ===== State =====
    const state = { proposals: [], editId: null };

    // ===== Storage =====
    function load() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            state.proposals = raw ? JSON.parse(raw) : [];
        } catch { state.proposals = []; }
    }
    function save() {
        localStorage.setItem(LS_KEY, JSON.stringify(state.proposals));
    }

    // ===== Status =====
    function toBadge(status) {
        const cls = {
            draft: "badge badge-draft",
            submitted: "badge badge-submitted",
            approved: "badge badge-approved",
            rejected: "badge badge-rejected",
        }[status] || "badge";
        const txt = {
            draft: "แบบร่าง",
            submitted: "ส่งพิจารณา",
            approved: "อนุมัติ",
            rejected: "ไม่อนุมัติ",
        }[status] || status;
        return `<span class="${cls}">${txt}</span>`;
    }
    function canSend(p) { return p.status === "draft"; }
    function sendForReview(id) {
        const idx = state.proposals.findIndex(p => p.id === id);
        if (idx < 0) return;
        const p = state.proposals[idx];
        if (!canSend(p)) return;
        state.proposals[idx] = { ...p, status: "submitted", updatedAt: Date.now() };
        save();
        renderRows();
        focusRowById(id);
    }

    // ===== Form handling =====
    function showForm() {
        formSection.classList.remove("hidden");
        const top = formSection.getBoundingClientRect().top + window.scrollY - 12;
        window.scrollTo({ top, behavior: "smooth" });
        titleEl?.focus();
    }
    function hideForm() { formSection.classList.add("hidden"); }
    function clearErrors() {
        errTitle.textContent = ""; errAdvisor.textContent = ""; errCategory.textContent = "";
    }
    function validate() {
        clearErrors();
        let ok = true;
        if (!titleEl.value.trim()) { errTitle.textContent = "กรุณากรอกชื่อหัวข้อ"; ok = false; }
        if (!advisorEl.value.trim()) { errAdvisor.textContent = "กรุณาเลือกอาจารย์ที่ปรึกษา"; ok = false; }
        if (!categoryEl.value.trim()) { errCategory.textContent = "กรุณาเลือกหมวดหมู่"; ok = false; }
        return ok;
    }

    function upsertProposal(payload) {
        let saved;
        if (state.editId) {
            const idx = state.proposals.findIndex(p => p.id === state.editId);
            if (idx >= 0) {
                state.proposals[idx] = { ...state.proposals[idx], ...payload, updatedAt: Date.now() };
                saved = state.proposals[idx];
            }
        } else {
            saved = { id: uid(), status: "draft", createdAt: Date.now(), updatedAt: Date.now(), ...payload };
            state.proposals.push(saved);
        }
        save();
        renderRows();
        form.reset();
        state.editId = null;
        hideForm();
        if (saved) focusRowById(saved.id);
    }

    // ===== Render rows =====
    function renderRows() {
        if (!rowsEl) return;
        const items = [...state.proposals].sort((a, b) => b.updatedAt - a.updatedAt);
        rowsEl.innerHTML = items.map(p => {
            const count = p.members?.length || 0;
            const membersTxt = count ? p.members.join(", ") : "-";
            const sendBtn = canSend(p)
                ? `<button class="btn-chip btn-send" data-id="${p.id}">ส่งพิจารณา</button>` : "";
            return `
        <div class="row-card" data-id="${p.id}">
          <div class="row-head" role="button" tabindex="0" aria-expanded="false"
               style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;">
            <div class="row-title">${escapeHTML(p.title)}</div>
            <div class="row-right" style="display:flex;align-items:center;gap:8px;">
              <div class="row-left" style="display:flex;align-items:center;gap:8px;">
                ${toBadge(p.status)}
                <span class="count-pill">${count} คน</span>
              </div>
              <div class="row-actions">${sendBtn}</div>
            </div>
          </div>
          <div class="row-body">
            <div class="kv">
              <div class="k">ชื่อหัวข้อ</div><div class="v">${escapeHTML(p.title)}</div>
              <div class="k">อาจารย์ที่ปรึกษา</div><div class="v">${escapeHTML(p.advisor)}</div>
              <div class="k">หมวดหมู่</div><div class="v"><span class="chip">${escapeHTML(p.category)}</span></div>
              <div class="k">สมาชิก</div><div class="v">${escapeHTML(membersTxt)}</div>
              <div class="k">คำอธิบาย</div><div class="v">${p.description ? escapeHTML(p.description) : "-"}</div>
              <div class="k">อัปเดตล่าสุด</div><div class="v">${fmtDateTime(p.updatedAt)}</div>
            </div>
          </div>
        </div>
      `;
        }).join("");

        $$("#proposalRows .btn-send").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                sendForReview(btn.dataset.id);
            });
        });
        $$("#proposalRows .row-head").forEach(head => {
            head.addEventListener("click", e => {
                if (e.target.closest(".row-actions")) return;
                toggleRow(head);
            });
        });
    }

    function toggleRow(headEl) {
        const card = headEl.closest(".row-card");
        const body = card.querySelector(".row-body");
        const expanded = headEl.getAttribute("aria-expanded") === "true";
        headEl.setAttribute("aria-expanded", expanded ? "false" : "true");
        body.classList.toggle("show", !expanded);
    }
    function focusRowById(id) {
        const card = rowsEl?.querySelector(`.row-card[data-id="${CSS.escape(id)}"]`);
        if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "start" });
            card.querySelector(".row-body")?.classList.add("show");
            card.querySelector(".row-head")?.setAttribute("aria-expanded", "true");
        }
    }

    // ===== Events =====
    addBtn?.addEventListener("click", () => {
        form.reset();
        state.editId = null;
        clearErrors();
        showForm();
    });
    cancelBtn?.addEventListener("click", () => {
        form.reset();
        state.editId = null;
        clearErrors();
        hideForm();
    });
    form?.addEventListener("submit", e => {
        e.preventDefault();
        if (!validate()) return;
        const payload = {
            title: titleEl.value.trim(),
            advisor: advisorEl.value.trim(),
            category: categoryEl.value.trim(),
            members: membersEl.value.split(",").map(s => s.trim()).filter(Boolean),
            description: descEl.value.trim(),
        };
        upsertProposal(payload);
    });

    // ===== Init =====
    load(); renderRows();
})();
