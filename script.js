const STORAGE_KEY = "kakiJunGrade2Progress";

const state = {
  currentScreen: "home",
  previousScreen: "home",
  currentKanjiId: "",
  strokeTimers: [],
  strokeRequestId: 0,
  drawing: false,
  progress: loadProgress()
};

const KANJIVG_BASE_URL = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/";
const PENDING_TEXT = "あとで追加";
const strokeCache = new Map();

const screens = {
  home: document.querySelector("#homeScreen"),
  list: document.querySelector("#listScreen"),
  weak: document.querySelector("#weakScreen"),
  history: document.querySelector("#historyScreen"),
  detail: document.querySelector("#detailScreen"),
  practice: document.querySelector("#practiceScreen")
};

const titles = {
  home: "かきじゅん",
  list: "漢字一覧",
  weak: "苦手な漢字",
  history: "学習履歴",
  detail: "漢字のれんしゅう",
  practice: "なぞり練習"
};

const backButton = document.querySelector("#backButton");
const screenTitle = document.querySelector("#screenTitle");
const homeKanji = document.querySelector("#homeKanji");
const kanjiGrid = document.querySelector("#kanjiGrid");
const weakGrid = document.querySelector("#weakGrid");
const weakEmpty = document.querySelector("#weakEmpty");
const historyList = document.querySelector("#historyList");
const historyEmpty = document.querySelector("#historyEmpty");
const detailKanji = document.querySelector("#detailKanji");
const detailOnyomi = document.querySelector("#detailOnyomi");
const detailKunyomi = document.querySelector("#detailKunyomi");
const detailWords = document.querySelector("#detailWords");
const detailSentence = document.querySelector("#detailSentence");
const strokeSvg = document.querySelector("#strokeSvg");
const strokeStatus = document.querySelector("#strokeStatus");
const weakToggleButton = document.querySelector("#weakToggleButton");
const practiceGuide = document.querySelector("#practiceGuide");
const practiceCanvas = document.querySelector("#practiceCanvas");
const practiceContext = practiceCanvas.getContext("2d");

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function getProgress(id) {
  if (!state.progress[id]) {
    state.progress[id] = {
      learned: false,
      weak: false,
      learnedCount: 0,
      lastStudiedAt: ""
    };
  }
  return state.progress[id];
}

function getKanji(id) {
  return KANJI_DATA.find((item) => item.id === id) || KANJI_DATA[0];
}

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function readingText(value) {
  return hasItems(value) ? value.join(" / ") : PENDING_TEXT;
}

function cardReadingText(item) {
  const readings = [];
  if (hasItems(item.onyomi)) readings.push(item.onyomi[0]);
  if (hasItems(item.kunyomi)) readings.push(item.kunyomi[0].replace(/-/g, ""));
  return readings.length > 0 ? readings.join(" / ") : PENDING_TEXT;
}

function primaryWordText(item) {
  return hasItems(item.words) ? item.words[0] : PENDING_TEXT;
}

