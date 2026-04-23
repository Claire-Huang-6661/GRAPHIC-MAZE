const mazeCanvas = document.getElementById("mazeCanvas");
const mazeCtx = mazeCanvas.getContext("2d");
const visualCanvas = document.getElementById("visualCanvas");
const visualCtx = visualCanvas.getContext("2d");
const bgVideoElement = document.getElementById("bgVideoElement");

/** 预览画布逻辑尺寸（高分辨率由 devicePixelRatio 放大） */
const VIEW_LOGICAL_W = 640;
const VIEW_LOGICAL_H = 480;
let viewDpr = 1;

/** 图形初始排布：center | random（随机按钮每次只重排位置） */
let shapePlacementMode = "center";

/** 文字在安全区内相对中心的偏移：center | random（随机按钮每次重随机偏移） */
let textPlacementMode = "center";

function createDefaultMazeTextFx() {
  return {
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fontBoost: 0,
    hueShift: 0,
    alpha: 1,
  };
}

let mazeTextFx = createDefaultMazeTextFx();

function textFxFromRecord(rec) {
  const d = createDefaultMazeTextFx();
  if (!rec || !rec.textFx) return d;
  return { ...d, ...rec.textFx };
}

/** 迷宫画布逻辑尺寸（实际像素由 setupMazeCanvas 按 DPR 放大） */
const MAZE_LOGICAL = 480;
let mazeDpr = 1;

const ui = {
  regenMazeBtn: document.getElementById("regenMazeBtn"),
  mazeStatus: document.getElementById("mazeStatus"),
  startBtn: document.getElementById("startBtn"),
  downloadPngBtn: document.getElementById("downloadPngBtn"),
  downloadVideoBtn: document.getElementById("downloadVideoBtn"),
  ruleUp: document.getElementById("ruleUp"),
  ruleDown: document.getElementById("ruleDown"),
  ruleLeft: document.getElementById("ruleLeft"),
  ruleRight: document.getElementById("ruleRight"),
  materialSelect: document.getElementById("materialSelect"),
  randomMixShuffleBtn: document.getElementById("randomMixShuffleBtn"),
  randomMixShuffleRow: document.getElementById("randomMixShuffleRow"),
  blendModeSelect: document.getElementById("blendModeSelect"),
  shapeSizeRange: document.getElementById("shapeSizeRange"),
  grainStrengthRange: document.getElementById("grainStrengthRange"),
  strokeEnabled: document.getElementById("strokeEnabled"),
  strokeColorInput: document.getElementById("strokeColorInput"),
  playbackSpeedRange: document.getElementById("playbackSpeedRange"),
  replayBtnFirst: document.getElementById("replayBtnFirst"),
  replayBtnPrev: document.getElementById("replayBtnPrev"),
  replayBtnPlayPause: document.getElementById("replayBtnPlayPause"),
  replayBtnNext: document.getElementById("replayBtnNext"),
  replayBtnLast: document.getElementById("replayBtnLast"),
  bgColorInput: document.getElementById("bgColorInput"),
  transparentBg: document.getElementById("transparentBg"),
  bgImageInput: document.getElementById("bgImageInput"),
  bgVideoInput: document.getElementById("bgVideoInput"),
  shapeLibrary: document.getElementById("shapeLibrary"),
  shapeColorPalette: document.getElementById("shapeColorPalette"),
  shapeColorsRandomBtn: document.getElementById("shapeColorsRandomBtn"),
  langZh: document.getElementById("langZh"),
  langEn: document.getElementById("langEn"),
  mazeTextInput: document.getElementById("mazeTextInput"),
  playbackMute: document.getElementById("playbackMute"),
  shapeLayoutCenterBtn: document.getElementById("shapeLayoutCenterBtn"),
  shapeLayoutRandomBtn: document.getElementById("shapeLayoutRandomBtn"),
  textLayoutCenterBtn: document.getElementById("textLayoutCenterBtn"),
  textLayoutRandomBtn: document.getElementById("textLayoutRandomBtn"),
  mazeTextSizeRange: document.getElementById("mazeTextSizeRange"),
  mazeTextStrokeEnabled: document.getElementById("mazeTextStrokeEnabled"),
  mazeTextColorInput: document.getElementById("mazeTextColorInput"),
  mazeTextStrokeColorInput: document.getElementById("mazeTextStrokeColorInput"),
  mazeTextStrokeWidthRange: document.getElementById("mazeTextStrokeWidthRange"),
  shapeStrokeWidthRange: document.getElementById("shapeStrokeWidthRange"),
  graphicOnionSkin: document.getElementById("graphicOnionSkin"),
  replayOnionSkin: document.getElementById("replayOnionSkin"),
  galleryOpenBtn: document.getElementById("galleryOpenBtn"),
  galleryModal: document.getElementById("galleryModal"),
  galleryGrid: document.getElementById("galleryGrid"),
  galleryEmpty: document.getElementById("galleryEmpty"),
  galleryCloseBtn: document.getElementById("galleryCloseBtn"),
  galleryToolbar: document.getElementById("galleryToolbar"),
  galleryClearAllBtn: document.getElementById("galleryClearAllBtn"),
  galleryExportSelectedBtn: document.getElementById("galleryExportSelectedBtn"),
  galleryDeleteSelectedBtn: document.getElementById("galleryDeleteSelectedBtn"),
  galleryExportAllBtn: document.getElementById("galleryExportAllBtn"),
  videoExportOverlay: document.getElementById("videoExportOverlay"),
};

const ACTION_IDS = [
  "rotateCW",
  "rotateCCW",
  "stretchX",
  "stretchY",
  "compress",
  "expand",
  "moveHue",
  "alphaUp",
  "alphaDown",
  "jitter",
  "trailBoost",
  "pulse",
  "shift",
  "split",
];

const SHAPE_IDS = ["circle", "square", "triangle", "diamond", "star", "hexagon", "line", "spiral"];

const MATERIAL_IDS = ["solid", "gradient", "grain", "neon", "wireframe", "randomMix"];

/** 随机混合材质从中抽取两种（不含 randomMix 自身） */
const MIXABLE_MATERIAL_IDS = ["solid", "gradient", "grain", "neon", "wireframe"];

function pickRandomMaterialPair() {
  const pool = MIXABLE_MATERIAL_IDS;
  const a = pool[(Math.random() * pool.length) | 0];
  let b = pool[(Math.random() * pool.length) | 0];
  let guard = 0;
  while (b === a && pool.length > 1 && guard < 16) {
    b = pool[(Math.random() * pool.length) | 0];
    guard += 1;
  }
  return [a, b];
}

function assignRandomMixPairsToVisualShapes() {
  visualShapes.forEach((s) => {
    s.materialMixPair = pickRandomMaterialPair();
  });
}

function clearMaterialMixOnVisualShapes() {
  visualShapes.forEach((s) => {
    delete s.materialMixPair;
  });
}

function syncRandomMixShuffleUi() {
  if (!ui.randomMixShuffleRow) return;
  ui.randomMixShuffleRow.hidden = ui.materialSelect?.value !== "randomMix";
}

const BLEND_IDS = ["source-over", "screen", "multiply", "overlay", "difference", "lighter"];

