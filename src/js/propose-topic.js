/* /js/propose-topic.js */
(function () {
    const LS_KEY = "proposals.v1";

    // ===== Shortcuts =====
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    // ===== Elements =====
    const formSection = $("#formSection");
    const addTopicBtn = $("#addTopicBtn");        // FAB
    const form = $("#proposalForm");
    const titleEl = $("#title");
    const advisorEl = $("#advisor");
    const categoryEl = $("#category");
    const membersEl = $("#members");
    const descEl = $("#description");
    const cancelBtn = $("#cancelBtn");

    const errTitle = $('[data-error-for="title"]');
    const errAdvisor = $('[data-error-for="advisor"]');
    const errCategory = $('[data-error-for="category"]');

    // พื้นที่แสดงแถวแบบตาราง
    const rowsEl = $("#proposalRows");       // <div id="proposalRows" class="rows">
    // (หากหน้าเก่ายังมี list เดิมอยู่ โค้ดก็จะไม่พัง เพราะเราไม่ได้อ้างถึงมัน)

    // ===== State =====
    const state = {
        proposals: [],
        editId: null,     // ถ้าไม่ null = กำลังแก้ไข
    };

    // ===== Storage =====
    function load() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            state.proposals = raw ? JSON.parse(raw) : [];
        } catch {
            state.proposals = [];
        }
    }
    function save() {
        localStorage.setItem(LS_KEY, JSON.stringify(state.proposals));
    }

    // ===== Utils =====
    const uid = () => Math.random().toString(36).slice(2, 10);
    const fmtDateTime = (ts) => {
        try {
            return new Date(ts).toLocaleString();
        } catch {
            return "-";
        }
    };

    function showForm() {
        if (!formSection) return;
        formSection.classList.remove("hidden");
        // เลื่อนมาให้เห็นฟอร์มชัด ๆ
        const top = formSection.getBoundingClientRect().top + window.scrollY - 12;
        window.scrollTo({ top, behavior: "smooth" });
        titleEl?.focus();
    }
    function hideForm() {
        formSection?.classList.add("hidden");
    }
    function clearErrors() {
        if (errTitle) errTitle.textContent = "";
        if (errAdvisor) errAdvisor.textContent = "";
        if (errCategory) errCategory.textContent = "";
    }
    function validate() {
        clearErrors();
        let ok = true;
        if (!titleEl?.value.trim()) {
            if (errTitle) errTitle.textContent = "กรุณากรอกชื่อหัวข้อ";
            ok = false;
        }
        if (!advisorEl?.value.trim()) {
            if (errAdvisor) errAdvisor.textContent = "กรุณาเลือกอาจารย์ที่ปรึกษา";
            ok = false;
        }
        if (!categoryEl?.value.trim()) {
            if (errCategory) errCategory.textContent = "กรุณาเลือกหมวดหมู่";
            ok = false;
        }
        return ok;
    }
    function resetForm() {
        form?.reset();
        state.editId = null;
        const saveBtn = $("#saveBtn");
        if (saveBtn) saveBtn.textContent = "บันทึกหัวข้อ";
    }

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

    // ===== Rows rendering (table-like) =====
    function renderRows() {
        if (!rowsEl) return;

        // แสดงล่าสุดไว้บนสุด
        const items = [...state.proposals].sort((a, b) => b.updatedAt - a.updatedAt);

        rowsEl.innerHTML = items.map(p => {
            const count = p.members?.length || 0;
            const membersTxt = count ? p.members.join(", ") : "-";
            return `
        <div class="row-card" data-id="${p.id}">
            <div class="row-head" role="button" tabindex="0" aria-expanded="false">
                <div class="row-title" title="${escapeHTML(p.title)}">${escapeHTML(p.title)}</div>
                <div class="row-left">
                    ${toBadge(p.status)}
                    <span class="count-pill">${count} คน</span>
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

        // Event: expand/collapse
        rowsEl.querySelectorAll(".row-head").forEach(head => {
            head.addEventListener("click", () => toggleRow(head));
            head.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleRow(head);
                }
            });
        });
    }

    function toggleRow(headEl) {
        const card = headEl.closest(".row-card");
        if (!card) return;
        const body = card.querySelector(".row-body");
        const expanded = headEl.getAttribute("aria-expanded") === "true";
        headEl.setAttribute("aria-expanded", expanded ? "false" : "true");
        body.classList.toggle("show", !expanded);
    }

    // หลังบันทึกให้เลื่อน และเปิดรายละเอียดของแถวล่าสุด
    function focusRowById(id) {
        if (!rowsEl) return;
        const card = rowsEl.querySelector(`.row-card[data-id="${CSS.escape(id)}"]`);
        if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "start" });
            const head = card.querySelector(".row-head");
            const body = card.querySelector(".row-body");
            head?.setAttribute("aria-expanded", "true");
            body?.classList.add("show");
        }
    }

    // ===== CRUD =====
    function upsertProposal(payload) {
        let saved;
        if (state.editId) {
            const idx = state.proposals.findIndex(p => p.id === state.editId);
            if (idx >= 0) {
                state.proposals[idx] = {
                    ...state.proposals[idx],
                    ...payload,
                    updatedAt: Date.now(),
                };
                saved = state.proposals[idx];
            }
        } else {
            saved = {
                id: uid(),
                status: "draft",
                createdAt: Date.now(),
                updatedAt: Date.now(),
                ...payload,
            };
            state.proposals.push(saved);
        }
        save();
        renderRows();
        resetForm();
        hideForm();
        if (saved) focusRowById(saved.id);
    }

    // ===== Helpers (security/format) =====
    function escapeHTML(str) {
        return String(str)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // ===== Events =====
    addTopicBtn?.addEventListener("click", () => {
        resetForm();
        clearErrors();
        showForm();
    });

    cancelBtn?.addEventListener("click", () => {
        resetForm();
        clearErrors();
        hideForm();
    });

    form?.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!validate()) return;

        const payload = {
            title: titleEl.value.trim(),
            advisor: advisorEl.value.trim(),
            category: categoryEl.value.trim(),
            members: membersEl.value
                .split(",")
                .map(s => s.trim())
                .filter(Boolean),
            description: descEl.value.trim(),
        };
        upsertProposal(payload);
    });

    // ===== Init =====
    load();
    renderRows();
})();