function todayText() {
  return new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function chooseTodayKanji() {
  const sorted = [...KANJI_DATA].sort((a, b) => {
    const progressA = getProgress(a.id);
    const progressB = getProgress(b.id);
    return progressA.learnedCount - progressB.learnedCount || a.id.localeCompare(b.id);
  });
  return sorted[0];
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  state.previousScreen = state.currentScreen;
  state.currentScreen = name;
  screenTitle.textContent = titles[name];
  backButton.classList.toggle("hidden", name === "home");

  if (name === "list") renderKanjiList();
  if (name === "weak") renderWeakList();
  if (name === "history") renderHistory();
  if (name === "practice") resizeCanvas();
}

function goBack() {
  if (state.currentScreen === "detail") {
    showScreen(state.previousScreen === "practice" ? "list" : state.previousScreen);
    return;
  }

  if (state.currentScreen === "practice") {
    openDetail(state.currentKanjiId, "detail");
    return;
  }

  showScreen("home");
}

function renderHome() {
  homeKanji.textContent = chooseTodayKanji().kanji;
}

function renderKanjiList() {
  kanjiGrid.innerHTML = "";
  KANJI_DATA.forEach((item) => kanjiGrid.appendChild(createKanjiCard(item)));
}

function renderWeakList() {
  weakGrid.innerHTML = "";
  const weakItems = KANJI_DATA.filter((item) => getProgress(item.id).weak);
  weakItems.forEach((item) => weakGrid.appendChild(createKanjiCard(item)));
  weakEmpty.classList.toggle("hidden", weakItems.length > 0);
}

function renderHistory() {
  historyList.innerHTML = "";
  const studied = KANJI_DATA
    .map((item) => ({ ...item, progress: getProgress(item.id) }))
    .filter((item) => item.progress.learnedCount > 0 || item.progress.lastStudiedAt)
    .sort((a, b) => b.progress.lastStudiedAt.localeCompare(a.progress.lastStudiedAt));

  studied.forEach((item) => {
    const row = document.createElement("button");
    row.className = "history-item";
    row.type = "button";
    row.addEventListener("click", () => openDetail(item.id, "history"));
    row.innerHTML = `
      <span class="history-kanji">${item.kanji}</span>
      <span>
        <p>${primaryWordText(item)}</p>
        <p>れんしゅう ${item.progress.learnedCount}回</p>
        <p>さいご: ${item.progress.lastStudiedAt || "まだ"}</p>
      </span>
    `;
    historyList.appendChild(row);
  });

  historyEmpty.classList.toggle("hidden", studied.length > 0);
}

function createKanjiCard(item) {
  const progress = getProgress(item.id);
  const status = progress.weak ? "苦手" : progress.learned ? "学習済み" : "未学習";
  const card = document.createElement("button");
  card.className = `kanji-card ${progress.learned ? "learned" : ""} ${progress.weak ? "weak" : ""}`;
  card.type = "button";
  card.addEventListener("click", () => openDetail(item.id, state.currentScreen));
  card.innerHTML = `
    <span class="card-kanji">${item.kanji}</span>
    <span class="card-reading">${cardReadingText(item)}</span>
    <span class="card-meta">
      <span>${status}</span>
      <span>${progress.learnedCount}回</span>
    </span>
  `;
  return card;
}

function openDetail(id, fromScreen) {
  const item = getKanji(id);
  const progress = getProgress(id);
  state.currentKanjiId = id;
  state.previousScreen = fromScreen || state.currentScreen;

  detailKanji.textContent = item.kanji;
  detailOnyomi.textContent = readingText(item.onyomi);
  detailKunyomi.textContent = readingText(item.kunyomi);
  detailWords.innerHTML = "";
  const words = hasItems(item.words) ? item.words : [PENDING_TEXT];
  words.forEach((word) => {
    const wordNode = document.createElement("span");
    wordNode.textContent = word;
    detailWords.appendChild(wordNode);
  });
  detailSentence.textContent = item.exampleSentence || PENDING_TEXT;

  weakToggleButton.textContent = progress.weak ? "苦手から外す" : "苦手に追加";
  weakToggleButton.classList.toggle("active", progress.weak);
  drawStrokePreview(item);
  showScreen("detail");
}

async function drawStrokePreview(item) {
  const requestId = ++state.strokeRequestId;
  clearStrokeTimers();
  strokeSvg.innerHTML = "";
  strokeSvg.setAttribute("viewBox", "0 0 109 109");
  strokeStatus.textContent = "書き順データを読み込み中...";

  const strokeData = await getStrokeData(item);
  if (requestId !== state.strokeRequestId) return;
  strokeSvg.setAttribute("viewBox", strokeData.viewBox);

  if (strokeData.paths.length === 0) {
    strokeStatus.textContent = "書き順データを読み込めませんでした";
    return;
  }

  strokeStatus.textContent = `${strokeData.paths.length}画`;

  strokeData.paths.forEach((stroke, index) => {
    const path = makeSvgElement("path", {
      d: stroke,
      class: "stroke-path",
      opacity: "0.18"
    });
    strokeSvg.appendChild(path);
    drawStrokeNumber(path, index + 1, 0.5);
  });
}

async function playStrokes() {
  const item = getKanji(state.currentKanjiId);
  const requestId = ++state.strokeRequestId;
  clearStrokeTimers();
  strokeSvg.innerHTML = "";
  strokeSvg.setAttribute("viewBox", "0 0 109 109");
  strokeStatus.textContent = "書き順データを読み込み中...";

  const strokeData = await getStrokeData(item);
  if (requestId !== state.strokeRequestId) return;
  strokeSvg.setAttribute("viewBox", strokeData.viewBox);

  if (strokeData.paths.length === 0) {
    strokeStatus.textContent = "書き順データを読み込めませんでした";
    return;
  }

  strokeStatus.textContent = `1 / ${strokeData.paths.length}`;

  strokeData.paths.forEach((stroke, index) => {
    const timer = window.setTimeout(() => {
      const path = makeSvgElement("path", {
        d: stroke,
        class: "stroke-path"
      });
      strokeSvg.appendChild(path);
      animatePath(path);
      drawStrokeNumber(path, index + 1, 1);
      strokeStatus.textContent = `${index + 1} / ${strokeData.paths.length}`;

      if (index === strokeData.paths.length - 1) {
        strokeStatus.textContent = "できあがり";
      }
    }, index * 620);
    state.strokeTimers.push(timer);
  });
}

function clearStrokeTimers() {
  state.strokeTimers.forEach((timer) => window.clearTimeout(timer));
  state.strokeTimers = [];
}

function getKanjiSvgFileName(kanji) {
  return kanji.codePointAt(0).toString(16).padStart(5, "0") + ".svg";
}

async function getStrokeData(item) {
  const filename = getKanjiSvgFileName(item.kanji);

  if (strokeCache.has(filename)) {
    return strokeCache.get(filename);
  }

  try {
    const response = await fetch(KANJIVG_BASE_URL + filename);
    if (!response.ok) throw new Error(`KanjiVG SVG not found: ${filename}`);

    const svgText = await response.text();
    const parsed = parseKanjiVgSvg(svgText, item.kanji);
    if (parsed.paths.length === 0) throw new Error(`KanjiVG paths not found: ${filename}`);

    strokeCache.set(filename, parsed);
    return parsed;
  } catch {
    const fallback = getEmbeddedStrokeData(item);
    strokeCache.set(filename, fallback);
    return fallback;
  }
}

function parseKanjiVgSvg(svgText, kanji) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  const code = kanji.codePointAt(0).toString(16).padStart(5, "0");
  const pathsRoot = doc.getElementById(`kvg:StrokePaths_${code}`) || doc.querySelector("[id^='kvg:StrokePaths_']");
  const paths = pathsRoot
    ? [...pathsRoot.querySelectorAll("path")].map((path) => path.getAttribute("d")).filter(Boolean)
    : [];

  return {
    viewBox: svg?.getAttribute("viewBox") || "0 0 109 109",
    paths
  };
}

