// /js/propose-topic.js
(function () {
    const LS_KEY = "proposals.v1";

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    // Elements
    const formSection = $("#formSection");
    const addTopicBtn = $("#addTopicBtn");   // FAB ปุ่มลอย
    const cancelBtn = $("#cancelBtn");

    const form = $("#proposalForm");
    const title = $("#title");
    const advisor = $("#advisor");
    const category = $("#category");
    const members = $("#members");
    const description = $("#description");

    // (อาจไม่มีในหน้าเวอร์ชันนี้)
    const listEl = $("#proposalList");
    const emptyState = $("#emptyState");

    const searchInput = $("#searchInput");
    const statusFilter = $("#statusFilter");

    const errTitle = $('[data-error-for="title"]');
    const errAdvisor = $('[data-error-for="advisor"]');
    const errCategory = $('[data-error-for="category"]');

    // กล่องสรุปข้อมูล
    const savedBox = $("#savedData");

    const state = {
        proposals: [],
        editId: null,
        q: "",
        status: ""
    };

    /* ---------- Storage ---------- */
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

    /* ---------- Helpers ---------- */
    const uid = () => Math.random().toString(36).slice(2, 10);

    function showForm() {
        if (!formSection) return;
        formSection.classList.remove("hidden");
        window.scrollTo({ top: formSection.offsetTop - 16, behavior: "smooth" });
        title?.focus();
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
        if (title && !title.value.trim()) {
            if (errTitle) errTitle.textContent = "กรุณากรอกชื่อหัวข้อ";
            ok = false;
        }
        if (advisor && !advisor.value.trim()) {
            if (errAdvisor) errAdvisor.textContent = "กรุณาเลือก/กรอกชื่ออาจารย์ที่ปรึกษา";
            ok = false;
        }
        if (category && !category.value.trim()) {
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
        const map = {
            draft: "badge badge-draft",
            submitted: "badge badge-submitted",
            approved: "badge badge-approved",
            rejected: "badge badge-rejected",
        };
        const text = {
            draft: "แบบร่าง",
            submitted: "ส่งพิจารณา",
            approved: "อนุมัติ",
            rejected: "ไม่อนุมัติ",
        }[status] || status;
        return `<span class="${map[status] || "badge"} badge-inline">${text}</span>`;
    }

    function renderList() {
        // เฉพาะหน้าที่มี list เท่านั้น
        if (!listEl) return;

        const q = state.q.toLowerCase();
        const status = state.status;

        const items = state.proposals
            .filter(p => {
                const hitQ =
                    !q ||
                    p.title.toLowerCase().includes(q) ||
                    p.advisor.toLowerCase().includes(q) ||
                    p.category.toLowerCase().includes(q);
                const hitS = !status || p.status === status;
                return hitQ && hitS;
            })
            .sort((a, b) => b.createdAt - a.createdAt);

        listEl.innerHTML = items
            .map(p => {
                const membersTxt = p.members?.length ? p.members.join(", ") : "-";
                return `
        <div class="proposal-card">
          <div class="proposal-head">
            <h3 class="proposal-title">${p.title}</h3>
            ${toBadge(p.status)}
          </div>
          <div class="proposal-meta">
            <span class="chip">${p.category}</span>
            <span class="sep">•</span>
            <span class="muted">อาจารย์ที่ปรึกษา: ${p.advisor}</span>
          </div>
          <p class="proposal-desc">${p.description || "-"}</p>
          <div class="proposal-members">
            <span class="muted">สมาชิก:</span> ${membersTxt}
          </div>
        </div>`;
            })
            .join("");

        if (emptyState) emptyState.style.display = items.length ? "none" : "block";
    }

    function showSavedSummary(p) {
        if (!savedBox) return;
        const membersTxt = p.members?.length ? p.members.join(", ") : "-";
        savedBox.innerHTML = `
      <h3 class="title">บันทึกหัวข้อเรียบร้อย ${toBadge(p.status)}</h3>
      <div class="kv">
        <div class="k">ชื่อหัวข้อ</div><div class="v">${p.title}</div>
        <div class="k">อาจารย์ที่ปรึกษา</div><div class="v">${p.advisor}</div>
        <div class="k">หมวดหมู่</div><div class="v"><span class="chip">${p.category}</span></div>
        <div class="k">สมาชิก</div><div class="v">${membersTxt}</div>
        <div class="k">คำอธิบาย</div><div class="v">${p.description || "-"}</div>
      </div>
    `;
        savedBox.classList.remove("hidden");
        savedBox.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    /* ---------- Actions ---------- */
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
        renderList();          // ถ้ามี list
        showSavedSummary(saved);

        resetForm();
        hideForm();            // ปิดฟอร์มหลังบันทึก
    }

    /* ---------- Events ---------- */
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
            title: title.value.trim(),
            advisor: advisor.value.trim(),
            category: category.value.trim(),
            members: members.value.split(",").map(s => s.trim()).filter(Boolean),
            description: description.value.trim(),
        };
        upsertProposal(payload);
    });

    searchInput?.addEventListener("input", (e) => {
        state.q = e.target.value || "";
        renderList();
    });
    statusFilter?.addEventListener("change", (e) => {
        state.status = e.target.value || "";
        renderList();
    });

    /* ---------- Init ---------- */
    load();
    renderList();
})();