const I18N = {
  zh: {
    "doc.title": "Graphic Maze",
    "header.title": "Graphic Maze",
    "header.tagline": "先定义规则，再通过迷宫行走生成视觉结果。",
    "maze.start": "开始新游戏",
    "maze.regen": "重新随机迷宫",
    "maze.hint": "使用键盘方向键行走：↑ ↓ ← →",
    "maze.remindAdjust": "可在未开局时先调节中间栏参数；点「开始新游戏」将按当前调节开始一局。",
    "maze.gallery": "图库",
    "maze.galleryTitle": "终点图库",
    "maze.galleryEmpty": "到达终点并完成一局后，最终画面会自动保存在此。点击图片可查看大图。",
    "maze.galleryCloseAria": "关闭",
    "maze.galleryCloseBackdrop": "关闭图库",
    "maze.gallerySteps": "{n} 步",
    "maze.galleryClearAll": "一键清空",
    "maze.galleryExportSelected": "导出所选",
    "maze.galleryDeleteSelected": "删除所选",
    "maze.galleryExportAll": "一键导出",
    "maze.galleryConfirmClearAll": "确定清空图库中的全部记录？此操作不可恢复。",
    "maze.galleryConfirmDeleteSelected": "确定删除已选中的 {n} 条记录？",
    "maze.galleryNoneSelected": "请先勾选要操作的缩略图。",
    "maze.galleryExportZipFail": "无法打包为 ZIP，已改为逐个下载。",
    "group.mazeText": "迷宫字形（可选）",
    "group.textLayout": "文字位置",
    "group.replay": "记录回放",
    "mazeText.placeholder": "在此输入文字；行走时字形留在画面安全区内，并随方向键映射的动作变化。",
    "label.playbackMute": "回放静音",
    "panel.rules": "RULES / LIBRARY",
    "panel.preview": "实时图形与动画预览",
    "group.shapeLib": "图形库选择（可多选）",
    "shapeColors.random": "随机颜色",
    "group.shapeLayout": "图形位置",
    "label.graphicOnionSkin": "图形变化洋葱皮",
    "label.replayOnionSkin": "回放洋葱皮",
    "shapeLayout.center": "居中在画面",
    "shapeLayout.random": "随机分布",
    "mazeText.more": "更多（颜色、大小与描边）",
    "mazeText.sectionSize": "文字大小",
    "label.mazeTextSize": "字号（相对自动排版）",
    "mazeText.sectionStyle": "文字样式",
    "mazeText.sectionShapeStroke": "图形描边",
    "label.mazeTextStroke": "文字描边",
    "label.mazeTextColor": "文字颜色",
    "label.mazeTextStrokeColor": "描边颜色",
    "label.mazeTextStrokeWidth": "文字描边粗细",
    "label.shapeStrokeWidth": "图形描边粗细",
    "label.shapeStrokeColor": "图形描边颜色",
    "group.rulesDir": "方向键行为映射",
    "group.bg": "背景设置",
    "rule.up": "↑ 上",
    "rule.down": "↓ 下",
    "rule.left": "← 左",
    "rule.right": "→ 右",
    "label.material": "材质",
    "label.blend": "叠加方式",
    "label.shapeSize": "初始图形大小",
    "label.grainStrength": "胶片颗粒强度",
    "label.stroke": "图形描边",
    "label.playbackSpeed": "回放速度",
    "status.replayPaused": "回放已暂停",
    "replay.ariaFirst": "跳到开头",
    "replay.ariaPrev": "上一帧",
    "replay.ariaPlay": "播放",
    "replay.ariaPause": "暂停",
    "replay.ariaNext": "下一帧",
    "replay.ariaLast": "跳到末尾",
    "label.bgColor": "背景色",
    "label.bgTransparent": "背景透明",
    "label.bgImage": "背景图片",
    "label.bgVideo": "背景视频",
    "bg.more": "更多（背景色、图与视频）",
    "btn.png": "下载图片",
    "btn.webm": "下载视频(WebM)",
    "btn.randomMixAgain": "换一组混合",
    "status.clickStart": "请点击「开始新游戏」",
    "status.started": "开始！每次方向键会作用于全部图形",
    "status.playing": "进行中：{n} 步",
    "status.done": "完成！共 {n} 步，可播放动画并下载",
    "status.replay": "动画回放中…",
    "status.videoExporting": "正在导出视频…",
    "status.videoExportFail": "视频导出失败，请重试或换浏览器。",
    "status.videoDone": "视频导出完成",
    "action.rotateCW": "旋转+15°",
    "action.rotateCCW": "旋转-15°",
    "action.stretchX": "水平拉伸",
    "action.stretchY": "垂直拉伸",
    "action.compress": "整体压缩",
    "action.expand": "整体放大",
    "action.moveHue": "色相偏移",
    "action.alphaUp": "提高透明度",
    "action.alphaDown": "降低透明度",
    "action.jitter": "随机抖动",
    "action.trailBoost": "增强拖尾",
    "action.pulse": "脉冲变化",
    "action.shift": "位移",
    "action.split": "分裂（随机位置复制）",
    "shape.circle": "圆形",
    "shape.square": "方形",
    "shape.triangle": "三角形",
    "shape.diamond": "菱形",
    "shape.star": "星形",
    "shape.hexagon": "六边形",
    "shape.line": "直线",
    "shape.spiral": "螺旋线",
    "mat.solid": "纯色",
    "mat.gradient": "渐变",
    "mat.grain": "胶片颗粒",
    "mat.neon": "霓虹发光",
    "mat.wireframe": "线框",
    "mat.randomMix": "随机混合",
    "blend.source-over": "正常",
    "blend.screen": "滤色",
    "blend.multiply": "正片叠底",
    "blend.overlay": "叠加",
    "blend.difference": "差值/消除感",
    "blend.lighter": "线性减淡",
  },
  en: {
    "doc.title": "Graphic Maze",
    "header.title": "Graphic Maze",
    "header.tagline": "Define rules, then walk the maze to grow the visual.",
    "maze.start": "New game",
    "maze.regen": "Regenerate maze",
    "maze.hint": "Arrow keys: ↑ ↓ ← →",
    "maze.remindAdjust": "You can tune the middle panel before starting; “New game” begins a run with your current settings.",
    "maze.gallery": "Gallery",
    "maze.galleryTitle": "Finish-line gallery",
    "maze.galleryEmpty": "Each time you reach the goal, the final frame is saved here. Click a thumbnail to view it larger.",
    "maze.galleryCloseAria": "Close",
    "maze.galleryCloseBackdrop": "Close gallery",
    "maze.gallerySteps": "{n} steps",
    "maze.galleryClearAll": "Clear all",
    "maze.galleryExportSelected": "Export selected",
    "maze.galleryDeleteSelected": "Delete selected",
    "maze.galleryExportAll": "Export all",
    "maze.galleryConfirmClearAll": "Delete every saved finish image? This cannot be undone.",
    "maze.galleryConfirmDeleteSelected": "Delete {n} selected item(s)?",
    "maze.galleryNoneSelected": "Select one or more thumbnails first.",
    "maze.galleryExportZipFail": "Could not build a ZIP; downloading files one by one instead.",
    "group.mazeText": "Maze text (optional)",
    "group.textLayout": "Text placement",
    "group.replay": "Recording replay",
    "mazeText.placeholder": "Type text here; it stays inside the safe margins and changes with each arrow’s mapped action.",
    "label.playbackMute": "Mute replay audio",
    "panel.rules": "RULES / LIBRARY",
    "panel.preview": "Live preview",
    "group.shapeLib": "Shape library (multi-select)",
    "shapeColors.random": "Random colors",
    "group.shapeLayout": "Shape placement",
    "label.graphicOnionSkin": "Onion skin",
    "label.replayOnionSkin": "Replay onion skin",
    "shapeLayout.center": "Centered on canvas",
    "shapeLayout.random": "Random spread",
    "mazeText.more": "More (color, size & stroke)",
    "mazeText.sectionSize": "Text size",
    "label.mazeTextSize": "Size (% of auto layout)",
    "mazeText.sectionStyle": "Text style",
    "mazeText.sectionShapeStroke": "Shape stroke",
    "label.mazeTextStroke": "Text outline",
    "label.mazeTextColor": "Text color",
    "label.mazeTextStrokeColor": "Outline color",
    "label.mazeTextStrokeWidth": "Text outline width",
    "label.shapeStrokeWidth": "Shape outline width",
    "label.shapeStrokeColor": "Shape outline color",
    "group.rulesDir": "Arrow key actions",
    "group.bg": "Background",
    "rule.up": "↑ Up",
    "rule.down": "↓ Down",
    "rule.left": "← Left",
    "rule.right": "→ Right",
    "label.material": "Material",
    "label.blend": "Blend mode",
    "label.shapeSize": "Shape size",
    "label.grainStrength": "Film grain strength",
    "label.stroke": "Stroke",
    "label.playbackSpeed": "Speed",
    "status.replayPaused": "Replay paused",
    "replay.ariaFirst": "Jump to start",
    "replay.ariaPrev": "Previous frame",
    "replay.ariaPlay": "Play",
    "replay.ariaPause": "Pause",
    "replay.ariaNext": "Next frame",
    "replay.ariaLast": "Jump to end",
    "label.bgColor": "Background color",
    "label.bgTransparent": "Transparent BG",
    "label.bgImage": "Background image",
    "label.bgVideo": "Background video",
    "bg.more": "More (color, image & video)",
    "btn.png": "Download PNG",
    "btn.webm": "Download WebM",
    "btn.randomMixAgain": "Shuffle random mix",
    "status.clickStart": "Click “New game” to start",
    "status.started": "Go! Each arrow affects every shape",
    "status.playing": "Playing: {n} steps",
    "status.done": "Done in {n} steps — play or export",
    "status.replay": "Replaying…",
    "status.videoExporting": "Exporting video…",
    "status.videoExportFail": "Video export failed — try again or another browser.",
    "status.videoDone": "Video export finished",
    "action.rotateCW": "Rotate +15°",
    "action.rotateCCW": "Rotate −15°",
    "action.stretchX": "Stretch X",
    "action.stretchY": "Stretch Y",
    "action.compress": "Compress",
    "action.expand": "Expand",
    "action.moveHue": "Hue shift",
    "action.alphaUp": "More opacity",
    "action.alphaDown": "Less opacity",
    "action.jitter": "Jitter",
    "action.trailBoost": "Stronger trail",
    "action.pulse": "Pulse",
    "action.shift": "Shift position",
    "action.split": "Split (copy at random)",
    "shape.circle": "Circle",
    "shape.square": "Square",
    "shape.triangle": "Triangle",
    "shape.diamond": "Diamond",
    "shape.star": "Star",
    "shape.hexagon": "Hexagon",
    "shape.line": "Line",
    "shape.spiral": "Spiral",
    "mat.solid": "Solid",
    "mat.gradient": "Gradient",
    "mat.grain": "Film grain",
    "mat.neon": "Neon glow",
    "mat.wireframe": "Wireframe",
    "mat.randomMix": "Random mix",
    "blend.source-over": "Normal",
    "blend.screen": "Screen",
    "blend.multiply": "Multiply",
    "blend.overlay": "Overlay",
    "blend.difference": "Difference",
    "blend.lighter": "Lighter",
  },
};

let currentLang = localStorage.getItem("mazeLang") === "en" ? "en" : "zh";

function t(key) {
  const pack = I18N[currentLang];
  if (pack && pack[key]) return pack[key];
  return I18N.zh[key] || key;
}

function getActions() {
  return ACTION_IDS.map((id) => ({ id, label: t(`action.${id}`) }));
}

function getShapes() {
  return SHAPE_IDS.map((id) => ({ id, label: t(`shape.${id}`) }));
}

function getMaterials() {
  return MATERIAL_IDS.map((id) => ({ id, label: t(`mat.${id}`) }));
}

function getBlends() {
  return BLEND_IDS.map((id) => ({ id, label: t(`blend.${id}`) }));
}

function optionExists(select, value) {
  return Array.from(select.options).some((o) => o.value === value);
}

function refreshSelectLabels() {
  const prev = {
    ruleUp: ui.ruleUp.value,
    ruleDown: ui.ruleDown.value,
    ruleLeft: ui.ruleLeft.value,
    ruleRight: ui.ruleRight.value,
    material: ui.materialSelect.value,
    blend: ui.blendModeSelect.value,
  };
  const actions = getActions();
  populateSelect(ui.ruleUp, actions);
  populateSelect(ui.ruleDown, actions);
  populateSelect(ui.ruleLeft, actions);
  populateSelect(ui.ruleRight, actions);
  populateSelect(ui.materialSelect, getMaterials());
  populateSelect(ui.blendModeSelect, getBlends());
  ui.ruleUp.value = optionExists(ui.ruleUp, prev.ruleUp) ? prev.ruleUp : DEFAULTS.ruleUp;
  ui.ruleDown.value = optionExists(ui.ruleDown, prev.ruleDown) ? prev.ruleDown : DEFAULTS.ruleDown;
  ui.ruleLeft.value = optionExists(ui.ruleLeft, prev.ruleLeft) ? prev.ruleLeft : DEFAULTS.ruleLeft;
  ui.ruleRight.value = optionExists(ui.ruleRight, prev.ruleRight) ? prev.ruleRight : DEFAULTS.ruleRight;
  ui.materialSelect.value = optionExists(ui.materialSelect, prev.material) ? prev.material : DEFAULTS.material;
  ui.blendModeSelect.value = optionExists(ui.blendModeSelect, prev.blend) ? prev.blend : DEFAULTS.blend;
}

function applyLanguage() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  document.title = t("doc.title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const val = t(key);
    if (el.tagName === "BUTTON") el.textContent = val;
    else el.textContent = val;
  });
  if (ui.mazeTextInput) ui.mazeTextInput.placeholder = t("mazeText.placeholder");
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (!key) return;
    const val = t(key);
    el.setAttribute("aria-label", val);
    el.setAttribute("title", val);
  });
  updateReplayTransportUi();
  ui.langZh.classList.toggle("active", currentLang === "zh");
  ui.langEn.classList.toggle("active", currentLang === "en");
  refreshSelectLabels();
  renderShapeLibrary();
  renderShapeColorPalette();
  refreshMazeStatusI18n();
  syncRandomMixShuffleUi();
}

function refreshMazeStatusI18n() {
  if (window.__replayActive) {
    ui.mazeStatus.textContent = window.__replayPaused ? t("status.replayPaused") : t("status.replay");
    return;
  }
  if (game.running && !game.finished) {
    ui.mazeStatus.textContent =
      game.records.length === 0
        ? t("status.started")
        : t("status.playing").replace("{n}", String(game.records.length));
  } else if (game.finished) {
    ui.mazeStatus.textContent = t("status.done").replace("{n}", String(game.records.length));
  } else {
    ui.mazeStatus.textContent = t("status.clickStart");
  }
}

const mazeConfig = { cols: 10, rows: 10 };
const game = {
  maze: null,
  player: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  end: { x: 0, y: 0 },
  running: false,
  finished: false,
  records: [],
};

const assets = { bgImage: null, bgVideo: null };
const DEFAULTS = {
  ruleUp: "rotateCW",
  ruleDown: "compress",
  ruleLeft: "moveHue",
  ruleRight: "stretchX",
  material: "solid",
  blend: "source-over",
  shapeSize: "72",
  grainStrength: "42",
  strokeEnabled: false,
  strokeColor: "#ffffff",
  playbackSpeed: "1",
  bgColor: "#000000",
  transparentBg: false,
  playbackMute: false,
  shapePlacementMode: "center",
  textPlacementMode: "center",
  mazeTextSizeScale: "100",
  mazeTextStrokeEnabled: true,
  mazeTextColor: "#ffffff",
  mazeTextStrokeColor: "#000000",
  mazeTextStrokeWidth: "2.5",
  shapeStrokeWidth: "2",
  graphicOnionSkin: false,
  replayOnionSkin: true,
};

const SETTINGS_STORAGE_KEY = "mazeVisualCreatorSettingsV1";

function resetBackgroundMediaToDefault() {
  assets.bgImage = null;
  assets.bgVideo = null;
  try {
    bgVideoElement.pause();
    bgVideoElement.removeAttribute("src");
    bgVideoElement.load();
  } catch (_e) {
    /* ignore */
  }
  if (ui.bgImageInput) ui.bgImageInput.value = "";
  if (ui.bgVideoInput) ui.bgVideoInput.value = "";
}

