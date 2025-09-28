/* /js/submit-topic.js */
(function () {
  const LS_PROPOSALS = "proposals.v1";

  // Helpers
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const escapeHTML = (str) => String(str)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const fmtDateTime = ts => ts ? new Date(ts).toLocaleString() : "-";

  const rowsEl = $("#submitRows");
  const searchInput = $("#searchInput");

  const state = { proposals: [], q: "" };

  // Load proposals from propose-topic
  function loadAll() {
    try {
      state.proposals = JSON.parse(localStorage.getItem(LS_PROPOSALS)) || [];
    } catch { state.proposals = []; }
  }

  // Badge
  function toBadge(status) {
    const cls = {
      draft: "badge badge-draft",
      submitted: "badge badge-submitted",
      approved: "badge badge-approved",
      rejected: "badge badge-rejected"
    }[status] || "badge";
    const txt = {
      draft: "แบบร่าง",
      submitted: "ส่งพิจารณา",
      approved: "อนุมัติ",
      rejected: "ไม่อนุมัติ"
    }[status] || status;
    return `<span class="${cls}">${txt}</span>`;
  }

  // Render rows
  function renderRows() {
    if (!rowsEl) return;

    const q = state.q.toLowerCase();
    const items = state.proposals.filter(p => {
      if (!q) return true;
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.advisor || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.status || "").toLowerCase().includes(q)
      );
    }).sort((a, b) => b.updatedAt - a.updatedAt);

    if (items.length === 0) {
      rowsEl.innerHTML = `<p style="color:#64748b;margin:12px 0;">ยังไม่มีหัวข้อโครงงาน</p>`;
      return;
    }

    rowsEl.innerHTML = items.map(p => {
      const count = p.members?.length || 0;
      const membersTxt = count ? p.members.join(", ") : "-";
      return `
        <div class="row-card" data-id="${p.id}">
          <div class="row-head" role="button" tabindex="0" aria-expanded="false">
            <div class="row-title">${escapeHTML(p.title)}</div>
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

    $$("#submitRows .row-head").forEach(head => {
      head.addEventListener("click", () => toggleRow(head));
    });
  }

  function toggleRow(headEl) {
    const card = headEl.closest(".row-card");
    const body = card.querySelector(".row-body");
    const expanded = headEl.getAttribute("aria-expanded") === "true";
    headEl.setAttribute("aria-expanded", expanded ? "false" : "true");
    body.classList.toggle("show", !expanded);
  }

  // Init
  loadAll();
  renderRows();

  searchInput?.addEventListener("input", e => {
    state.q = e.target.value || "";
    renderRows();
  });

  // hide FAB if exists
  const fab = document.getElementById("addSubmitBtn");
  if (fab) fab.style.display = "none";
})();