function getEmbeddedStrokeData(item) {
  if (item.kanjiVg && Array.isArray(item.kanjiVg.paths)) {
    return {
      viewBox: item.kanjiVg.viewBox || "0 0 109 109",
      paths: item.kanjiVg.paths
    };
  }

  return {
    viewBox: "0 0 109 109",
    paths: []
  };
}

function makeSvgElement(name, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function animatePath(path) {
  const length = path.getTotalLength();
  path.style.strokeDasharray = length;
  path.style.strokeDashoffset = length;
  path.animate(
    [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
    { duration: 520, easing: "ease-out", fill: "forwards" }
  );
}

function drawStrokeNumber(path, number, opacity) {
  const point = getNumberPoint(path);
  const circle = makeSvgElement("circle", {
    cx: point.x,
    cy: point.y,
    r: "5.5",
    class: "stroke-number",
    opacity: opacity
  });
  const text = makeSvgElement("text", {
    x: point.x,
    y: point.y + 0.5,
    class: "stroke-number-text",
    opacity: opacity
  });
  text.textContent = number;
  strokeSvg.append(circle, text);
}

function getNumberPoint(path) {
  const start = path.getPointAtLength(0);
  const box = strokeSvg.viewBox.baseVal;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const dx = start.x - centerX;
  const dy = start.y - centerY;
  const distance = Math.hypot(dx, dy) || 1;
  const offset = 8;

  return {
    x: clamp(start.x + (dx / distance) * offset, box.x + 6, box.x + box.width - 6),
    y: clamp(start.y + (dy / distance) * offset, box.y + 6, box.y + box.height - 6)
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function markLearned(id) {
  const progress = getProgress(id);
  progress.learned = true;
  progress.learnedCount += 1;
  progress.lastStudiedAt = todayText();
  saveProgress();
  renderHome();
  openDetail(id, "detail");
}

function toggleWeak(id) {
  const progress = getProgress(id);
  progress.weak = !progress.weak;
  saveProgress();
  openDetail(id, "detail");
}

function openPractice() {
  const item = getKanji(state.currentKanjiId);
  practiceGuide.textContent = item.kanji;
  showScreen("practice");
  clearCanvas();
}

function resizeCanvas() {
  const rect = practiceCanvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  practiceCanvas.width = Math.round(rect.width * scale);
  practiceCanvas.height = Math.round(rect.height * scale);
  practiceContext.setTransform(scale, 0, 0, scale, 0, 0);
  practiceContext.lineCap = "round";
  practiceContext.lineJoin = "round";
  practiceContext.lineWidth = 12;
  practiceContext.strokeStyle = "#263238";
}

function clearCanvas() {
  resizeCanvas();
  const rect = practiceCanvas.getBoundingClientRect();
  practiceContext.clearRect(0, 0, rect.width, rect.height);
}

function canvasPoint(event) {
  const rect = practiceCanvas.getBoundingClientRect();
  const pointer = event.touches ? event.touches[0] : event;
  return {
    x: pointer.clientX - rect.left,
    y: pointer.clientY - rect.top
  };
}

function startDrawing(event) {
  event.preventDefault();
  state.drawing = true;
  const point = canvasPoint(event);
  practiceContext.beginPath();
  practiceContext.moveTo(point.x, point.y);
}

function draw(event) {
  if (!state.drawing) return;
  event.preventDefault();
  const point = canvasPoint(event);
  practiceContext.lineTo(point.x, point.y);
  practiceContext.stroke();
}

function stopDrawing() {
  state.drawing = false;
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "today") openDetail(chooseTodayKanji().id, "home");
  if (action === "list") showScreen("list");
  if (action === "weak") showScreen("weak");
  if (action === "history") showScreen("history");
  if (action === "play-strokes" || action === "replay-strokes") playStrokes();
  if (action === "practice") openPractice();
  if (action === "learned") markLearned(state.currentKanjiId);
  if (action === "toggle-weak") toggleWeak(state.currentKanjiId);
  if (action === "clear-canvas") clearCanvas();
  if (action === "practice-done") markLearned(state.currentKanjiId);
  if (action === "back-detail") openDetail(state.currentKanjiId, "practice");
});

backButton.addEventListener("click", goBack);
window.addEventListener("resize", () => {
  if (state.currentScreen === "practice") resizeCanvas();
});

practiceCanvas.addEventListener("pointerdown", startDrawing);
practiceCanvas.addEventListener("pointermove", draw);
practiceCanvas.addEventListener("pointerup", stopDrawing);
practiceCanvas.addEventListener("pointercancel", stopDrawing);
practiceCanvas.addEventListener("pointerleave", stopDrawing);

renderHome();
renderKanjiList();