/** 新的一局：重置文字变换，并按「文字位置」应用偏移 */
function resetMazeTextFxForLayoutMode() {
  mazeTextFx = createDefaultMazeTextFx();
  if (textPlacementMode === "center") centerMazeTextOffsets();
  else randomizeMazeTextOffsets();
}

const DEFAULT_SHAPE_LIBRARY = ["circle", "square", "triangle", "star"];

const DEFAULT_SHAPE_COLORS = {
  circle: "#6fa8ff",
  square: "#ff8ea1",
  triangle: "#8fffc0",
  diamond: "#ffd17d",
  star: "#c69dff",
  hexagon: "#7de3ff",
  line: "#ffffff",
  spiral: "#ffa9e6",
};

let activeShapeLibrary = [...DEFAULT_SHAPE_LIBRARY];
let shapeColors = { ...DEFAULT_SHAPE_COLORS };
let visualShapes = [];
let shapeTrailCanvas;
let shapeTrailCtx;

/** Web Audio：四向键四种音色，行走与回放共用 */
let audioCtx = null;
function resumeAudioContext() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

const DIRECTION_SOUNDS = {
  up: { freq: 740, type: "sine", dur: 0.075, gain: 0.11 },
  down: { freq: 210, type: "triangle", dur: 0.095, gain: 0.13 },
  left: { freq: 400, type: "square", dur: 0.06, gain: 0.07 },
  right: { freq: 560, type: "sawtooth", dur: 0.06, gain: 0.075 },
};

function connectDirectionSound(ctx, outNode, direction, startTime) {
  if (!direction || !ctx || !outNode) return;
  const p = DIRECTION_SOUNDS[direction];
  if (!p) return;
  const t0 = startTime;
  const osc = ctx.createOscillator();
  const gn = ctx.createGain();
  osc.type = p.type;
  osc.frequency.setValueAtTime(p.freq, t0);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(p.gain, t0 + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + p.dur);
  osc.connect(gn);
  gn.connect(outNode);
  osc.start(t0);
  osc.stop(t0 + p.dur + 0.03);
}

function playDirectionSound(direction) {
  if (!direction) return;
  resumeAudioContext();
  if (!audioCtx) return;
  connectDirectionSound(audioCtx, audioCtx.destination, direction, audioCtx.currentTime);
}

function setupViewCanvases() {
  const ratio = window.devicePixelRatio || 1;
  viewDpr = Math.min(3.25, Math.max(ratio * 1.35, ratio));
  visualCanvas.width = Math.round(VIEW_LOGICAL_W * viewDpr);
  visualCanvas.height = Math.round(VIEW_LOGICAL_H * viewDpr);
  visualCtx.setTransform(viewDpr, 0, 0, viewDpr, 0, 0);
  visualCtx.imageSmoothingEnabled = true;
  visualCtx.imageSmoothingQuality = "high";
  if (!shapeTrailCanvas) {
    shapeTrailCanvas = document.createElement("canvas");
    shapeTrailCtx = shapeTrailCanvas.getContext("2d");
  }
  shapeTrailCanvas.width = visualCanvas.width;
  shapeTrailCanvas.height = visualCanvas.height;
  shapeTrailCtx.setTransform(viewDpr, 0, 0, viewDpr, 0, 0);
  shapeTrailCtx.imageSmoothingEnabled = true;
  shapeTrailCtx.imageSmoothingQuality = "high";
}

function setupMazeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  mazeDpr = Math.min(3, Math.max(ratio * 1.25, ratio));
  mazeCanvas.width = Math.round(MAZE_LOGICAL * mazeDpr);
  mazeCanvas.height = Math.round(MAZE_LOGICAL * mazeDpr);
  mazeCtx.setTransform(mazeDpr, 0, 0, mazeDpr, 0, 0);
  mazeCtx.imageSmoothingEnabled = true;
  mazeCtx.imageSmoothingQuality = "high";
}

/** 复用的小型噪点瓦片，用于胶片感颗粒（非单像素硬点） */
let grainNoiseTile = null;

function getGrainNoisePattern(ctx) {
  if (!grainNoiseTile) {
    grainNoiseTile = document.createElement("canvas");
    const w = 112;
    const h = 112;
    grainNoiseTile.width = w;
    grainNoiseTile.height = h;
    const nctx = grainNoiseTile.getContext("2d");
    const im = nctx.createImageData(w, h);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      im.data[i] = v;
      im.data[i + 1] = v;
      im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    nctx.putImageData(im, 0, 0);
  }
  try {
    return ctx.createPattern(grainNoiseTile, "repeat");
  } catch (_e) {
    return null;
  }
}

function applyFilmGrainInClip(ctx, hue, sat) {
  const strength = Number(ui.grainStrengthRange.value || DEFAULTS.grainStrength) / 100;
  if (strength < 0.04) return;
  const pat = getGrainNoisePattern(ctx);
  if (!pat) return;
  const ox = ((hue * 0.37) % 19) - 9;
  const oy = ((hue * 0.21 + sat * 0.11) % 17) - 8;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = pat;
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = Math.min(0.62, 0.14 + strength * 0.52);
  ctx.fillRect(-360, -360, 720, 720);
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = Math.min(0.5, 0.1 + strength * 0.42);
  ctx.translate(23, -11);
  ctx.fillRect(-360, -360, 720, 720);
  ctx.restore();
}

function stopPlayback(exitReplaySession = true) {
  if (window.__playTimer) {
    clearInterval(window.__playTimer);
    window.__playTimer = null;
  }
  if (exitReplaySession) {
    window.__replayActive = false;
    window.__replayPaused = false;
  }
  updateReplayTransportUi();
  refreshMazeStatusI18n();
}

function getReplaySpeed() {
  const v = Number(ui.playbackSpeedRange?.value);
  if (Number.isFinite(v) && v > 0) return Math.min(3, Math.max(0.05, v));
  return 1;
}

function replayIntervalMs() {
  const baseFps = 24;
  const spd = getReplaySpeed();
  return Math.max(8, 1000 / (baseFps * spd));
}

function updateReplayTransportUi() {
  const hasRec = game.records && game.records.length > 0;
  const btns = [ui.replayBtnFirst, ui.replayBtnPrev, ui.replayBtnNext, ui.replayBtnLast];
  btns.forEach((btn) => {
    if (btn) btn.disabled = !hasRec;
  });
  const pp = ui.replayBtnPlayPause;
  if (pp) {
    pp.disabled = !hasRec;
    const playing = Boolean(window.__replayActive && !window.__replayPaused && window.__playTimer);
    pp.classList.toggle("is-playing", playing);
    pp.setAttribute("aria-label", playing ? t("replay.ariaPause") : t("replay.ariaPlay"));
    pp.setAttribute("title", playing ? t("replay.ariaPause") : t("replay.ariaPlay"));
  }
}

/**
 * 将某一回放索引画到 targetCtx。targetCtx 当前变换须为 (viewDpr * pixelScale) 的均匀缩放。
 * pixelScale=1 与屏幕预览一致；导出视频时用 2 提高像素密度。
 */
function renderReplayFrameOntoContext(targetCtx, pixelScale, displayIndex, opts = { playSound: false }) {
  const n = game.records.length;
  if (!n) return;
  const i = ((displayIndex % n) + n) % n;
  const rec = game.records[i];
  if (opts.playSound && rec.direction && !ui.playbackMute.checked) playDirectionSound(rec.direction);
  const ps = Math.max(1, Math.min(3, pixelScale));
  drawBackgroundToCtx(targetCtx);
  const replayLayer = document.createElement("canvas");
  replayLayer.width = Math.round(VIEW_LOGICAL_W * viewDpr * ps);
  replayLayer.height = Math.round(VIEW_LOGICAL_H * viewDpr * ps);
  const replayCtx = replayLayer.getContext("2d");
  replayCtx.setTransform(viewDpr * ps, 0, 0, viewDpr * ps, 0, 0);
  replayCtx.imageSmoothingEnabled = true;
  replayCtx.imageSmoothingQuality = "high";
  replayCtx.clearRect(0, 0, VIEW_LOGICAL_W, VIEW_LOGICAL_H);
  if (ui.replayOnionSkin?.checked) {
    const onionCount = 5;
    for (let t = onionCount; t >= 1; t -= 1) {
      const idx = i - t;
      if (idx < 0) continue;
      const prev = game.records[idx];
      const ghostShapes = prev.shapes.map((s) => ({ ...s, alpha: Math.max(0.05, s.alpha * (0.12 * (onionCount - t + 1))) }));
      drawFrameShapes(replayCtx, ghostShapes, prev.colors, prev.material, prev.blend);
    }
  }
  drawFrameShapes(replayCtx, rec.shapes, rec.colors, rec.material, rec.blend);
  targetCtx.globalCompositeOperation = "source-over";
  targetCtx.drawImage(replayLayer, 0, 0, VIEW_LOGICAL_W, VIEW_LOGICAL_H);
  drawMazeOverlayText(targetCtx, ui.mazeTextInput ? ui.mazeTextInput.value : "", textFxFromRecord(rec));
}

function renderOneReplayFrame(displayIndex, opts = { playSound: false }) {
  const n = game.records.length;
  if (!n) return;
  renderReplayFrameOntoContext(visualCtx, 1, displayIndex, opts);
}

function replayTick() {
  const n = game.records.length;
  if (!n || !window.__replayActive || window.__replayPaused) return;
  window.__replayShown = (window.__replayShown + 1) % n;
  renderOneReplayFrame(window.__replayShown, { playSound: true });
}

function startReplayTimer() {
  if (window.__playTimer) {
    clearInterval(window.__playTimer);
    window.__playTimer = null;
  }
  if (!window.__replayActive || window.__replayPaused || !game.records.length) return;
  window.__playTimer = setInterval(replayTick, replayIntervalMs());
}

function restartReplayTimerIfPlaying() {
  if (!window.__replayActive || window.__replayPaused) return;
  startReplayTimer();
}

function pauseReplay() {
  if (!window.__replayActive) return;
  window.__replayPaused = true;
  if (window.__playTimer) {
    clearInterval(window.__playTimer);
    window.__playTimer = null;
  }
  updateReplayTransportUi();
  refreshMazeStatusI18n();
}

function resumeReplay() {
  if (!window.__replayActive || !game.records.length) return;
  window.__replayPaused = false;
  startReplayTimer();
  updateReplayTransportUi();
  refreshMazeStatusI18n();
}

function replayScrubToFrame(frameIndex) {
  if (!game.records.length) return;
  const n = game.records.length;
  const idx = ((frameIndex % n) + n) % n;
  if (window.__playTimer) {
    clearInterval(window.__playTimer);
    window.__playTimer = null;
  }
  window.__replayActive = true;
  window.__replayPaused = true;
  window.__replayShown = idx;
  renderOneReplayFrame(idx, { playSound: false });
  updateReplayTransportUi();
  refreshMazeStatusI18n();
}

async function startReplaySession() {
  if (!game.records.length) return;
  stopPlayback(true);
  resumeAudioContext();
  window.__replayActive = true;
  window.__replayPaused = false;
  window.__replayShown = 0;
  ui.mazeStatus.textContent = t("status.replay");
  if (assets.bgVideo) {
    try {
      await assets.bgVideo.play();
    } catch (_err) {}
  }
  renderOneReplayFrame(0, { playSound: false });
  startReplayTimer();
  updateReplayTransportUi();
}

function onReplayPlayPauseClick() {
  if (!game.records.length) return;
  if (!window.__replayActive) {
    startReplaySession();
    return;
  }
  if (!window.__replayPaused) pauseReplay();
  else resumeReplay();
}

function populateSelect(select, items) {
  select.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    select.appendChild(option);
  });
}

