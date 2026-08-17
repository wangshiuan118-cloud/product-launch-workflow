/* ==========================================================
 * 產品上市流程代辦事項
 * 資料模型 + 渲染 + 事件處理 + localStorage 保存
 * ========================================================== */

const STORAGE_KEY = "launch-checklist-v1";

/* ---------- 預設流程資料 ---------- */
function getDefaultStages() {
  const make = (title, items) => ({
    id: uid(),
    title,
    items: items.map((text) => ({ id: uid(), text, completed: false })),
  });

  return [
    make("前期作業", [
      "上一代產品銷售數據",
      "客服維修資料",
      "業務 TA 討論",
      "預算規劃",
      "TA 輪廓分析",
    ]),
    make("上市前", [
      "Function Brief",
      "SPM 規格確認",
      "業務 SP 討論",
      "預算確認",
      "Campaign 安排",
    ]),
    make("上市後", [
      "成效統計",
      "BU 客訴",
      "業務銷售結果確認",
      "Vendor 審計",
      "預算請款",
    ]),
  ];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- 狀態載入 / 保存 ---------- */
let stages = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((s) => s.id && Array.isArray(s.items))) {
        return parsed;
      }
    }
  } catch (e) {
    /* 資料損毀時退回預設 */
  }
  return getDefaultStages();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stages));
}

/* ---------- Modal（取代原生 confirm / prompt） ---------- */
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalDesc = document.getElementById("modal-desc");
const modalInput = document.getElementById("modal-input");
const modalConfirm = document.getElementById("modal-confirm");
const modalCancel = document.getElementById("modal-cancel");

let modalResolve = null;

/**
 * openModal({ title, desc, input, defaultValue, danger })
 * 回傳 Promise：確認 → input 模式回傳字串，否則 true；取消 → null
 */
function openModal({ title, desc = "", input = false, defaultValue = "", danger = false }) {
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  modalDesc.style.display = desc ? "" : "none";

  modalInput.classList.toggle("hidden", !input);
  modalInput.value = defaultValue;

  modalConfirm.classList.toggle("btn-danger", danger);
  modalConfirm.classList.toggle("btn-primary", !danger);
  modalConfirm.textContent = danger ? "刪除" : "確認";

  modalOverlay.classList.remove("hidden");
  if (input) modalInput.focus();
  else modalConfirm.focus();

  return new Promise((resolve) => {
    modalResolve = resolve;
  });
}

function closeModal(result) {
  modalOverlay.classList.add("hidden");
  if (modalResolve) {
    modalResolve(result);
    modalResolve = null;
  }
}

modalConfirm.addEventListener("click", () => {
  const isInput = !modalInput.classList.contains("hidden");
  if (isInput) {
    const value = modalInput.value.trim();
    if (!value) {
      modalInput.focus();
      return;
    }
    closeModal(value);
  } else {
    closeModal(true);
  }
});

modalCancel.addEventListener("click", () => closeModal(null));
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal(null);
});
modalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") modalConfirm.click();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
    closeModal(null);
  }
});

/* ---------- 渲染 ---------- */
const stagesEl = document.getElementById("stages");

function render() {
  stagesEl.innerHTML = "";

  stages.forEach((stage) => {
    stagesEl.appendChild(renderStage(stage));
  });

  renderOverallProgress();
  saveState();
}

