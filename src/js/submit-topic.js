/* /js/submit-topic.js — split preview + calendar + committee + submitted list (with submit status)
 * Updated: 
 *  - ใช้ .submit-rows (class) แทน #submitRows (id) เพื่อ reuse ได้หลายหน้า
 *  - เพิ่ม normalizer สำหรับ proposal fields ให้ทนต่อโครงข้อมูลจาก propose v1 ที่หลากหลาย
 *  - ปรับ robust selectors และป้องกัน null บางจุด
 */
(function () {
  const LS_PROPOSALS = "proposals.v1"; // จากหน้า propose-topic
  const LS_SUBMITS = "submits.v1";    // บันทึกการยื่นสอบ

  // ===== Helpers =====
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const escapeHTML = (str) => String(str ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const fmtDT = ts => ts ? new Date(ts).toLocaleString() : "-";
  const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  function showToast(msg) {
    let t = $("#miniToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "miniToast";
      Object.assign(t.style, {
        position: "fixed", right: "16px", bottom: "16px", background: "#0ea5e9", color: "#fff",
        padding: "10px 14px", borderRadius: "10px", boxShadow: "0 8px 20px rgba(0,0,0,.12)",
        zIndex: 9999, transition: "opacity .25s ease"
      });
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = "1";
    setTimeout(() => t.style.opacity = "0", 1400);
  }

  // ===== Elements (ใช้คลาสแทน id เพื่อ reuse ได้) =====
  // หมายเหตุ: ถ้ามีหลาย .submit-rows ในหน้า ให้เลือกอันแรก (หรือนำโค้ดไป loop ทีหลังได้)
  const rowsEl = $(".submit-rows");
  const submittedListEl = $("#submittedList");
  const searchInput = $("#searchInput");

  let splitEl = $(".split");
  let previewEl = $("#previewPanel");
  let formBoxEl = $("#submitPanel");

  // refs
  let calGridEl, calMonthEl, committeeWrapEl, committeeCounterEl, noteEl, submitBtn, cancelBtn;

  // ===== State =====
  const state = {
    proposals: [],
    submits: [],
    current: null,
    calendar: { viewYear: null, viewMonth: null }, // 0..11
    committee: [],
    selectedDateStr: ""
  };

  const COMMITTEE_POOL = [
    "รศ.ดร.อนิราช มิ่งขวัญ", "ผศ.อรบุษป์ วุฒิกมลชัย", "ผศ.ดร.บีสุดา ดาวเรือง", "ผศ.ดร.ขนิษฐา นามี",
    "อ.ดร.กาญจน ณ ศรีธะ", "ผศ.นพดล บูรณ์กุศล", "ผศ.จสต.นพเก้า ทองใบ", "ผศ.ดร.นิติการ นาคเจือทอง",
    "ผศ.ดร.นัฎฐพันธ์ นาคพงษ์", "ผศ.นิมิต ศรีคำทา", "อ.ดร.พิทย์พิมล ชูรอด", "ผศ.ดร.พาฝัน ดวงไพศาล",
    "อ.ดร.ประดิษฐ์ พิทักษ์เสถียรกุล", "ผศ.พีระศักดิ์ เสรีกุล", "ผศ.สมชัย เชียงพงศ์พันธุ์", "ผศ.ดร.สปีติ กุลจันทร์",
    "ผศ.สิวาลัย จินเจือ", "ผศ.ดร.สุพาภรณ์ ซิ้มเจริญ", "ผศ.ดร.ศรายุทธ ธเนศสกุลวัฒนา", "อ.ดร.ศิรินทรา แว่วศรี",
    "อ.ดร.วัชรชัย คงศิริวัฒนา", "ผศ.ดร.วันทนี ประจวบศุภกิจ", "รศ.ดร.ยุพิน สรรพคุณ"
  ];

  // ===== Storage =====
  function loadAll() {
    try { state.proposals = JSON.parse(localStorage.getItem(LS_PROPOSALS)) || []; } catch { state.proposals = []; }
    try { state.submits = JSON.parse(localStorage.getItem(LS_SUBMITS)) || []; } catch { state.submits = []; }
  }
  function saveSubmits() { localStorage.setItem(LS_SUBMITS, JSON.stringify(state.submits)); }

  // ===== Normalizers (รองรับโครงจาก propose v1 ที่หลากหลาย) =====
  function normMembers(p) {
    if (Array.isArray(p?.members) && p.members.length) return [...p.members];
    const m2 = p?.students?.map(s => s?.name ?? s) ?? [];
    if (m2.length) return m2;
    const joined = p?.memberNames ?? p?.groupMembers ?? p?.group ?? p?.studentList;
    if (joined) return (Array.isArray(joined) ? joined : String(joined).split(/[,;|\n]+/)).map(s => String(s).trim()).filter(Boolean);
    const single = p?.studentName ?? p?.student ?? p?.leader ?? p?.owner ?? p?.submitter;
    return single ? [String(single)] : [];
  }
  function normAdvisor(p) {
    if (p?.advisor && typeof p.advisor === "object") {
      return p.advisor.name ?? p.advisor.fullName ?? p.advisorName ?? p.teacherName ?? "";
    }
    return p?.advisorName ?? p?.advisorFullname ?? p?.teacherName ?? p?.teacher ?? p?.advisor ?? "";
  }
  function normCategory(p) {
    return p?.category ?? p?.type ?? p?.topicType ?? "-";
  }
  function normStatus(p) {
    return p?.status ?? "draft";
  }
  function normUpdatedAt(p) {
    return p?.updatedAt ?? p?.createdAt ?? Date.now();
  }
  function normProposal(p) {
    return {
      id: p.id || `prop-${Math.random().toString(36).slice(2, 8)}`,
      title: p.title || "(ไม่มีชื่อหัวข้อ)",
      advisor: normAdvisor(p) || "-",
      category: normCategory(p),
      members: normMembers(p),
      description: p.description ?? p.summary ?? "",
      status: normStatus(p),
      updatedAt: normUpdatedAt(p)
    };
  }

  // ===== Proposal badge =====
  function toBadge(status) {
    const cls = { draft: "badge badge-draft", submitted: "badge badge-submitted", approved: "badge badge-approved", rejected: "badge badge-rejected" }[status] || "badge";
    const txt = { draft: "แบบร่าง", submitted: "ส่งพิจารณา", approved: "อนุมัติ", rejected: "ไม่อนุมัติ" }[status] || status;
    return `<span class="${cls}">${txt}</span>`;
  }

  // ===== Submit status mapping =====
  function mapSubmitStatus(key = "pending") {
    const txt = {
      pending: "กำลังยื่นสอบ",
      reviewed: "ตรวจแล้ว",
      scheduled: "กำหนดสอบแล้ว",
      passed: "ผ่าน",
      failed: "ไม่ผ่าน",
    }[key] || "กำลังยื่นสอบ";

    const cls = {
      pending: "badge-submitted",
      reviewed: "badge-approved",
      scheduled: "badge-submitted",
      passed: "badge-approved",
      failed: "badge-rejected",
    }[key] || "badge-submitted";

    return { txt, cls };
  }

  // ===== helper: หา submission ล่าสุดของหัวข้อ =====
  function getLatestSubmitOfTopic(topicId) {
    const arr = state.submits.filter(s => s.topicId === topicId);
    if (!arr.length) return null;
    arr.sort((a, b) => b.updatedAt - a.updatedAt);
    return arr[0];
  }

  // ===== Render proposals (left list) =====
  function renderRows(q = "") {
    if (!rowsEl) return;
    const query = (q || "").toLowerCase();

    const items = state.proposals
      .map(normProposal)
      // ✅ กรองให้เหลือเฉพาะหัวข้อที่อนุมัติแล้วเท่านั้น
      .filter(p => String(p.status).toLowerCase() === "approved")
      // (ถ้าอยากปล่อยให้ค้นเฉพาะ approved อย่างเดียว ให้กรอง query ต่อจากนี้)
      .filter(p => {
        if (!query) return true;
        return (p.title || "").toLowerCase().includes(query)
          || (p.advisor || "").toLowerCase().includes(query)
          || (p.category || "").toLowerCase().includes(query)
          || (p.status || "").toLowerCase().includes(query);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (!items.length) {
      rowsEl.innerHTML = `<p style="color:#64748b;margin:12px 0;">ยังไม่มีหัวข้อ “อนุมัติแล้ว”</p>`;
      return;
    }

    rowsEl.innerHTML = items.map(p => {
      const count = p.members?.length || 0;
      const membersTxt = count ? p.members.join(", ") : "-";

      const last = getLatestSubmitOfTopic(p.id);
      const submitSection = last ? (() => {
        const { txt, cls } = mapSubmitStatus(last.status);
        return `
          <div class="k">สถานะยื่นสอบ</div><div class="v"><span class="badge ${cls}">${txt}</span></div>
          <div class="k">วันที่สอบ</div><div class="v">${escapeHTML(last.preferredDate || "-")}</div>
          <div class="k">คณะกรรมการ</div><div class="v">${escapeHTML((last.committee || []).join(", ") || "-")}</div>
          <div class="k">หมายเหตุ</div><div class="v">${escapeHTML(last.note || "-")}</div>
        `;
      })() : "";

      return `
        <div class="row-card" data-id="${p.id}">
          <div class="row-head" role="button" tabindex="0" aria-expanded="false"
               style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;transition:background-color .2s ease;">
            <div class="row-title" title="${escapeHTML(p.title)}">${escapeHTML(p.title)}</div>
            <div class="row-right" style="display:flex;align-items:center;gap:8px;">
              <div class="row-left" style="display:flex;align-items:center;gap:8px;">
                ${toBadge(p.status)}
                <span class="count-pill">${count} คน</span>
              </div>
              <div class="row-actions"></div>
            </div>
          </div>
          <div class="row-body">
            <div class="kv">
              <div class="k">ชื่อหัวข้อ</div><div class="v">${escapeHTML(p.title)}</div>
              <div class="k">อาจารย์ที่ปรึกษา</div><div class="v">${escapeHTML(p.advisor)}</div>
              <div class="k">หมวดหมู่</div><div class="v"><span class="chip">${escapeHTML(p.category)}</span></div>
              <div class="k">สมาชิก</div><div class="v">${escapeHTML(membersTxt)}</div>
              <div class="k">คำอธิบาย</div><div class="v">${p.description ? escapeHTML(p.description) : "-"}</div>
              <div class="k">อัปเดตล่าสุด</div><div class="v">${fmtDT(p.updatedAt)}</div>
              ${submitSection}
            </div>
          </div>
        </div>
      `;
    }).join("");

    // hover + click
    rowsEl.querySelectorAll(".row-head").forEach(head => {
      head.addEventListener("mouseenter", () => head.style.background = "#fff7ed");
      head.addEventListener("mouseleave", () => head.style.background = "transparent");
      head.addEventListener("click", () => {
        const id = head.closest(".row-card")?.dataset.id;
        const p = state.proposals.find(x => (x.id || "").toString() === id);
        if (p) openSplit(normProposal(p));
      });
    });

    // separators
    rowsEl.querySelectorAll(".row-card + .row-card").forEach(el => {
      el.style.marginTop = "10px";
      el.style.paddingTop = "12px";
      el.style.borderTop = "1px solid #e5e7eb";
    });
  }

  // ===== Submitted list (bottom) =====
  function renderSubmittedList() {
    if (!submittedListEl) return;
    if (!state.submits.length) { submittedListEl.innerHTML = ""; return; }

    const items = [...state.submits].sort((a, b) => b.updatedAt - a.updatedAt);
    submittedListEl.innerHTML = `
      <div class="row-card">
        <div class="row-head" style="cursor:default;justify-content:flex-start;gap:10px;">
          <strong>รายการที่ยื่นสอบแล้ว</strong>
          <span class="count-pill">${items.length} รายการ</span>
        </div>
      </div>
      ` + items.map(s => {
      const count = s.members?.length || 0;
      const { txt, cls } = mapSubmitStatus(s.status);
      return `
          <div class="row-card" data-id="${s.id}">
            <div class="row-head" role="button" tabindex="0" aria-expanded="false"
                 style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;">
              <div class="row-title">${escapeHTML(s.title)}</div>
              <div class="row-left">
                <span class="badge ${cls}">${txt}</span>
                <span class="count-pill">${count} คน</span>
                <span class="count-pill">${escapeHTML(s.preferredDate)}</span>
              </div>
            </div>
            <div class="row-body">
              <div class="kv">
                <div class="k">สถานะยื่นสอบ</div><div class="v"><span class="badge ${cls}">${txt}</span></div>
                <div class="k">วันที่สอบ</div><div class="v">${escapeHTML(s.preferredDate)}</div>
                <div class="k">คณะกรรมการ</div><div class="v">${escapeHTML((s.committee || []).join(", ")) || "-"}</div>
                <div class="k">หมายเหตุ</div><div class="v">${escapeHTML(s.note || "-")}</div>
                <div class="k">อัปเดตล่าสุด</div><div class="v">${fmtDT(s.updatedAt)}</div>
              </div>
            </div>
          </div>
        `;
    }).join("");

    submittedListEl.querySelectorAll(".row-card + .row-card").forEach(el => {
      el.style.marginTop = "10px";
      el.style.paddingTop = "12px";
      el.style.borderTop = "1px solid #e5e7eb";
    });
    submittedListEl.querySelectorAll(".row-head[role='button']").forEach(head => {
      head.addEventListener("click", () => {
        const card = head.closest(".row-card");
        const body = card.querySelector(".row-body");
        const expanded = head.getAttribute("aria-expanded") === "true";
        head.setAttribute("aria-expanded", expanded ? "false" : "true");
        body.classList.toggle("show", !expanded);
      });
    });
  }

  // ===== Split panel =====
  function ensureSplitMounted() {
    if (splitEl && previewEl && formBoxEl) return;
    const wrap = document.createElement("div");
    wrap.className = "split hidden";
    wrap.innerHTML = `
      <div class="preview-box">
        <div class="subtle-title">รายละเอียดหัวข้อ</div>
        <div id="previewPanel" class="preview-kv"></div>
      </div>
      <div class="form-box" id="submitPanel"></div>
    `;
    // แทรกหลัง rowsEl
    rowsEl?.parentElement?.insertBefore(wrap, rowsEl.nextSibling);
    splitEl = wrap;
    previewEl = $("#previewPanel", splitEl);
    formBoxEl = $("#submitPanel", splitEl);
  }

  function openSplit(p) {
    state.current = p;
    state.committee = [];
    state.selectedDateStr = "";

    ensureSplitMounted();
    renderPreview(p);
    renderForm();

    splitEl.classList.remove("hidden");
    splitEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ===== PREVIEW (show latest submit too) =====
  function renderPreview(p) {
    const count = p.members?.length || 0;
    const memTxt = count ? p.members.join(", ") : "-";

    const last = getLatestSubmitOfTopic(p.id);
    const submitPreview = last ? (() => {
      const { txt, cls } = mapSubmitStatus(last.status);
      return `
        <div class="k">สถานะยื่นสอบ</div>
        <div class="v"><span class="badge ${cls}">${txt}</span></div>
        <div class="k">วันที่สอบ (ล่าสุด)</div>
        <div class="v" data-preview-date-latest>${escapeHTML(last.preferredDate || "-")}</div>
        <div class="k">คณะกรรมการ</div>
        <div class="v" data-preview-committee-latest>${escapeHTML((last.committee || []).join(", ") || "-")}</div>
        <div class="k">หมายเหตุ</div>
        <div class="v" data-preview-note-latest>${escapeHTML(last.note || "-")}</div>
      `;
    })() : "";

    previewEl.innerHTML = `
      <div class="k">ชื่อหัวข้อ</div><div class="v">${escapeHTML(p.title)}</div>
      <div class="k">อาจารย์ที่ปรึกษา</div><div class="v">${escapeHTML(p.advisor)}</div>
      <div class="k">หมวดหมู่</div><div class="v"><span class="chip">${escapeHTML(p.category)}</span></div>
      <div class="k">สมาชิก</div><div class="v">${escapeHTML(memTxt)}</div>
      <div class="k">สถานะ</div><div class="v">${toBadge(p.status)}</div>
      <div class="k">อัปเดตล่าสุด</div><div class="v">${fmtDT(p.updatedAt)}</div>
      ${submitPreview}
    `;
  }

  // ===== Calendar & Form =====
  function renderForm() {
    formBoxEl.innerHTML = `
      <h3 class="subtle-title">ยื่นสอบหัวข้อ</h3>

      <div class="field">
        <label class="k">วันที่ประสงค์สอบ</label>
        <div class="calendar" id="calendar">
          <div class="cal-header">
            <div class="cal-nav">
              <button class="cal-btn" id="calPrev">&larr;</button>
              <button class="cal-btn" id="calToday">วันนี้</button>
              <button class="cal-btn" id="calNext">&rarr;</button>
            </div>
            <div id="calMonth" style="font-weight:700;color:#b45309;"></div>
          </div>
          <div class="cal-grid" id="calGrid"></div>
        </div>
        <small class="error" id="dateErr"></small>
      </div>

      <div class="field" style="margin-top:10px;">
        <div class="k">คณะกรรมการ (เลือก 3 ท่าน)</div>
        <div class="committee-counter" id="committeeCounter">เลือกแล้ว 0/3</div>
        <div class="committee-wrap" id="committeeWrap"></div>
        <small class="error" id="committeeErr"></small>
      </div>

      <div class="field" style="margin-top:10px;">
        <label for="note">หมายเหตุ/ลิงก์เอกสาร</label>
        <textarea id="note" class="input textarea" rows="3" placeholder="ลิงก์ไฟล์ โฟลเดอร์ หรือหมายเหตุอื่นๆ"></textarea>
      </div>

      <div class="form-actions">
        <button type="button" class="btn-ghost" id="cancelSubmit">ปิด</button>
        <button type="button" class="btn-primary" id="saveSubmit">ยื่นสอบ</button>
      </div>
    `;

    // refs
    calGridEl = $("#calGrid", formBoxEl);
    calMonthEl = $("#calMonth", formBoxEl);
    committeeWrapEl = $("#committeeWrap", formBoxEl);
    committeeCounterEl = $("#committeeCounter", formBoxEl);
    noteEl = $("#note", formBoxEl);
    submitBtn = $("#saveSubmit", formBoxEl);
    cancelBtn = $("#cancelSubmit", formBoxEl);

    // calendar default month
    const now = new Date();
    state.calendar.viewYear = now.getFullYear();
    state.calendar.viewMonth = now.getMonth();
    buildCalendar();

    renderCommitteeChips();

    $("#calPrev", formBoxEl).addEventListener("click", () => shiftMonth(-1));
    $("#calNext", formBoxEl).addEventListener("click", () => shiftMonth(1));
    $("#calToday", formBoxEl).addEventListener("click", () => {
      const d = new Date();
      state.calendar.viewYear = d.getFullYear();
      state.calendar.viewMonth = d.getMonth();
      buildCalendar();
      pickDate(fmtDate(d));
    });

    submitBtn.addEventListener("click", saveSubmit);
    cancelBtn.addEventListener("click", () => splitEl.classList.add("hidden"));
  }

  function monthNameTH(m) {
    const th = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return th[m] || "";
  }
  function shiftMonth(delta) {
    let y = state.calendar.viewYear;
    let m = state.calendar.viewMonth + delta;
    if (m < 0) { m = 11; y -= 1; } if (m > 11) { m = 0; y += 1; }
    state.calendar.viewYear = y; state.calendar.viewMonth = m; buildCalendar();
  }
  function buildCalendar() {
    const y = state.calendar.viewYear, m = state.calendar.viewMonth;
    calMonthEl.textContent = `${monthNameTH(m)} ${y}`;

    const dow = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
    calGridEl.innerHTML = dow.map(d => `<div class="cal-dow">${d}</div>`).join("");

    const first = new Date(y, m, 1), startDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysPrev = new Date(y, m, 0).getDate();

    const cells = [];
    // วันของเดือนก่อนหน้า
    for (let i = 0; i < startDow; i++) { const d = daysPrev - startDow + 1 + i; cells.push({ day: d, muted: true, date: new Date(y, m - 1, d) }); }
    // วันของเดือนนี้
    for (let d = 1; d <= daysInMonth; d++) { cells.push({ day: d, muted: false, date: new Date(y, m, d) }); }
    // เติมท้ายให้ครบ 6 แถว (42 ช่อง) + 7 ช่องหัวตาราง = 49 nodes รวม dow
    while (cells.length < 42) {
      const next = new Date(y, m, daysInMonth + (cells.length - (startDow + daysInMonth) + 1));
      cells.push({ day: next.getDate(), muted: true, date: next });
    }

    const todayStr = fmtDate(new Date());
    calGridEl.innerHTML += cells.map(c => {
      const ds = fmtDate(c.date);
      const cls = ["cal-day", c.muted ? "muted" : "", ds === todayStr ? "today" : "", ds === state.selectedDateStr ? "selected" : ""]
        .filter(Boolean).join(" ");
      return `<div class="${cls}" data-date="${ds}">${c.day}</div>`;
    }).join("");

    $$(".cal-day", calGridEl).forEach(el => {
      el.addEventListener("click", () => {
        const ds = el.getAttribute("data-date");
        pickDate(ds);
        $$(".cal-day", calGridEl).forEach(x => x.classList.toggle("selected", x === el));
      });
    });
  }
  function pickDate(ds) {
    state.selectedDateStr = ds;
    const old = previewEl.querySelector('[data-preview-date]');
    const html = `
      <div class="k">วันที่สอบ (เลือก)</div>
      <div class="v" data-preview-date>${state.selectedDateStr || "-"}</div>
    `;
    if (old) { old.textContent = state.selectedDateStr || "-"; }
    else { previewEl.insertAdjacentHTML("beforeend", html); }
    $("#dateErr", formBoxEl).textContent = "";
  }

  // ===== Committee chips (3 max) =====
  function renderCommitteeChips() {
    committeeWrapEl.innerHTML = COMMITTEE_POOL.map(n => `<div class="committee-chip" data-name="${escapeHTML(n)}">${escapeHTML(n)}</div>`).join("");
    committeeCounterEl.textContent = `เลือกแล้ว ${state.committee.length}/3`;

    $$(".committee-chip", committeeWrapEl).forEach(chip => {
      chip.addEventListener("click", () => {
        const name = chip.getAttribute("data-name");
        const idx = state.committee.indexOf(name);
        if (idx >= 0) { state.committee.splice(idx, 1); chip.classList.remove("selected"); }
        else {
          if (state.committee.length >= 3) { $("#committeeErr", formBoxEl).textContent = "เลือกได้สูงสุด 3 ท่าน"; return; }
          state.committee.push(name); chip.classList.add("selected");
          $("#committeeErr", formBoxEl).textContent = "";
        }
        committeeCounterEl.textContent = `เลือกแล้ว ${state.committee.length}/3`;
        updatePreviewCommittee();
      });
    });
  }
  function updatePreviewCommittee() {
    const text = state.committee.length ? state.committee.join(", ") : "-";
    let node = previewEl.querySelector('[data-preview-committee]');
    if (!node) {
      previewEl.insertAdjacentHTML("beforeend",
        `<div class="k">คณะกรรมการ (เลือก)</div><div class="v" data-preview-committee>${escapeHTML(text)}</div>`);
    } else { node.textContent = text; }
  }

  // ===== Save submit =====
  function saveSubmit() {
    const errDate = $("#dateErr", formBoxEl);
    const errCom = $("#committeeErr", formBoxEl);
    errDate.textContent = ""; errCom.textContent = "";

    if (!state.selectedDateStr) { errDate.textContent = "กรุณาเลือกวันที่สอบจากปฏิทิน"; return; }
    if (state.committee.length !== 3) { errCom.textContent = "กรุณาเลือกคณะกรรมการให้ครบ 3 ท่าน"; return; }

    const p = state.current;
    const payload = {
      id: uid(),
      topicId: p.id,
      title: p.title,
      advisor: p.advisor,
      category: p.category,
      members: p.members || [],
      preferredDate: state.selectedDateStr,
      committee: [...state.committee],
      note: (noteEl?.value || "").trim(),
      status: "pending", // กำลังยื่นสอบ
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    state.submits.push(payload);
    saveSubmits();

    // Toast
    showToast("บันทึกการยื่นสอบแล้ว");

    // Mark pill ในลิสต์ซ้าย
    const right = rowsEl?.querySelector(`.row-card[data-id="${CSS.escape(p.id)}"] .row-right`);
    if (right && !right.querySelector(".pill-submitted")) {
      const pill = document.createElement("span");
      pill.className = "count-pill pill-submitted"; pill.textContent = "ยื่นสอบแล้ว";
      right.appendChild(pill);
    }

    // รีเฟรชส่วนต่าง ๆ ให้เห็นข้อมูลใหม่ทันที
    renderRows();
    renderSubmittedList();
    renderPreview(p); // อัปเดต preview ให้โชว์สถานะ/วันที่/กรรมการล่าสุด

    // ปิดฟอร์ม
    submitBtn.textContent = "บันทึกแล้ว ✓"; submitBtn.disabled = true;
    setTimeout(() => { submitBtn.textContent = "ยื่นสอบ"; submitBtn.disabled = false; splitEl.classList.add("hidden"); }, 700);
  }

  // ===== Init =====
  loadAll();
  renderRows();
  renderSubmittedList();
  searchInput?.addEventListener("input", e => renderRows(e.target.value || ""));
  const fab = document.getElementById("addSubmitBtn"); if (fab) fab.style.display = "none";
})();
