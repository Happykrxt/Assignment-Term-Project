/* /js/submit-topic.js */
(function () {
  const LS_PROPOSALS = "proposals.v1"; // จากหน้าสร้างหัวข้อ
  const LS_SUBMITS   = "submits.v1";   // การยื่นสอบของหน้านี้

  // ===== helpers =====
  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2,10);
  const escapeHTML = (str) => String(str)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
  const fmtDate = ts => ts ? new Date(ts).toLocaleDateString() : "-";
  const fmtDT   = ts => ts ? new Date(ts).toLocaleString() : "-";

  // ===== elements =====
  const formSection    = $("#formSection");
  const form           = $("#submitForm");
  const addBtn         = $("#addSubmitBtn");
  const cancelBtn      = $("#cancelBtn");

  const topicSelect    = $("#topicSelect");
  const advisorEl      = $("#advisor");
  const categoryEl     = $("#category");
  const dateEl         = $("#preferredDate");
  const membersEl      = $("#members");
  const noteEl         = $("#note");

  const errTopic       = $('[data-error-for="topicSelect"]');
  const errAdvisor     = $('[data-error-for="advisor"]');
  const errCategory    = $('[data-error-for="category"]');

  const searchInput    = $("#searchInput");
  const rowsEl         = $("#submitRows");

  // ===== state =====
  const state = {
    proposals: [],  // อ่านจาก proposals.v1 เพื่อเติม dropdown
    submits:   [],  // บันทึกของหน้านี้
    editId: null,
    q: ""
  };

  // ===== storage =====
  function loadAll(){
    try {
      const p = localStorage.getItem(LS_PROPOSALS);
      state.proposals = p ? JSON.parse(p) : [];
    } catch { state.proposals = []; }

    try {
      const s = localStorage.getItem(LS_SUBMITS);
      state.submits = s ? JSON.parse(s) : [];
    } catch { state.submits = []; }
  }
  function saveSubmits(){
    localStorage.setItem(LS_SUBMITS, JSON.stringify(state.submits));
  }

  // ===== init dropdown from proposals =====
  function populateTopics(){
    topicSelect.innerHTML = `<option value="">-- เลือกหัวข้อจากที่เสนอไว้ --</option>` +
      state.proposals
        .sort((a,b)=>b.updatedAt-a.updatedAt)
        .map(p=>`<option value="${escapeHTML(p.id)}" data-advisor="${escapeHTML(p.advisor)}" data-category="${escapeHTML(p.category)}" data-members="${escapeHTML((p.members||[]).join(", "))}">${escapeHTML(p.title)}</option>`)
        .join("");
  }

  // auto fill advisor/category/members when topic changed
  topicSelect?.addEventListener("change", e=>{
    const opt = topicSelect.selectedOptions[0];
    if (!opt) return;
    const adv = opt.getAttribute("data-advisor") || "";
    const cat = opt.getAttribute("data-category") || "";
    const mem = opt.getAttribute("data-members") || "";
    advisorEl.value  = adv;
    categoryEl.value = cat;
    membersEl.value  = mem;
  });

  // ===== UI helpers =====
  function showForm(){
    formSection.classList.remove("hidden");
    const top = formSection.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top, behavior:"smooth" });
    topicSelect?.focus();
  }
  function hideForm(){ formSection.classList.add("hidden"); }
  function resetForm(){
    form.reset();
    state.editId = null;
    $("#saveBtn")?.textContent = "ยื่นสอบ";
  }
  function clearErrors(){
    if (errTopic)    errTopic.textContent    = "";
    if (errAdvisor)  errAdvisor.textContent  = "";
    if (errCategory) errCategory.textContent = "";
  }
  function validate(){
    clearErrors();
    let ok = true;
    if (!topicSelect.value) { errTopic.textContent = "กรุณาเลือกหัวข้อ"; ok=false; }
    if (!advisorEl.value)   { errAdvisor.textContent = "กรุณาเลือกอาจารย์ที่ปรึกษา"; ok=false; }
    if (!categoryEl.value)  { errCategory.textContent = "กรุณาเลือกหมวดหมู่"; ok=false; }
    return ok;
  }

  // ===== view: rows (หัวเรื่องซ้าย | สถานะ+จำนวนขวา | hover ส้มอ่อน) =====
  function toBadge(status){
    const map = {
      pending:  "badge badge-submitted",
      scheduled:"badge badge-approved",
      passed:   "badge badge-approved",
      failed:   "badge badge-rejected"
    };
    const text = { pending:"รอตรวจ", scheduled:"นัดสอบ", passed:"ผ่าน", failed:"ไม่ผ่าน" }[status] || status;
    return `<span class="${map[status]||"badge"}">${text}</span>`;
  }

  function renderRows(){
    if (!rowsEl) return;

    const q = state.q.toLowerCase();
    const items = [...state.submits]
      .filter(x=>{
        if (!q) return true;
        return (
          (x.title||"").toLowerCase().includes(q) ||
          (x.advisor||"").toLowerCase().includes(q) ||
          (x.category||"").toLowerCase().includes(q) ||
          (x.status||"").toLowerCase().includes(q)
        );
      })
      .sort((a,b)=>b.updatedAt-a.updatedAt);

    rowsEl.innerHTML = items.map(s=>{
      const count = s.members?.length || 0;
      const memTxt = count ? s.members.join(", ") : "-";
      return `
        <div class="row-card" data-id="${s.id}">
          <div class="row-head" role="button" tabindex="0" aria-expanded="false"
               style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:6px;">
            <div class="row-title" title="${escapeHTML(s.title)}"
                 style="font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">
              ${escapeHTML(s.title)}
            </div>
            <div class="row-left" style="display:flex;align-items:center;gap:8px;margin-left:12px;">
              ${toBadge(s.status)}
              <span class="count-pill">${count} คน</span>
            </div>
          </div>
          <div class="row-body">
            <div class="kv">
              <div class="k">ชื่อหัวข้อ</div><div class="v">${escapeHTML(s.title)}</div>
              <div class="k">อาจารย์ที่ปรึกษา</div><div class="v">${escapeHTML(s.advisor)}</div>
              <div class="k">หมวดหมู่</div><div class="v"><span class="chip">${escapeHTML(s.category)}</span></div>
              <div class="k">สมาชิก</div><div class="v">${escapeHTML(memTxt)}</div>
              <div class="k">วันที่ประสงค์สอบ</div><div class="v">${s.preferredDate ? escapeHTML(s.preferredDate) : "-"}</div>
              <div class="k">หมายเหตุ/ลิงก์</div><div class="v">${s.note ? escapeHTML(s.note) : "-"}</div>
              <div class="k">อัปเดตล่าสุด</div><div class="v">${fmtDT(s.updatedAt)}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // hover สีส้มอ่อน + separator + โชว์/ซ่อนรายละเอียด
    $$("#submitRows .row-card + .row-card").forEach(el=>{
      el.style.marginTop = "10px";
      el.style.paddingTop = "12px";
      el.style.borderTop = "1px solid #e5e7eb";
    });
    $$("#submitRows .row-head").forEach(head=>{
      head.addEventListener("mouseenter", ()=> head.style.background = "#fff7ed");
      head.addEventListener("mouseleave", ()=> head.style.background = "transparent");
      head.addEventListener("click", ()=> toggleRow(head));
      head.addEventListener("keydown", (e)=>{
        if (e.key==="Enter"||e.key===" "){ e.preventDefault(); toggleRow(head); }
      });
    });
  }

  function toggleRow(headEl){
    const card = headEl.closest(".row-card");
    const body = card.querySelector(".row-body");
    const expanded = headEl.getAttribute("aria-expanded")==="true";
    headEl.setAttribute("aria-expanded", expanded ? "false" : "true");
    body.classList.toggle("show", !expanded);
  }

  function focusRow(id){
    const card = rowsEl?.querySelector(`.row-card[data-id="${CSS.escape(id)}"]`);
    if (card){
      card.scrollIntoView({behavior:"smooth", block:"start"});
      const head = card.querySelector(".row-head");
      const body = card.querySelector(".row-body");
      head?.setAttribute("aria-expanded","true");
      body?.classList.add("show");
    }
  }

  // ===== CRUD =====
  function upsert(payload){
    let saved;
    if (state.editId){
      const idx = state.submits.findIndex(x=>x.id===state.editId);
      if (idx>=0){
        state.submits[idx] = { ...state.submits[idx], ...payload, updatedAt: Date.now() };
        saved = state.submits[idx];
      }
    } else {
      saved = {
        id: uid(),
        status: "pending",         // ค่าเริ่มต้น
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...payload
      };
      state.submits.push(saved);
    }
    saveSubmits();
    renderRows();
    resetForm();
    hideForm();
    focusRow(saved.id);
  }

  // ===== Events =====
  addBtn?.addEventListener("click", ()=>{ resetForm(); clearErrors(); populateTopics(); showForm(); });

  cancelBtn?.addEventListener("click", ()=>{ resetForm(); clearErrors(); hideForm(); });

  form?.addEventListener("submit", (e)=>{
    e.preventDefault();
    if (!validate()) return;

    const members = membersEl.value.split(",").map(s=>s.trim()).filter(Boolean);
    const payload = {
      topicId: topicSelect.value,
      title: topicSelect.options[topicSelect.selectedIndex]?.text || "",
      advisor: advisorEl.value.trim(),
      category: categoryEl.value.trim(),
      members,
      preferredDate: dateEl.value || "",
      note: noteEl.value.trim()
    };
    upsert(payload);
  });

  // ค้นหาแบบง่าย
  searchInput?.addEventListener("input", (e)=>{ state.q = e.target.value || ""; renderRows(); });

  // ===== init =====
  loadAll();
  populateTopics();
  renderRows();
})();