function renderStage(stage) {
  const done = stage.items.filter((i) => i.completed).length;
  const total = stage.items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const card = document.createElement("section");
  card.className = "stage-card";

  /* 標題列 */
  const header = document.createElement("div");
  header.className = "stage-header";

  const titleWrap = document.createElement("div");
  const title = document.createElement("span");
  title.className = "stage-title";
  title.textContent = stage.title;

  const badge = document.createElement("span");
  badge.className = "stage-badge" + (total > 0 && done === total ? " done" : "");
  badge.textContent = total > 0 && done === total ? "已完成" : `${done} / ${total}`;

  titleWrap.appendChild(title);
  titleWrap.appendChild(badge);

  const actions = document.createElement("div");
  actions.className = "stage-actions";
  actions.appendChild(
    iconBtn("✎", "重新命名階段", () => renameStage(stage))
  );
  actions.appendChild(
    iconBtn("✕", "刪除階段", () => deleteStage(stage), true)
  );

  header.appendChild(titleWrap);
  header.appendChild(actions);
  card.appendChild(header);

  /* 進度條 */
  const progress = document.createElement("div");
  progress.className = "stage-progress";
  progress.innerHTML = `<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;
  card.appendChild(progress);

  /* 事項清單 */
  const list = document.createElement("ul");
  list.className = "item-list";

  if (stage.items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "item-empty";
    empty.textContent = "尚無事項，於下方新增";
    list.appendChild(empty);
  }

  stage.items.forEach((item) => {
    list.appendChild(renderItem(stage, item));
  });

  card.appendChild(list);

  /* 新增事項 */
  const addRow = document.createElement("div");
  addRow.className = "add-item-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "input";
  input.placeholder = "新增事項…";
  input.maxLength = 100;

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-secondary";
  addBtn.textContent = "新增";

  const addItem = () => {
    const text = input.value.trim();
    if (!text) return;
    stage.items.push({ id: uid(), text, completed: false });
    input.value = "";
    render();
  };

  addBtn.addEventListener("click", addItem);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addItem();
  });

  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  card.appendChild(addRow);

  return card;
}

function renderItem(stage, item) {
  const li = document.createElement("li");
  li.className = "item" + (item.completed ? " completed" : "");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "item-checkbox";
  checkbox.checked = item.completed;
  checkbox.id = "cb-" + item.id;
  checkbox.addEventListener("change", () => {
    item.completed = checkbox.checked;
    render();
  });

  const label = document.createElement("label");
  label.className = "item-label";
  label.htmlFor = checkbox.id;
  label.textContent = item.text;

  const actions = document.createElement("div");
  actions.className = "item-actions";
  actions.appendChild(iconBtn("✎", "編輯事項", () => editItem(stage, item)));
  actions.appendChild(iconBtn("✕", "刪除事項", () => deleteItem(stage, item), true));

  li.appendChild(checkbox);
  li.appendChild(label);
  li.appendChild(actions);
  return li;
}

function iconBtn(symbol, ariaLabel, onClick, danger = false) {
  const btn = document.createElement("button");
  btn.className = "icon-btn" + (danger ? " icon-btn-danger" : "");
  btn.textContent = symbol;
  btn.title = ariaLabel;
  btn.setAttribute("aria-label", ariaLabel);
  btn.addEventListener("click", onClick);
  return btn;
}

function renderOverallProgress() {
  const allItems = stages.flatMap((s) => s.items);
  const done = allItems.filter((i) => i.completed).length;
  const total = allItems.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById("overall-progress-label").textContent =
    `${done} / ${total} 已完成（${pct}%）`;
  document.getElementById("overall-progress-fill").style.width = pct + "%";
}

/* ---------- 操作：階段 ---------- */
async function renameStage(stage) {
  const name = await openModal({
    title: "重新命名階段",
    input: true,
    defaultValue: stage.title,
  });
  if (name) {
    stage.title = name;
    render();
  }
}

async function deleteStage(stage) {
  const count = stage.items.length;
  const ok = await openModal({
    title: `刪除「${stage.title}」階段？`,
    desc: count
      ? `此階段內的 ${count} 個事項將一併刪除，無法復原。`
      : "此操作無法復原。",
    danger: true,
  });
  if (ok) {
    stages = stages.filter((s) => s.id !== stage.id);
    render();
  }
}

async function addStage() {
  const name = await openModal({
    title: "新增流程階段",
    desc: "例如：第二波 Campaign、年度 Review、EOL",
    input: true,
  });
  if (name) {
    stages.push({ id: uid(), title: name, items: [] });
    render();
  }
}

/* ---------- 操作：事項 ---------- */
async function editItem(stage, item) {
  const text = await openModal({
    title: "編輯事項",
    input: true,
    defaultValue: item.text,
  });
  if (text) {
    item.text = text;
    render();
  }
}

async function deleteItem(stage, item) {
  const ok = await openModal({
    title: "刪除此事項？",
    desc: `「${item.text}」將被刪除，無法復原。`,
    danger: true,
  });
  if (ok) {
    stage.items = stage.items.filter((i) => i.id !== item.id);
    render();
  }
}

/* ---------- 還原預設 ---------- */
async function resetToDefault() {
  const ok = await openModal({
    title: "還原預設流程？",
    desc: "所有自訂階段、事項與完成進度將被清除，回到預設的三階段流程。此操作無法復原。",
    danger: true,
  });
  if (ok) {
    stages = getDefaultStages();
    render();
  }
}

/* ---------- 事件綁定與初始化 ---------- */
document.getElementById("btn-add-stage").addEventListener("click", addStage);
document.getElementById("btn-reset").addEventListener("click", resetToDefault);

render();