function initUi() {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (_e) {
    /* private mode or blocked */
  }
  resetBackgroundMediaToDefault();
  activeShapeLibrary = [...DEFAULT_SHAPE_LIBRARY];
  shapeColors = { ...DEFAULT_SHAPE_COLORS };
  if (ui.mazeTextInput) ui.mazeTextInput.value = "";
  document.getElementById("mazeTextMoreDetails")?.removeAttribute("open");
  document.getElementById("bgMoreDetails")?.removeAttribute("open");

  populateSelect(ui.ruleUp, getActions());
  populateSelect(ui.ruleDown, getActions());
  populateSelect(ui.ruleLeft, getActions());
  populateSelect(ui.ruleRight, getActions());
  populateSelect(ui.materialSelect, getMaterials());
  populateSelect(ui.blendModeSelect, getBlends());
  ui.ruleUp.value = DEFAULTS.ruleUp;
  ui.ruleDown.value = DEFAULTS.ruleDown;
  ui.ruleLeft.value = DEFAULTS.ruleLeft;
  ui.ruleRight.value = DEFAULTS.ruleRight;
  ui.materialSelect.value = DEFAULTS.material;
  ui.blendModeSelect.value = DEFAULTS.blend;
  ui.shapeSizeRange.value = DEFAULTS.shapeSize;
  ui.grainStrengthRange.value = DEFAULTS.grainStrength;
  ui.strokeEnabled.checked = DEFAULTS.strokeEnabled;
  ui.strokeColorInput.value = DEFAULTS.strokeColor;
  ui.playbackSpeedRange.value = DEFAULTS.playbackSpeed;
  ui.playbackMute.checked = DEFAULTS.playbackMute;
  ui.bgColorInput.value = DEFAULTS.bgColor;
  ui.transparentBg.checked = DEFAULTS.transparentBg;
  shapePlacementMode = DEFAULTS.shapePlacementMode;
  textPlacementMode = DEFAULTS.textPlacementMode;
  if (ui.mazeTextSizeRange) ui.mazeTextSizeRange.value = DEFAULTS.mazeTextSizeScale;
  if (ui.mazeTextStrokeEnabled) ui.mazeTextStrokeEnabled.checked = DEFAULTS.mazeTextStrokeEnabled;
  if (ui.mazeTextColorInput) ui.mazeTextColorInput.value = DEFAULTS.mazeTextColor;
  if (ui.mazeTextStrokeColorInput) ui.mazeTextStrokeColorInput.value = DEFAULTS.mazeTextStrokeColor;
  if (ui.mazeTextStrokeWidthRange) ui.mazeTextStrokeWidthRange.value = DEFAULTS.mazeTextStrokeWidth;
  if (ui.shapeStrokeWidthRange) ui.shapeStrokeWidthRange.value = DEFAULTS.shapeStrokeWidth;
  if (ui.graphicOnionSkin) ui.graphicOnionSkin.checked = DEFAULTS.graphicOnionSkin;
  if (ui.replayOnionSkin) ui.replayOnionSkin.checked = DEFAULTS.replayOnionSkin;
  syncShapeLayoutButtons();
  syncTextLayoutButtons();
  applyLanguage();
}

function renderShapeLibrary() {
  ui.shapeLibrary.innerHTML = "";
  getShapes().forEach((shape) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `shape-chip${activeShapeLibrary.includes(shape.id) ? " active" : ""}`;
    chip.textContent = shape.label;
    chip.addEventListener("click", () => toggleShapeLibrary(shape.id));
    ui.shapeLibrary.appendChild(chip);
  });
}

function renderShapeColorPalette() {
  ui.shapeColorPalette.innerHTML = "";
  activeShapeLibrary.forEach((shapeId) => {
    const shape = getShapes().find((item) => item.id === shapeId);
    const row = document.createElement("div");
    row.className = "shape-color-item";
    const name = document.createElement("span");
    name.textContent = shape ? shape.label : shapeId;
    const color = document.createElement("input");
    color.type = "color";
    color.value = shapeColors[shapeId] || "#6fa8ff";
    color.addEventListener("input", (e) => {
      shapeColors[shapeId] = e.target.value;
      stopPlayback();
      drawVisual(true);
    });
    color.addEventListener("change", (e) => {
      shapeColors[shapeId] = e.target.value;
      stopPlayback();
      drawVisual(true);
    });
    row.appendChild(name);
    row.appendChild(color);
    ui.shapeColorPalette.appendChild(row);
  });
}

function toggleShapeLibrary(shapeId) {
  const exists = activeShapeLibrary.includes(shapeId);
  if (exists && activeShapeLibrary.length === 1) return;
  if (exists) activeShapeLibrary = activeShapeLibrary.filter((id) => id !== shapeId);
  else activeShapeLibrary = [...activeShapeLibrary, shapeId];
  stopPlayback();
  resetVisualShapes();
  renderShapeLibrary();
  renderShapeColorPalette();
  drawVisual(true);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function resetVisualShapes() {
  const baseSize = Number(ui.shapeSizeRange.value || DEFAULTS.shapeSize);
  const cx = VIEW_LOGICAL_W / 2;
  const cy = VIEW_LOGICAL_H / 2;
  const n = Math.max(1, activeShapeLibrary.length);
  const layout = shapePlacementMode;
  visualShapes = activeShapeLibrary.map((shapeId, idx) => {
    let x;
    let y;
    if (layout === "random") {
      x = randomBetween(90, VIEW_LOGICAL_W - 90);
      y = randomBetween(90, VIEW_LOGICAL_H - 90);
    } else {
      const angle = (idx / n) * Math.PI * 2 + randomBetween(-0.25, 0.25);
      const ring = randomBetween(0.3, 1) * Math.min(70, 28 + n * 11);
      x = cx + Math.cos(angle) * ring + randomBetween(-14, 14);
      y = cy + Math.sin(angle) * ring + randomBetween(-12, 12);
    }
    const state = {
      shape: shapeId,
      x,
      y,
      size: randomBetween(baseSize * 0.86, baseSize * 1.12),
      rotation: randomBetween(-0.5, 0.5),
      scaleX: 1,
      scaleY: 1,
      hueShift: 0,
      alpha: 1,
      trail: 0.12,
    };
    clampShape(state);
    return state;
  });
  if (ui.materialSelect.value === "randomMix") assignRandomMixPairsToVisualShapes();
  else clearMaterialMixOnVisualShapes();
}

function repositionShapesRandomOnce() {
  if (!visualShapes.length) return;
  visualShapes.forEach((state) => {
    state.x = randomBetween(90, VIEW_LOGICAL_W - 90);
    state.y = randomBetween(90, VIEW_LOGICAL_H - 90);
    clampShape(state);
  });
}

function repositionShapesCenteredInView() {
  if (!visualShapes.length) return;
  const cx = VIEW_LOGICAL_W / 2;
  const cy = VIEW_LOGICAL_H / 2;
  const n = Math.max(1, visualShapes.length);
  visualShapes.forEach((state, idx) => {
    const angle = (idx / n) * Math.PI * 2 + randomBetween(-0.25, 0.25);
    const ring = randomBetween(0.3, 1) * Math.min(70, 28 + n * 11);
    state.x = cx + Math.cos(angle) * ring + randomBetween(-14, 14);
    state.y = cy + Math.sin(angle) * ring + randomBetween(-12, 12);
    clampShape(state);
  });
}

function createMaze(cols, rows) {
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      walls: { top: true, right: true, bottom: true, left: true },
      visited: false,
    })),
  );
  const stack = [[0, 0]];
  cells[0][0].visited = true;
  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors = [];
    if (cy > 0 && !cells[cy - 1][cx].visited) neighbors.push(["top", cx, cy - 1]);
    if (cx < cols - 1 && !cells[cy][cx + 1].visited) neighbors.push(["right", cx + 1, cy]);
    if (cy < rows - 1 && !cells[cy + 1][cx].visited) neighbors.push(["bottom", cx, cy + 1]);
    if (cx > 0 && !cells[cy][cx - 1].visited) neighbors.push(["left", cx - 1, cy]);
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const [dir, nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
    const current = cells[cy][cx];
    const next = cells[ny][nx];
    current.walls[dir] = false;
    if (dir === "top") next.walls.bottom = false;
    if (dir === "right") next.walls.left = false;
    if (dir === "bottom") next.walls.top = false;
    if (dir === "left") next.walls.right = false;
    next.visited = true;
    stack.push([nx, ny]);
  }
  return cells;
}

function resetGame() {
  stopPlayback();
  game.maze = createMaze(mazeConfig.cols, mazeConfig.rows);
  game.start = { x: 0, y: 0 };
  game.end = { x: mazeConfig.cols - 1, y: mazeConfig.rows - 1 };
  game.player = { ...game.start };
  game.running = false;
  game.finished = false;
  game.records = [];
  resetMazeTextFxForLayoutMode();
  resetVisualShapes();
  ui.mazeStatus.textContent = t("status.clickStart");
  drawMaze();
  drawVisual(true);
}

function drawMaze() {
  const { cols, rows } = mazeConfig;
  const cw = MAZE_LOGICAL / cols;
  const ch = MAZE_LOGICAL / rows;
  mazeCtx.clearRect(0, 0, MAZE_LOGICAL, MAZE_LOGICAL);
  mazeCtx.fillStyle = "#0a0a0a";
  mazeCtx.fillRect(0, 0, MAZE_LOGICAL, MAZE_LOGICAL);
  mazeCtx.strokeStyle = "rgba(255,255,255,0.25)";
  mazeCtx.lineWidth = 1.6;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = game.maze[y][x];
      const px = x * cw;
      const py = y * ch;
      if (cell.walls.top) line(px, py, px + cw, py);
      if (cell.walls.right) line(px + cw, py, px + cw, py + ch);
      if (cell.walls.bottom) line(px, py + ch, px + cw, py + ch);
      if (cell.walls.left) line(px, py, px, py + ch);
    }
  }
  paintCell(game.start, "rgba(255,255,255,0.25)");
  paintCell(game.end, "rgba(255,255,255,0.1)");
  paintCell(game.player, "rgba(255,255,255,0.9)", { circle: true });
  function line(x1, y1, x2, y2) {
    mazeCtx.beginPath();
    mazeCtx.moveTo(x1, y1);
    mazeCtx.lineTo(x2, y2);
    mazeCtx.stroke();
  }
  function paintCell(cellPos, color, opts) {
    const px = cellPos.x * cw;
    const py = cellPos.y * ch;
    if (opts && opts.circle) {
      const cx = px + cw / 2;
      const cy = py + ch / 2;
      const r = Math.min(cw, ch) * 0.3;
      mazeCtx.beginPath();
      mazeCtx.arc(cx, cy, r, 0, Math.PI * 2);
      mazeCtx.fillStyle = color;
      mazeCtx.fill();
      return;
    }
    mazeCtx.fillStyle = color;
    mazeCtx.fillRect(px + cw * 0.2, py + ch * 0.2, cw * 0.6, ch * 0.6);
  }
}

function hexToHsl(hex) {
  const clean = hex.replace("#", "");
  const bigint = Number.parseInt(clean, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 220, s: 90, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h / 6) * 360, s: s * 100, l: l * 100 };
}

