/* approve-topic.js — Full-span list with collapsible details + actions */
(function () {
    const LS_PROPOSALS = "proposals.v1";

    // ===== Helpers =====
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const nowISO = () => new Date().toISOString();
    const escapeHTML = (str) =>
        String(str ?? "")
            .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const statusTH = (s) => s === "approved" ? "อนุมัติแล้ว" : s === "rejected" ? "ไม่อนุมัติ" : "รอพิจารณา";

    // ===== Normalizers (โครงข้อมูลจาก propose v1 อาจหลากหลาย) =====
    function normalizeStudents(p) {
        if (Array.isArray(p?.students) && p.students.length) {
            return p.students.map((x, i) => typeof x === "object"
                ? { name: x.name ?? x.fullName ?? x.studentName ?? `Student ${i + 1}`, email: x.email ?? x.mail ?? "", id: x.id ?? x.studentId ?? "" }
                : { name: String(x), email: "", id: "" }
            );
        }
        const memberLike = p?.members ?? p?.memberNames ?? p?.groupMembers ?? p?.group ?? p?.studentList;
        if (memberLike) {
            const arr = Array.isArray(memberLike) ? memberLike : String(memberLike).split(/[,;|\n]+/);
            return arr.map(s => ({ name: String(s).trim(), email: "", id: "" })).filter(x => x.name);
        }
        const single = p?.studentName ?? p?.student ?? p?.leader ?? p?.owner ?? p?.submitter ?? "";
        return single ? [{ name: String(single), email: "", id: "" }] : [];
    }
    function normalizeAdvisor(p) {
        if (p?.advisor && typeof p.advisor === "object") {
            return {
                name: p.advisor.name ?? p.advisor.fullName ?? p.advisorName ?? p.teacherName ?? "",
                email: p.advisor.email ?? p.advisorEmail ?? p.teacherEmail ?? p.email ?? ""
            };
        }
        const name = p?.advisorName ?? p?.advisorFullname ?? p?.teacherName ?? p?.teacher ?? p?.advisor ?? "";
        const email = p?.advisorEmail ?? p?.teacherEmail ?? p?.email ?? "";
        return { name: String(name || ""), email: String(email || "") };
    }

    function loadProposals() {
        try {
            const raw = localStorage.getItem(LS_PROPOSALS);
            const arr = raw ? JSON.parse(raw) : [];
            return arr.map((p, i) => ({
                id: p.id || `prop-${i + 1}`,
                status: p.status || "pending",
                _students: normalizeStudents(p),
                _advisor: normalizeAdvisor(p),
                ...p,
            }));
        } catch (e) {
            console.error("อ่าน proposals.v1 ไม่ได้:", e);
            return [];
        }
    }
    function saveProposals(list) {
        localStorage.setItem(LS_PROPOSALS, JSON.stringify(list));
    }

    // ===== Render (Full-span rows + accordion body) =====
    function studentsLine(p) {
        const list = p._students ?? [];
        if (!list.length) return "—";
        return list.map(s => {
            const name = s.name ? escapeHTML(s.name) : "-";
            const mail = s.email ? ` <${escapeHTML(s.email)}>` : "";
            const sid = s.id ? ` [${escapeHTML(s.id)}]` : "";
            return `${name}${sid}${mail}`;
        }).join(" • ");
    }
    function advisorLine(p) {
        const a = p._advisor || { name: "", email: "" };
        if (!a.name && !a.email) return "—";
        const name = a.name ? escapeHTML(a.name) : "";
        const mail = a.email ? ` <${escapeHTML(a.email)}>` : "";
        return `${name}${mail}`.trim() || "—";
    }

    function renderItem(p) {
        const stClass = p.status === "approved" ? "badge-approved" : p.status === "rejected" ? "badge-rejected" : "badge-pending";
        return `
      <article class="approve-item" data-id="${p.id}">
        <div class="approve-head" role="button" tabindex="0" aria-expanded="false">
          <div class="approve-title">
            <svg class="approve-chevron" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l6 5-6 5" fill="currentColor"/></svg>
            <h3 title="${escapeHTML(p.title || "(ไม่มีชื่อหัวข้อ)")}">${escapeHTML(p.title || "(ไม่มีชื่อหัวข้อ)")}</h3>
          </div>
          <div class="approve-badges">
            <span class="badge ${stClass}">${statusTH(p.status)}</span>
            <span class="badge badge-muted">${p._students?.length || 0} คน</span>
          </div>
        </div>

        <div class="approve-body">
          <p class="muted">${escapeHTML(p.summary || "— ไม่มีคำอธิบาย —")}</p>
          <div class="meta"><span class="muted">นักศึกษา: ${studentsLine(p)}</span></div>
          <div class="meta"><span class="muted">อาจารย์ที่ปรึกษา: ${advisorLine(p)}</span></div>
          ${p.decidedBy ? `<div class="meta"><span class="muted">โดย: ${escapeHTML(p.decidedBy)}${p.decidedAt ? ` (${new Date(p.decidedAt).toLocaleString()})` : ""}</span></div>` : ""}
          <div class="approve-actions">
            <button class="btn btn-approve" data-act="approve">อนุมัติ</button>
            <button class="btn btn-reject"  data-act="reject">ไม่อนุมัติ</button>
            <button class="btn btn-reset"   data-act="reset">รีเซ็ตเป็นรอพิจารณา</button>
          </div>
        </div>
      </article>
    `;
    }

    // ===== State & UI =====
    const grid = $("#proposalRows");
    const searchInput = $("#searchInput");
    const statusFilter = $("#statusFilter");
    const refreshBtn = $("#refreshBtn");
    const teacherNameEl = $("#teacherName");
    const TEACHER_NAME = teacherNameEl?.textContent?.trim() || "Advisor";

    let allProposals = loadProposals();
    let view = [...allProposals];

    function applyFilters() {
        const q = (searchInput?.value || "").toLowerCase().trim();
        const f = statusFilter?.value || "all";
        view = allProposals.filter(p => {
            const matchStatus = f === "all" ? true : (p.status || "pending") === f;
            const hay = [
                p.title, p.summary,
                p._advisor?.name, p._advisor?.email,
                ...(Array.isArray(p._students) ? p._students.map(s => `${s.name || ""} ${s.email || ""} ${s.id || ""}`) : [])
            ].filter(Boolean).join(" ").toLowerCase();
            const matchQuery = q ? hay.includes(q) : true;
            return matchStatus && matchQuery;
        });
        render();
    }

    function render() {
        if (!view.length) {
            grid.innerHTML = `<div class="empty">ยังไม่มีรายการ หรือไม่พบผลลัพธ์ตามเงื่อนไขที่เลือก</div>`;
            return;
        }
        grid.innerHTML = view.map(renderItem).join("");
    }

    function setStatus(id, status) {
        const idx = allProposals.findIndex(p => p.id === id);
        if (idx === -1) return;

        if (status === "reset") {
            allProposals[idx].status = "pending";
            delete allProposals[idx].decidedBy;
            delete allProposals[idx].decidedAt;
        } else {
            allProposals[idx].status = status; // approved | rejected
            allProposals[idx].decidedBy = TEACHER_NAME;
            allProposals[idx].decidedAt = nowISO();
        }
        saveProposals(allProposals);
        allProposals = loadProposals(); // re-normalize
        applyFilters();
        requestAnimationFrame(() => {
            const el = grid.querySelector(`[data-id="${id}"]`);
            el?.classList.add("open");
            el?.querySelector(".approve-head")?.setAttribute("aria-expanded", "true");
            el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
    }

    // ===== Events =====
    grid.addEventListener("click", (e) => {
        const head = e.target.closest(".approve-head");
        if (head) {
            const item = head.closest(".approve-item");
            item.classList.toggle("open");
            head.setAttribute("aria-expanded", item.classList.contains("open") ? "true" : "false");
            return;
        }
        const btn = e.target.closest("button[data-act]");
        if (!btn) return;
        const id = e.target.closest(".approve-item")?.dataset?.id;
        if (!id) return;

        const act = btn.dataset.act;
        if (act === "approve") setStatus(id, "approved");
        if (act === "reject") setStatus(id, "rejected");
        if (act === "reset") setStatus(id, "reset");
    });

    // คีย์บอร์ดเปิด/ปิด
    grid.addEventListener("keydown", (e) => {
        if (e.target.matches(".approve-head") && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            e.target.click();
        }
    });

    searchInput?.addEventListener("input", applyFilters);
    statusFilter?.addEventListener("change", applyFilters);
    refreshBtn?.addEventListener("click", () => {
        allProposals = loadProposals();
        applyFilters();
    });

    // Init
    applyFilters();
})();