/** 将 HSL（h:0–360, s/l:0–100）转为 #rrggbb，用于随机图形色 */
function hslToRgbHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n) => {
    const k = (n + hh / 30) % 12;
    const c = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(Math.min(255, Math.max(0, c * 255)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function randomShapeFillHex() {
  const h = Math.random() * 360;
  const s = 50 + Math.random() * 45;
  const lv = 38 + Math.random() * 32;
  return hslToRgbHex(h, s, lv);
}

function randomizeActiveShapeColors() {
  activeShapeLibrary.forEach((id) => {
    shapeColors[id] = randomShapeFillHex();
  });
}

function applyAction(actionId, target) {
  switch (actionId) {
    case "rotateCW":
      target.rotation += Math.PI / 12;
      break;
    case "rotateCCW":
      target.rotation -= Math.PI / 12;
      break;
    case "stretchX":
      target.scaleX = Math.min(2.2, target.scaleX + 0.08);
      target.scaleY = Math.max(0.4, target.scaleY - 0.03);
      break;
    case "stretchY":
      target.scaleY = Math.min(2.2, target.scaleY + 0.08);
      target.scaleX = Math.max(0.4, target.scaleX - 0.03);
      break;
    case "compress":
      // 压缩=压扁，不做整体缩小
      if (Math.random() > 0.5) {
        target.scaleX = Math.max(0.35, target.scaleX * 0.86);
        target.scaleY = Math.min(2.8, target.scaleY * 1.06);
      } else {
        target.scaleY = Math.max(0.35, target.scaleY * 0.86);
        target.scaleX = Math.min(2.8, target.scaleX * 1.06);
      }
      break;
    case "expand":
      target.scaleX = Math.min(2.8, target.scaleX * 1.07);
      target.scaleY = Math.min(2.8, target.scaleY * 1.07);
      target.size = Math.min(180, target.size + 2);
      break;
    case "moveHue":
      target.hueShift = (target.hueShift + 18) % 360;
      break;
    case "alphaUp":
      target.alpha = Math.min(1, target.alpha + 0.07);
      break;
    case "alphaDown":
      target.alpha = Math.max(0.15, target.alpha - 0.07);
      break;
    case "jitter":
      target.x += Math.random() * 30 - 15;
      target.y += Math.random() * 30 - 15;
      break;
    case "trailBoost":
      target.trail = Math.min(0.4, target.trail + 0.05);
      break;
    case "pulse":
      target.size += Math.sin(Date.now() / 70) * 6;
      break;
    case "shift":
      target.x += randomBetween(-48, 48);
      target.y += randomBetween(-48, 48);
      break;
    default:
      break;
  }
}

function splitShape(target) {
  if (!target || visualShapes.length >= 28) return;
  const childSize = Math.max(22, target.size * randomBetween(0.65, 0.82));
  const pad = Math.max(30, childSize * 0.4);
  const xMin = pad;
  const xMax = VIEW_LOGICAL_W - pad;
  const yMin = pad;
  const yMax = VIEW_LOGICAL_H - pad;
  const child = {
    ...target,
    x: xMax > xMin ? randomBetween(xMin, xMax) : VIEW_LOGICAL_W / 2,
    y: yMax > yMin ? randomBetween(yMin, yMax) : VIEW_LOGICAL_H / 2,
    size: childSize,
    rotation: target.rotation + randomBetween(-0.7, 0.7),
    alpha: Math.max(0.35, target.alpha * 0.96),
  };
  if (ui.materialSelect.value === "randomMix") {
    child.materialMixPair = pickRandomMaterialPair();
  } else {
    delete child.materialMixPair;
  }
  clampShape(child);
  visualShapes.push(child);
}

function clampShape(shapeState) {
  const pad = Math.max(30, shapeState.size * 0.4);
  shapeState.x = Math.max(pad, Math.min(VIEW_LOGICAL_W - pad, shapeState.x));
  shapeState.y = Math.max(pad, Math.min(VIEW_LOGICAL_H - pad, shapeState.y));
}

function syncShapeLayoutButtons() {
  ui.shapeLayoutCenterBtn?.classList.toggle("shape-layout-btn--active", shapePlacementMode === "center");
  ui.shapeLayoutRandomBtn?.classList.toggle("shape-layout-btn--active", shapePlacementMode === "random");
}

function syncTextLayoutButtons() {
  ui.textLayoutCenterBtn?.classList.toggle("shape-layout-btn--active", textPlacementMode === "center");
  ui.textLayoutRandomBtn?.classList.toggle("shape-layout-btn--active", textPlacementMode === "random");
}

/** 文字 offset 相对安全区中心的最大绝对值（与 clampMazeTextFx 一致） */
function getMazeTextOffsetBounds() {
  const pad = getTextPads();
  const innerW = VIEW_LOGICAL_W - pad.left - pad.right;
  const innerH = VIEW_LOGICAL_H - pad.top - pad.bottom;
  return {
    maxOx: Math.max(0, innerW * 0.38),
    maxOy: Math.max(0, innerH * 0.38),
  };
}

function centerMazeTextOffsets() {
  mazeTextFx.offsetX = 0;
  mazeTextFx.offsetY = 0;
  clampMazeTextFx();
}

function randomizeMazeTextOffsets() {
  const { maxOx, maxOy } = getMazeTextOffsetBounds();
  if (maxOx <= 0 && maxOy <= 0) return;
  mazeTextFx.offsetX = maxOx > 0 ? randomBetween(-maxOx, maxOx) : 0;
  mazeTextFx.offsetY = maxOy > 0 ? randomBetween(-maxOy, maxOy) : 0;
  clampMazeTextFx();
}

/** 边距过大时内框宽高会变成负数，进而让缩放系数为负导致文字镜像/上下颠倒 */
function clampTextPads(top, bottom, left, right) {
  let t = top;
  let b = bottom;
  let l = left;
  let r = right;
  const minInnerH = 24;
  const minInnerW = 48;
  const maxSumV = VIEW_LOGICAL_H - minInnerH;
  const maxSumW = VIEW_LOGICAL_W - minInnerW;
  if (t + b > maxSumV && t + b > 0) {
    const s = maxSumV / (t + b);
    t *= s;
    b *= s;
  }
  if (l + r > maxSumW && l + r > 0) {
    const s = maxSumW / (l + r);
    l *= s;
    r *= s;
  }
  return { top: t, bottom: b, left: l, right: r };
}

/** 文字安全区边距（固定值，与画布比例一致） */
function getTextPads() {
  return clampTextPads(32, 32, 32, 32);
}

function getMazeTextFontSizePercent() {
  const v = Number(ui.mazeTextSizeRange?.value ?? DEFAULTS.mazeTextSizeScale);
  if (!Number.isFinite(v)) return 1;
  return Math.max(0.45, Math.min(2.2, v / 100));
}

function getShapeStrokeLineWidth() {
  const v = Number(ui.shapeStrokeWidthRange?.value ?? DEFAULTS.shapeStrokeWidth);
  return Math.max(0.5, Math.min(16, Number.isFinite(v) ? v : 2));
}

function getMazeTextStrokeWidthPx() {
  const v = Number(ui.mazeTextStrokeWidthRange?.value ?? DEFAULTS.mazeTextStrokeWidth);
  return Math.max(0.25, Math.min(12, Number.isFinite(v) ? v : 2.5));
}

function normalizeOverlayText(text) {
  return (text || "")
    .trim()
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function clampMazeTextFx() {
  const { maxOx, maxOy } = getMazeTextOffsetBounds();
  mazeTextFx.offsetX = Math.max(-maxOx, Math.min(maxOx, mazeTextFx.offsetX));
  mazeTextFx.offsetY = Math.max(-maxOy, Math.min(maxOy, mazeTextFx.offsetY));
  mazeTextFx.scaleX = Math.max(0.22, Math.min(2.6, mazeTextFx.scaleX));
  mazeTextFx.scaleY = Math.max(0.22, Math.min(2.6, mazeTextFx.scaleY));
  mazeTextFx.rotation = ((mazeTextFx.rotation + Math.PI * 8) % (Math.PI * 2)) - Math.PI;
  mazeTextFx.fontBoost = Math.max(0, Math.min(40, mazeTextFx.fontBoost));
  mazeTextFx.alpha = Math.max(0.12, Math.min(1, mazeTextFx.alpha));
}

/** 与图形相同：按方向键映射的动作驱动文字变换（不沿迷宫路径弯曲） */
function applyActionToMazeText(actionId) {
  const fx = mazeTextFx;
  switch (actionId) {
    case "rotateCW":
      fx.rotation += Math.PI / 12;
      break;
    case "rotateCCW":
      fx.rotation -= Math.PI / 12;
      break;
    case "stretchX":
      fx.scaleX = Math.min(2.2, fx.scaleX + 0.08);
      fx.scaleY = Math.max(0.4, fx.scaleY - 0.03);
      break;
    case "stretchY":
      fx.scaleY = Math.min(2.2, fx.scaleY + 0.08);
      fx.scaleX = Math.max(0.4, fx.scaleX - 0.03);
      break;
    case "compress":
      if (Math.random() > 0.5) {
        fx.scaleX = Math.max(0.35, fx.scaleX * 0.86);
        fx.scaleY = Math.min(2.8, fx.scaleY * 1.06);
      } else {
        fx.scaleY = Math.max(0.35, fx.scaleY * 0.86);
        fx.scaleX = Math.min(2.8, fx.scaleX * 1.06);
      }
      break;
    case "expand":
      fx.scaleX = Math.min(2.8, fx.scaleX * 1.07);
      fx.scaleY = Math.min(2.8, fx.scaleY * 1.07);
      fx.fontBoost = Math.min(40, fx.fontBoost + 1.4);
      break;
    case "moveHue":
      fx.hueShift = (fx.hueShift + 18) % 360;
      break;
    case "alphaUp":
      fx.alpha = Math.min(1, fx.alpha + 0.07);
      break;
    case "alphaDown":
      fx.alpha = Math.max(0.12, fx.alpha - 0.07);
      break;
    case "jitter":
      fx.offsetX += Math.random() * 26 - 13;
      fx.offsetY += Math.random() * 26 - 13;
      break;
    case "trailBoost":
      break;
    case "pulse":
      fx.fontBoost += Math.sin(Date.now() / 70) * 0.55;
      break;
    case "shift":
      fx.offsetX += randomBetween(-44, 44);
      fx.offsetY += randomBetween(-44, 44);
      break;
    case "split":
      break;
    default:
      break;
  }
  clampMazeTextFx();
}

/** 整句文字画在边距内的安全区中心，并按 mazeTextFx 做仿射；必要时整体缩小以不越界 */
function drawMazeOverlayText(ctx, text, fxSource) {
  const raw = normalizeOverlayText(text);
  if (!raw) return;
  const fx = fxSource || mazeTextFx;
  const pad = getTextPads();
  const inner = {
    x: pad.left,
    y: pad.top,
    w: VIEW_LOGICAL_W - pad.left - pad.right,
    h: VIEW_LOGICAL_H - pad.top - pad.bottom,
  };
  if (inner.w < 48 || inner.h < 24) return;

  const baseFont = Math.max(10, Math.min(26, 10 + inner.w / (Math.max(6, raw.length * 3.1))));
  const fontScale = getMazeTextFontSizePercent();
  const fontSize = Math.min(52, Math.max(7, (baseFont + (fx.fontBoost || 0)) * fontScale));
  ctx.save();
  ctx.font = `600 ${fontSize}px "Courier New", monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const tw = ctx.measureText(raw).width || 1;
  const th = fontSize * 1.18;
  let sx = Math.abs(fx.scaleX || 1);
  let sy = Math.abs(fx.scaleY || 1);
  const maxSx = Math.max(1e-6, (inner.w * 0.94) / tw);
  const maxSy = Math.max(1e-6, (inner.h * 0.94) / th);
  sx = Math.min(sx, maxSx);
  sy = Math.min(sy, maxSy);
  const k = Math.min(1, (inner.w * 0.96) / (tw * sx || 1), (inner.h * 0.96) / (th * sy || 1));
  sx *= k;
  sy *= k;

  let cx = inner.x + inner.w / 2 + (fx.offsetX || 0);
  let cy = inner.y + inner.h / 2 + (fx.offsetY || 0);
  const hw = (tw * sx) / 2;
  const hh = (th * sy) / 2;
  cx = Math.min(inner.x + inner.w - hw - 1, Math.max(inner.x + hw + 1, cx));
  cy = Math.min(inner.y + inner.h - hh - 1, Math.max(inner.y + hh + 1, cy));

  ctx.translate(cx, cy);
  ctx.rotate(fx.rotation || 0);
  ctx.scale(sx, sy);
  ctx.globalAlpha = fx.alpha != null ? fx.alpha : 1;
  ctx.filter = `hue-rotate(${fx.hueShift || 0}deg)`;
  const fillCol = ui.mazeTextColorInput?.value || "#ffffff";
  const strokeCol = ui.mazeTextStrokeColorInput?.value || "#000000";
  const strokeOn = ui.mazeTextStrokeEnabled ? ui.mazeTextStrokeEnabled.checked : true;
  ctx.fillStyle = fillCol;
  if (strokeOn) {
    const pen = getMazeTextStrokeWidthPx();
    const scaleRef = Math.max(Math.abs(sx), Math.abs(sy), 1e-4);
    ctx.lineWidth = pen / scaleRef;
    ctx.strokeStyle = strokeCol;
    ctx.strokeText(raw, 0, 0);
  }
  ctx.fillText(raw, 0, 0);
  ctx.restore();
}

function drawBackgroundToCtx(ctx) {
  if (ui.transparentBg.checked) {
    ctx.clearRect(0, 0, VIEW_LOGICAL_W, VIEW_LOGICAL_H);
    return;
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = ui.bgColorInput.value;
  ctx.fillRect(0, 0, VIEW_LOGICAL_W, VIEW_LOGICAL_H);
  if (assets.bgImage) {
    ctx.globalAlpha = 0.8;
    ctx.drawImage(assets.bgImage, 0, 0, VIEW_LOGICAL_W, VIEW_LOGICAL_H);
    ctx.globalAlpha = 1;
  }
  if (assets.bgVideo) {
    ctx.globalAlpha = 0.55;
    ctx.drawImage(assets.bgVideo, 0, 0, VIEW_LOGICAL_W, VIEW_LOGICAL_H);
    ctx.globalAlpha = 1;
  }
}

function drawBackground() {
  drawBackgroundToCtx(visualCtx);
}

function renderPath(ctx, shape, size) {
  const s = size;
  ctx.beginPath();
  if (shape === "circle") ctx.arc(0, 0, s, 0, Math.PI * 2);
  else if (shape === "square") ctx.rect(-s, -s, s * 2, s * 2);
  else if (shape === "triangle") {
    ctx.moveTo(0, -s);
    ctx.lineTo(s, s);
    ctx.lineTo(-s, s);
    ctx.closePath();
  } else if (shape === "diamond") {
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
  } else if (shape === "star") {
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * i) / 5;
      const r = i % 2 === 0 ? s : s * 0.45;
      const x = Math.cos(angle - Math.PI / 2) * r;
      const y = Math.sin(angle - Math.PI / 2) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (shape === "hexagon") {
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI * 2 * i) / 6;
      const x = Math.cos(a) * s;
      const y = Math.sin(a) * s;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (shape === "line") {
    ctx.moveTo(-s * 1.2, 0);
    ctx.lineTo(s * 1.2, 0);
  } else if (shape === "spiral") {
    const loops = 3.2;
    const segs = 72;
    for (let i = 0; i <= segs; i += 1) {
      const t = i / segs;
      const a = t * Math.PI * 2 * loops;
      const r = s * t;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
}

function drawShapeWithStyle(ctx, shapeState, styleOptions) {
  if (styleOptions.material === "randomMix") {
    const pair = shapeState.materialMixPair;
    const m1 =
      pair && MIXABLE_MATERIAL_IDS.includes(pair[0]) ? pair[0] : MIXABLE_MATERIAL_IDS[0];
    const m2 =
      pair && MIXABLE_MATERIAL_IDS.includes(pair[1]) ? pair[1] : MIXABLE_MATERIAL_IDS[1];
    if (m1 === m2) {
      drawShapeWithStyle(ctx, shapeState, { ...styleOptions, material: m1 });
      return;
    }
    drawShapeWithStyle(ctx, shapeState, { ...styleOptions, material: m1 });
    ctx.save();
    ctx.globalAlpha *= 0.52;
    drawShapeWithStyle(ctx, shapeState, { ...styleOptions, material: m2 });
    ctx.restore();
    return;
  }

  const sw = getShapeStrokeLineWidth();
  const baseHsl = hexToHsl(styleOptions.color);
  const hue = (baseHsl.h + shapeState.hueShift) % 360;
  const lineLike = styleOptions.shape === "line" || styleOptions.shape === "spiral";
  const sat = Math.max(0, Math.min(100, baseHsl.s));
  const light = Math.max(0, Math.min(100, baseHsl.l));
  const useStroke = styleOptions.useStroke;
  const strokeColor = styleOptions.strokeColor;
  ctx.globalCompositeOperation = styleOptions.blendMode;
  ctx.save();
  ctx.translate(shapeState.x, shapeState.y);
  ctx.rotate(shapeState.rotation);
  ctx.scale(shapeState.scaleX, shapeState.scaleY);
  if (styleOptions.material === "gradient") {
    const gradient = ctx.createLinearGradient(-120, -120, 120, 120);
    gradient.addColorStop(
      0,
      `hsla(${hue},${Math.max(5, sat)}%,${Math.max(18, Math.min(82, light + 12))}%,${shapeState.alpha})`,
    );
    gradient.addColorStop(
      1,
      `hsla(${(hue + 80) % 360},${Math.max(5, sat)}%,${Math.max(12, Math.min(78, light - 10))}%,${shapeState.alpha})`,
    );
    ctx.fillStyle = gradient;
    ctx.strokeStyle = useStroke ? strokeColor : gradient;
  } else if (styleOptions.material === "grain") {
    ctx.fillStyle = `hsla(${hue},${Math.max(5, sat)}%,${Math.max(12, Math.min(88, light))}%,${shapeState.alpha * 0.95})`;
    ctx.strokeStyle = useStroke
      ? strokeColor
      : `hsla(${hue},${Math.max(5, sat)}%,${Math.max(10, Math.min(72, light - 20))}%,${Math.min(1, shapeState.alpha + 0.08)})`;
    ctx.lineWidth = sw;
  } else if (styleOptions.material === "neon") {
    ctx.fillStyle = `hsla(${hue},${Math.max(12, sat)}%,${Math.max(10, Math.min(88, light + 6))}%,${shapeState.alpha})`;
    ctx.shadowColor = `hsla(${hue},${Math.max(12, sat)}%,${Math.max(30, Math.min(70, light))}%,1)`;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = useStroke ? strokeColor : "transparent";
  } else if (styleOptions.material === "wireframe") {
    ctx.fillStyle = "transparent";
    ctx.strokeStyle = useStroke
      ? strokeColor
      : `hsla(${hue},${Math.max(0, sat)}%,${Math.max(6, Math.min(92, light + 8))}%,${shapeState.alpha})`;
    ctx.lineWidth = sw;
  } else {
    ctx.fillStyle = `hsla(${hue},${Math.max(0, sat)}%,${Math.max(8, Math.min(92, light))}%,${shapeState.alpha})`;
    ctx.strokeStyle = useStroke
      ? strokeColor
      : `hsla(${hue},${Math.max(0, sat)}%,${Math.max(6, Math.min(78, light - 12))}%,${Math.min(1, shapeState.alpha * 0.6)})`;
  }
  renderPath(ctx, styleOptions.shape, shapeState.size);
  if (!lineLike && styleOptions.material !== "wireframe") ctx.fill();
  if (lineLike) {
    ctx.lineWidth = Math.max(sw, shapeState.size * 0.08 * (sw / 2));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (styleOptions.material === "neon") {
      ctx.strokeStyle = useStroke
        ? strokeColor
        : `hsla(${hue},${Math.max(12, sat)}%,${Math.max(10, Math.min(88, light + 8))}%,${shapeState.alpha})`;
    } else if (styleOptions.material === "gradient") {
      const lineGrad = ctx.createLinearGradient(-shapeState.size, 0, shapeState.size, 0);
      lineGrad.addColorStop(0, `hsla(${hue},${Math.max(5, sat)}%,${Math.max(18, Math.min(82, light + 10))}%,${shapeState.alpha})`);
      lineGrad.addColorStop(1, `hsla(${(hue + 80) % 360},${Math.max(5, sat)}%,${Math.max(10, Math.min(78, light - 8))}%,${shapeState.alpha})`);
      ctx.strokeStyle = useStroke ? strokeColor : lineGrad;
    } else if (!useStroke) {
      ctx.strokeStyle = `hsla(${hue},${Math.max(0, sat)}%,${Math.max(8, Math.min(92, light))}%,${shapeState.alpha})`;
    }
  }
  if (lineLike) {
    ctx.stroke();
    if (styleOptions.material === "grain") {
      const pad = Math.max(10, shapeState.size * 0.22);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-shapeState.size * 1.35 - pad, -pad, shapeState.size * 2.7 + pad * 2, pad * 2);
      ctx.clip();
      applyFilmGrainInClip(ctx, hue, sat);
      ctx.restore();
    }
  } else if (styleOptions.material === "wireframe" || useStroke) {
    ctx.lineWidth = sw;
    ctx.stroke();
  }
  if (!lineLike && styleOptions.material === "grain") {
    ctx.save();
    renderPath(ctx, styleOptions.shape, shapeState.size);
    ctx.clip();
    applyFilmGrainInClip(ctx, hue, sat);
    ctx.restore();
  }
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
}

function drawVisual(
  forceClean = false,
  frameShapes = null,
  frameColors = null,
  frameMaterial = null,
  frameBlend = null,
  textFxOverride = null,
) {
  const shapesToDraw = frameShapes || visualShapes;
  const colors = frameColors || shapeColors;
  const material = frameMaterial || ui.materialSelect.value;
  const blend = frameBlend || ui.blendModeSelect.value;
  const avgTrail = shapesToDraw.length
    ? shapesToDraw.reduce((sum, s) => sum + s.trail, 0) / shapesToDraw.length
    : 0.1;
  const onionSkin = Boolean(ui.graphicOnionSkin?.checked);
  // 未勾选洋葱皮：每步清空轨迹层，只呈现当前几何状态，不叠留历史帧。
  // 勾选洋葱皮：用半透明黑叠层做渐隐，叠影保留更久（alpha 更小）。
  let trailFadeAlpha = Math.min(0.042, Math.max(0.012, avgTrail * 0.18));
  if (onionSkin) {
    trailFadeAlpha *= 0.1;
  }
  drawBackground();
  if (forceClean || avgTrail <= 0.05 || !onionSkin) {
    shapeTrailCtx.clearRect(0, 0, VIEW_LOGICAL_W, VIEW_LOGICAL_H);
  } else {
    shapeTrailCtx.globalCompositeOperation = "source-over";
    shapeTrailCtx.fillStyle = `rgba(0, 0, 0, ${trailFadeAlpha})`;
    shapeTrailCtx.fillRect(0, 0, VIEW_LOGICAL_W, VIEW_LOGICAL_H);
  }

  // 图形在独立轨迹层里叠加，背景不参与混色
  shapesToDraw.forEach((shapeState) => {
    drawShapeWithStyle(shapeTrailCtx, shapeState, {
      shape: shapeState.shape,
      color: colors[shapeState.shape] || "#6fa8ff",
      material,
      blendMode: blend,
      useStroke: ui.strokeEnabled.checked,
      strokeColor: ui.strokeColorInput.value,
    });
  });
  visualCtx.globalCompositeOperation = "source-over";
  // 必须用逻辑尺寸缩放整张贴图：三参数 drawImage 会把「源像素宽高」当作用户空间单位，
  // 在已 scale(viewDpr) 的坐标系下会远大于 640×480，只剩边缘一条被看见（像被裁切）
  visualCtx.drawImage(shapeTrailCanvas, 0, 0, VIEW_LOGICAL_W, VIEW_LOGICAL_H);
  const fxForText = textFxOverride != null ? textFxOverride : mazeTextFx;
  drawMazeOverlayText(visualCtx, ui.mazeTextInput ? ui.mazeTextInput.value : "", fxForText);
}

function drawFrameShapes(targetCtx, shapes, colors, material, blend) {
  shapes.forEach((shapeState) => {
    drawShapeWithStyle(targetCtx, shapeState, {
      shape: shapeState.shape,
      color: colors[shapeState.shape] || "#6fa8ff",
      material,
      blendMode: blend,
      useStroke: ui.strokeEnabled.checked,
      strokeColor: ui.strokeColorInput.value,
    });
  });
}

function directionToAction(direction) {
  if (direction === "up") return ui.ruleUp.value;
  if (direction === "down") return ui.ruleDown.value;
  if (direction === "left") return ui.ruleLeft.value;
  return ui.ruleRight.value;
}

const FINISH_GALLERY_DB = "mazeFinishGalleryV1";
const FINISH_GALLERY_STORE = "shots";
const FINISH_GALLERY_MAX = 48;
let finishGalleryDbPromise = null;

function idbTxDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openFinishGalleryDb() {
  if (!window.indexedDB) return Promise.reject(new Error("no idb"));
  if (finishGalleryDbPromise) return finishGalleryDbPromise;
  finishGalleryDbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(FINISH_GALLERY_DB, 1);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result);
    r.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(FINISH_GALLERY_STORE)) {
        db.createObjectStore(FINISH_GALLERY_STORE, { keyPath: "id" });
      }
    };
  });
  return finishGalleryDbPromise;
}

async function pruneFinishGallery(db) {
  const tx = db.transaction(FINISH_GALLERY_STORE, "readonly");
  const all = await idbReq(tx.objectStore(FINISH_GALLERY_STORE).getAll());
  if (!all || all.length <= FINISH_GALLERY_MAX) return;
  all.sort((a, b) => a.id - b.id);
  const toDrop = all.slice(0, all.length - FINISH_GALLERY_MAX);
  const tx2 = db.transaction(FINISH_GALLERY_STORE, "readwrite");
  const st = tx2.objectStore(FINISH_GALLERY_STORE);
  toDrop.forEach((row) => st.delete(row.id));
  await idbTxDone(tx2);
}

async function saveFinishSnapshotToGallery(dataUrl, stepCount) {
  try {
    const db = await openFinishGalleryDb();
    const id = Date.now();
    const tx = db.transaction(FINISH_GALLERY_STORE, "readwrite");
    tx.objectStore(FINISH_GALLERY_STORE).put({ id, steps: stepCount, image: dataUrl });
    await idbTxDone(tx);
    await pruneFinishGallery(db);
  } catch (_e) {
    /* private mode / quota */
  }
}

function queueSaveFinishGallerySnapshot(stepCount) {
  requestAnimationFrame(() => {
    try {
      const dataUrl = visualCanvas.toDataURL("image/jpeg", 0.82);
      saveFinishSnapshotToGallery(dataUrl, stepCount).catch(() => {});
    } catch (_e) {}
  });
}

async function loadFinishGalleryRows() {
  try {
    const db = await openFinishGalleryDb();
    const tx = db.transaction(FINISH_GALLERY_STORE, "readonly");
    const rows = await idbReq(tx.objectStore(FINISH_GALLERY_STORE).getAll());
    if (!rows || !rows.length) return [];
    rows.sort((a, b) => b.id - a.id);
    return rows;
  } catch (_e) {
    return [];
  }
}

function formatGalleryTime(id) {
  const d = new Date(id);
  const loc = currentLang === "zh" ? "zh-CN" : "en-US";
  try {
    return d.toLocaleString(loc, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (_e) {
    return d.toISOString().slice(0, 16);
  }
}

function galleryExtFromDataUrl(dataUrl) {
  if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/png")) return "png";
  return "jpg";
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrlAsFile(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  a.click();
}

async function buildGalleryZipBlob(rows) {
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
    const JSZip = mod.default;
    const zip = new JSZip();
    rows.forEach((row) => {
      const ext = galleryExtFromDataUrl(row.image);
      const base64 = row.image.includes(",") ? row.image.split(",")[1] : row.image;
      zip.file(`maze-finish-${row.id}-n${row.steps}.${ext}`, base64, { base64: true });
    });
    return await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  } catch (_e) {
    return null;
  }
}

async function exportGalleryRowsWithFallback(rows, usedZipFallbackMsg) {
  if (!rows.length) return;
  const zipBlob = await buildGalleryZipBlob(rows);
  if (zipBlob) {
    triggerBlobDownload(zipBlob, `maze-gallery-${Date.now()}.zip`);
    return;
  }
  if (usedZipFallbackMsg && ui.mazeStatus) {
    ui.mazeStatus.textContent = t("maze.galleryExportZipFail");
    window.setTimeout(() => refreshMazeStatusI18n(), 3200);
  }
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const ext = galleryExtFromDataUrl(row.image);
    downloadDataUrlAsFile(row.image, `maze-finish-${row.id}-n${row.steps}.${ext}`);
    await new Promise((r) => setTimeout(r, 140));
  }
}

async function clearFinishGalleryStore() {
  const db = await openFinishGalleryDb();
  const tx = db.transaction(FINISH_GALLERY_STORE, "readwrite");
  tx.objectStore(FINISH_GALLERY_STORE).clear();
  await idbTxDone(tx);
}

async function deleteFinishGalleryByIds(ids) {
  if (!ids.length) return;
  const db = await openFinishGalleryDb();
  const tx = db.transaction(FINISH_GALLERY_STORE, "readwrite");
  const st = tx.objectStore(FINISH_GALLERY_STORE);
  ids.forEach((id) => st.delete(Number(id)));
  await idbTxDone(tx);
}

function getGallerySelectedIds() {
  if (!ui.galleryGrid) return [];
  return Array.from(ui.galleryGrid.querySelectorAll(".gallery-card__cb:checked"))
    .map((el) => Number(el.getAttribute("data-gallery-id")))
    .filter((id) => Number.isFinite(id));
}

function updateGalleryToolbarState() {
  const hasGrid = Boolean(ui.galleryGrid?.querySelector(".gallery-card"));
  const nSel = getGallerySelectedIds().length;
  const disClear = !hasGrid;
  const disExportAll = !hasGrid;
  const disSel = !nSel;
  if (ui.galleryClearAllBtn) ui.galleryClearAllBtn.disabled = disClear;
  if (ui.galleryExportAllBtn) ui.galleryExportAllBtn.disabled = disExportAll;
  if (ui.galleryExportSelectedBtn) ui.galleryExportSelectedBtn.disabled = disSel;
  if (ui.galleryDeleteSelectedBtn) ui.galleryDeleteSelectedBtn.disabled = disSel;
}

function closeGalleryModal() {
  if (!ui.galleryModal) return;
  ui.galleryModal.classList.remove("is-open");
  ui.galleryModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function renderGalleryList() {
  if (!ui.galleryGrid || !ui.galleryEmpty) return;
  ui.galleryGrid.innerHTML = "";
  const rows = await loadFinishGalleryRows();
  if (!rows.length) {
    ui.galleryEmpty.hidden = false;
    updateGalleryToolbarState();
    return;
  }
  ui.galleryEmpty.hidden = true;
  rows.forEach((row) => {
    const card = document.createElement("div");
    card.className = "gallery-card";
    const media = document.createElement("div");
    media.className = "gallery-card__media";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "gallery-card__cb";
    cb.setAttribute("data-gallery-id", String(row.id));
    cb.addEventListener("click", (e) => e.stopPropagation());
    cb.addEventListener("change", () => updateGalleryToolbarState());
    const img = document.createElement("img");
    img.className = "gallery-card__thumb";
    img.alt = "";
    img.loading = "lazy";
    img.src = row.image;
    img.addEventListener("click", () => {
      try {
        window.open(row.image, "_blank", "noopener,noreferrer");
      } catch (_e) {}
    });
    media.appendChild(cb);
    media.appendChild(img);
    const meta = document.createElement("div");
    meta.className = "gallery-card__meta";
    const steps = typeof row.steps === "number" ? row.steps : 0;
    meta.textContent = `${t("maze.gallerySteps").replace("{n}", String(steps))} · ${formatGalleryTime(row.id)}`;
    card.appendChild(media);
    card.appendChild(meta);
    ui.galleryGrid.appendChild(card);
  });
  updateGalleryToolbarState();
}

async function openGalleryModal() {
  if (!ui.galleryModal) return;
  ui.galleryModal.classList.add("is-open");
  ui.galleryModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  await renderGalleryList();
}

function tryMove(direction) {
  if (!game.running || game.finished) return;
  const { x, y } = game.player;
  const cell = game.maze[y][x];
  let nx = x;
  let ny = y;
  if (direction === "up" && !cell.walls.top) ny -= 1;
  if (direction === "down" && !cell.walls.bottom) ny += 1;
  if (direction === "left" && !cell.walls.left) nx -= 1;
  if (direction === "right" && !cell.walls.right) nx += 1;
  if (nx === x && ny === y) return;
  playDirectionSound(direction);
  game.player = { x: nx, y: ny };
  const action = directionToAction(direction);
  applyActionToMazeText(action);
  if (visualShapes.length > 0) {
    const originalCount = visualShapes.length;
    for (let idx = 0; idx < originalCount; idx += 1) {
      const target = visualShapes[idx];
      if (action === "split") splitShape(target);
      else applyAction(action, target);
      clampShape(target);
    }
  }
  drawMaze();
  drawVisual(false);
  game.records.push({
    direction,
    shapes: visualShapes.map((s) => ({ ...s })),
    colors: { ...shapeColors },
    material: ui.materialSelect.value,
    blend: ui.blendModeSelect.value,
    textFx: structuredClone(mazeTextFx),
    timestamp: Date.now(),
  });
  if (nx === game.end.x && ny === game.end.y) {
    game.finished = true;
    game.running = false;
    ui.mazeStatus.textContent = t("status.done").replace("{n}", String(game.records.length));
    queueSaveFinishGallerySnapshot(game.records.length);
  } else {
    ui.mazeStatus.textContent = t("status.playing").replace("{n}", String(game.records.length));
  }
  updateReplayTransportUi();
}

function startGame() {
  stopPlayback();
  resumeAudioContext();
  resetMazeTextFxForLayoutMode();
  game.running = true;
  game.finished = false;
  game.records = [];
  game.player = { ...game.start };
  resetVisualShapes();
  drawMaze();
  drawVisual(true);
  ui.mazeStatus.textContent = t("status.started");
}

function downloadPng() {
  const url = visualCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `maze-visual-${Date.now()}.png`;
  a.click();
}

function restorePreviewCanvasAfterVideoExport() {
  if (window.__replayActive && game.records.length) {
    const idx = Number.isFinite(window.__replayShown) ? window.__replayShown : 0;
    renderOneReplayFrame(idx, { playSound: false });
  } else {
    drawVisual(true);
  }
}

function setVideoExportOverlayVisible(visible) {
  const el = ui.videoExportOverlay;
  if (!el) return;
  el.hidden = !visible;
  el.setAttribute("aria-busy", visible ? "true" : "false");
}

async function downloadVideo() {
  if (game.records.length === 0) return;
  setVideoExportOverlayVisible(true);
  ui.mazeStatus.textContent = t("status.videoExporting");

  const EXPORT_PIXEL_SCALE = 2;
  const TARGET_BPS = 16_000_000;
  const frameDelay = replayIntervalMs();
  const streamFps = Math.min(60, Math.max(4, Math.round(1000 / Math.max(8, frameDelay))));

  try {
    const n = game.records.length;
    const exportCanvas = document.createElement("canvas");
    const pw = Math.round(VIEW_LOGICAL_W * viewDpr * EXPORT_PIXEL_SCALE);
    const ph = Math.round(VIEW_LOGICAL_H * viewDpr * EXPORT_PIXEL_SCALE);
    exportCanvas.width = pw;
    exportCanvas.height = ph;
    const exCtx = exportCanvas.getContext("2d");
    exCtx.setTransform(viewDpr * EXPORT_PIXEL_SCALE, 0, 0, viewDpr * EXPORT_PIXEL_SCALE, 0, 0);
    exCtx.imageSmoothingEnabled = true;
    exCtx.imageSmoothingQuality = "high";

    const includeAudio = !ui.playbackMute.checked;
    resumeAudioContext();

    const videoStream = exportCanvas.captureStream(streamFps);
    let dest = null;
    let combinedStream = videoStream;
    if (includeAudio && audioCtx) {
      dest = audioCtx.createMediaStreamDestination();
      const at = dest.stream.getAudioTracks()[0];
      if (at) combinedStream = new MediaStream([...videoStream.getVideoTracks(), at]);
    }

    const wantsVideoAudio = combinedStream.getAudioTracks().length > 0;
    const mimeCandidates = [];
    if (wantsVideoAudio) {
      mimeCandidates.push({ mime: "video/webm;codecs=vp9,opus", bps: TARGET_BPS });
      mimeCandidates.push({ mime: "video/webm;codecs=vp8,opus", bps: Math.min(TARGET_BPS, 9_000_000) });
    }
    mimeCandidates.push({ mime: "video/webm;codecs=vp9", bps: TARGET_BPS });
    mimeCandidates.push({ mime: "video/webm;codecs=vp8", bps: Math.min(TARGET_BPS, 9_000_000) });
    mimeCandidates.push({ mime: "video/webm", bps: 6_000_000 });

    let picked = null;
    for (let c = 0; c < mimeCandidates.length; c += 1) {
      if (MediaRecorder.isTypeSupported(mimeCandidates[c].mime)) {
        picked = mimeCandidates[c];
        break;
      }
    }
    if (!picked) throw new Error("no webm");

    const recOpts = { mimeType: picked.mime, videoBitsPerSecond: picked.bps };
    if (wantsVideoAudio) recOpts.audioBitsPerSecond = 128000;

    let recorder;
    try {
      recorder = new MediaRecorder(combinedStream, recOpts);
    } catch (_e1) {
      try {
        recorder = new MediaRecorder(combinedStream, { mimeType: picked.mime });
      } catch (_e2) {
        recorder = new MediaRecorder(combinedStream);
      }
    }

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const encodingDone = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("recorder"));
    });

    const videoTrack = videoStream.getVideoTracks()[0];

    recorder.start(400);
    try {
      for (let frame = 0; frame < n; frame += 1) {
        if (includeAudio && audioCtx && dest) {
          connectDirectionSound(audioCtx, dest, game.records[frame].direction, audioCtx.currentTime + 0.02);
        }
        renderReplayFrameOntoContext(exCtx, EXPORT_PIXEL_SCALE, frame, { playSound: false });
        if (videoTrack && typeof videoTrack.requestFrame === "function") {
          try {
            videoTrack.requestFrame();
          } catch (_rf) {
            /* ignore */
          }
        }
        await new Promise((r) => setTimeout(r, frameDelay));
      }
      await new Promise((r) => setTimeout(r, includeAudio && dest ? 400 : 80));
    } finally {
      if (recorder && recorder.state === "recording") {
        try {
          recorder.stop();
        } catch (_s) {
          /* ignore */
        }
      }
    }

    await encodingDone;

    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maze-visual-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    ui.mazeStatus.textContent = t("status.videoDone");
    setVideoExportOverlayVisible(false);
    restorePreviewCanvasAfterVideoExport();
  } catch (_e) {
    setVideoExportOverlayVisible(false);
    ui.mazeStatus.textContent = t("status.videoExportFail");
    restorePreviewCanvasAfterVideoExport();
  }
}

function handleBgImage(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    assets.bgImage = img;
    drawVisual(true);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function handleBgVideo(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  bgVideoElement.src = url;
  bgVideoElement.onloadeddata = () => {
    assets.bgVideo = bgVideoElement;
    drawVisual(true);
  };
}

function bindEvents() {
  ui.regenMazeBtn.addEventListener("click", resetGame);
  ui.startBtn.addEventListener("click", startGame);
  ui.replayBtnFirst?.addEventListener("click", () => replayScrubToFrame(0));
  ui.replayBtnPrev?.addEventListener("click", () => {
    const cur = Number.isFinite(window.__replayShown) ? window.__replayShown : 0;
    replayScrubToFrame(cur - 1);
  });
  ui.replayBtnPlayPause?.addEventListener("click", onReplayPlayPauseClick);
  ui.replayBtnNext?.addEventListener("click", () => {
    const cur = Number.isFinite(window.__replayShown) ? window.__replayShown : 0;
    replayScrubToFrame(cur + 1);
  });
  ui.replayBtnLast?.addEventListener("click", () => replayScrubToFrame(game.records.length - 1));
  ui.playbackSpeedRange?.addEventListener("input", () => {
    restartReplayTimerIfPlaying();
  });
  ui.replayOnionSkin?.addEventListener("change", () => {
    if (window.__replayActive && game.records.length) {
      const idx = Number.isFinite(window.__replayShown) ? window.__replayShown : 0;
      renderOneReplayFrame(idx, { playSound: false });
    }
  });
  ui.downloadPngBtn.addEventListener("click", downloadPng);
  ui.downloadVideoBtn.addEventListener("click", downloadVideo);
  ui.bgImageInput.addEventListener("change", (e) => handleBgImage(e.target.files[0]));
  ui.bgVideoInput.addEventListener("change", (e) => handleBgVideo(e.target.files[0]));
  ui.bgColorInput.addEventListener("input", () => drawVisual(true));
  ui.transparentBg.addEventListener("change", () => drawVisual(true));
  ui.materialSelect.addEventListener("change", () => {
    stopPlayback();
    if (ui.materialSelect.value === "randomMix") assignRandomMixPairsToVisualShapes();
    else clearMaterialMixOnVisualShapes();
    syncRandomMixShuffleUi();
    drawVisual(true);
  });
  ui.randomMixShuffleBtn?.addEventListener("click", () => {
    if (ui.materialSelect.value !== "randomMix") return;
    stopPlayback();
    assignRandomMixPairsToVisualShapes();
    drawVisual(true);
  });
  ui.blendModeSelect.addEventListener("change", () => {
    stopPlayback();
    drawVisual(true);
  });
  ui.strokeEnabled.addEventListener("change", () => {
    stopPlayback();
    drawVisual(true);
  });
  ui.graphicOnionSkin?.addEventListener("change", () => {
    stopPlayback();
    drawVisual(false);
  });
  ui.strokeColorInput.addEventListener("input", () => {
    stopPlayback();
    drawVisual(true);
  });
  ui.grainStrengthRange.addEventListener("input", () => {
    stopPlayback();
    drawVisual(true);
  });
  ui.shapeLayoutCenterBtn?.addEventListener("click", () => {
    stopPlayback();
    shapePlacementMode = "center";
    syncShapeLayoutButtons();
    repositionShapesCenteredInView();
    drawVisual(true);
  });
  ui.shapeLayoutRandomBtn?.addEventListener("click", () => {
    stopPlayback();
    shapePlacementMode = "random";
    syncShapeLayoutButtons();
    repositionShapesRandomOnce();
    drawVisual(true);
  });
  ui.shapeColorsRandomBtn?.addEventListener("click", () => {
    if (!activeShapeLibrary.length) return;
    randomizeActiveShapeColors();
    stopPlayback();
    renderShapeColorPalette();
    drawVisual(true);
  });
  ui.textLayoutCenterBtn?.addEventListener("click", () => {
    stopPlayback();
    textPlacementMode = "center";
    syncTextLayoutButtons();
    centerMazeTextOffsets();
    drawVisual(true);
  });
  ui.textLayoutRandomBtn?.addEventListener("click", () => {
    stopPlayback();
    textPlacementMode = "random";
    syncTextLayoutButtons();
    randomizeMazeTextOffsets();
    drawVisual(true);
  });
  ui.mazeTextSizeRange?.addEventListener("input", () => {
    stopPlayback();
    clampMazeTextFx();
    drawVisual(true);
  });
  ui.mazeTextStrokeEnabled?.addEventListener("change", () => {
    stopPlayback();
    drawVisual(true);
  });
  ui.mazeTextColorInput?.addEventListener("input", () => {
    stopPlayback();
    drawVisual(true);
  });
  ui.mazeTextStrokeColorInput?.addEventListener("input", () => {
    stopPlayback();
    drawVisual(true);
  });
  ui.mazeTextStrokeWidthRange?.addEventListener("input", () => {
    stopPlayback();
    drawVisual(true);
  });
  ui.shapeStrokeWidthRange?.addEventListener("input", () => {
    stopPlayback();
    drawVisual(true);
  });
  ui.langZh.addEventListener("click", () => {
    currentLang = "zh";
    localStorage.setItem("mazeLang", "zh");
    applyLanguage();
  });
  ui.langEn.addEventListener("click", () => {
    currentLang = "en";
    localStorage.setItem("mazeLang", "en");
    applyLanguage();
  });
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setupViewCanvases();
      setupMazeCanvas();
      drawMaze();
      drawVisual(true);
    }, 120);
  });
  ui.mazeTextInput.addEventListener("input", () => {
    stopPlayback();
    drawVisual(true);
  });
  ui.shapeSizeRange.addEventListener("input", () => {
    const baseSize = Number(ui.shapeSizeRange.value || DEFAULTS.shapeSize);
    visualShapes.forEach((shape) => {
      shape.size = baseSize;
    });
    stopPlayback();
    drawVisual(true);
  });
  window.addEventListener("keydown", (e) => {
    if (ui.galleryModal?.classList.contains("is-open")) {
      if (e.key === "Escape") closeGalleryModal();
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    if (e.key === "ArrowUp") tryMove("up");
    if (e.key === "ArrowDown") tryMove("down");
    if (e.key === "ArrowLeft") tryMove("left");
    if (e.key === "ArrowRight") tryMove("right");
  });

  ui.galleryOpenBtn?.addEventListener("click", () => {
    openGalleryModal().catch(() => {});
  });
  ui.galleryCloseBtn?.addEventListener("click", () => closeGalleryModal());
  ui.galleryModal?.querySelector(".gallery-modal__backdrop")?.addEventListener("click", () => closeGalleryModal());

  ui.galleryClearAllBtn?.addEventListener("click", async () => {
    const rows = await loadFinishGalleryRows();
    if (!rows.length) return;
    if (!window.confirm(t("maze.galleryConfirmClearAll"))) return;
    try {
      await clearFinishGalleryStore();
      await renderGalleryList();
    } catch (_e) {}
  });
  ui.galleryExportSelectedBtn?.addEventListener("click", async () => {
    const ids = getGallerySelectedIds();
    if (!ids.length) {
      window.alert(t("maze.galleryNoneSelected"));
      return;
    }
    const all = await loadFinishGalleryRows();
    const rows = all.filter((r) => ids.includes(r.id));
    await exportGalleryRowsWithFallback(rows, true);
  });
  ui.galleryDeleteSelectedBtn?.addEventListener("click", async () => {
    const ids = getGallerySelectedIds();
    if (!ids.length) {
      window.alert(t("maze.galleryNoneSelected"));
      return;
    }
    if (!window.confirm(t("maze.galleryConfirmDeleteSelected").replace("{n}", String(ids.length)))) return;
    try {
      await deleteFinishGalleryByIds(ids);
      await renderGalleryList();
    } catch (_e) {}
  });
  ui.galleryExportAllBtn?.addEventListener("click", async () => {
    const rows = await loadFinishGalleryRows();
    if (!rows.length) return;
    await exportGalleryRowsWithFallback(rows, true);
  });
}

function init() {
  setupViewCanvases();
  setupMazeCanvas();
  initUi();
  bindEvents();
  resetGame();
}

init();
