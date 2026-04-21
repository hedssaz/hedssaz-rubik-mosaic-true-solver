import {
  RUBIK_COLORS,
  applyMoves,
  buildStatesForFormula,
  describeFormula,
  faceMap,
  formulaStatusLabel,
  manualMoveList,
} from "./cube-sim.js?v=20260421h";

const mainState = readJson("cube1:main-state", null);
const persistedCube =
  readJson("cube1:selected-cube", null, localStorage) ??
  readJson("cube1:selected-cube", null, sessionStorage);
const cube =
  persistedCube ??
  mainState?.solvedCubes?.find((item) => item.id === mainState?.selectedCubeId) ??
  mainState?.cubes?.find((item) => item.id === mainState?.selectedCubeId) ??
  null;
const meta = readJson("cube1:meta", {}, localStorage) ?? readJson("cube1:meta", {}, sessionStorage) ?? {};

const title = document.getElementById("detailTitle");
const detailStatus = document.getElementById("detailStatus");
const detailInfo = document.getElementById("detailInfo");
const cubeCanvas = document.getElementById("cubeCanvas");
const cubeContext = cubeCanvas.getContext("2d");
const cameraX = document.getElementById("cameraX");
const cameraY = document.getElementById("cameraY");
const stepSlider = document.getElementById("stepSlider");
const stepLabel = document.getElementById("stepLabel");
const prevStep = document.getElementById("prevStep");
const nextStep = document.getElementById("nextStep");
const resetManual = document.getElementById("resetManual");
const formulaChips = document.getElementById("formulaChips");
const manualButtons = document.getElementById("manualButtons");
const manualLabel = document.getElementById("manualLabel");
const backToWall = document.getElementById("backToWall");

backToWall.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = "./index.html?v=20260421g";
});

if (!cube) {
  title.textContent = "No cube selected";
  detailStatus.textContent = "empty";
  detailInfo.textContent = "Go back to the wall page and choose a cube first.";
} else {
  startDetail();
}

function startDetail() {
  const cleanFormula = Array.isArray(cube.formula)
    ? cube.formula.filter((move) => typeof move === "string" && !move.startsWith("UNSOLVED"))
    : [];
  const states = buildStatesForFormula(cube.target[4], cleanFormula);
  let currentStep = 0;
  let manualMoves = [];

  title.textContent = `Cube #${cube.id} at (${cube.x}, ${cube.y})`;
  detailStatus.textContent = formulaStatusLabel(cube);
  stepSlider.max = String(Math.max(states.length - 1, 0));
  stepSlider.value = "0";

  renderInfo();
  renderFormulaChips();
  renderManualButtons();
  renderCamera();
  renderState();

  cameraX.addEventListener("input", renderCamera);
  cameraY.addEventListener("input", renderCamera);

  stepSlider.addEventListener("input", () => {
    currentStep = Number(stepSlider.value);
    manualMoves = [];
    renderState();
  });

  prevStep.addEventListener("click", () => {
    currentStep = Math.max(0, currentStep - 1);
    stepSlider.value = String(currentStep);
    manualMoves = [];
    renderState();
  });

  nextStep.addEventListener("click", () => {
    currentStep = Math.min(states.length - 1, currentStep + 1);
    stepSlider.value = String(currentStep);
    manualMoves = [];
    renderState();
  });

  resetManual.addEventListener("click", () => {
    manualMoves = [];
    renderState();
  });

  function renderInfo() {
    const center = RUBIK_COLORS[cube.target[4]];
    const location = typeof meta.total === "number" ? `${meta.total} cubes in wall` : "single selection";
    detailInfo.innerHTML = `
      <strong>Center</strong>: ${center.name}<br />
      <strong>Wall coords</strong>: (${cube.x}, ${cube.y})<br />
      <strong>Orientation</strong>: ${cube.orientation?.note ?? "none"}<br />
      <strong>Formula</strong>: ${describeFormula(cube)}<br />
      <strong>Wall meta</strong>: ${location}
    `;
  }

  function renderFormulaChips() {
    formulaChips.innerHTML = "";
    const startChip = makeChip("Start", 0);
    formulaChips.appendChild(startChip);

    cleanFormula.forEach((move, index) => {
      formulaChips.appendChild(makeChip(move, index + 1));
    });
  }

  function makeChip(label, stepIndex) {
    const chip = document.createElement("button");
    chip.className = `chip${stepIndex === currentStep ? " active" : ""}`;
    chip.type = "button";
    chip.textContent = label;
    chip.addEventListener("click", () => {
      currentStep = stepIndex;
      stepSlider.value = String(stepIndex);
      manualMoves = [];
      renderState();
    });
    return chip;
  }

  function renderManualButtons() {
    manualButtons.innerHTML = "";
    manualMoveList().forEach((move) => {
      const button = document.createElement("button");
      button.className = "secondary";
      button.type = "button";
      button.textContent = move;
      button.addEventListener("click", () => {
        manualMoves = [...manualMoves, move];
        renderState();
      });
      manualButtons.appendChild(button);
    });
  }

  function renderCamera() {
    renderState();
  }

  function renderState() {
    const baseState = states[currentStep];
    const displayState = applyMoves(baseState, manualMoves);
    const faces = faceMap(displayState);
    renderCubeCanvas(faces, Number(cameraX.value), Number(cameraY.value));

    stepLabel.textContent = `step ${currentStep}/${states.length - 1}`;
    manualLabel.textContent = `${manualMoves.length} extra turns`;
    formulaChips.querySelectorAll(".chip").forEach((chip, index) => {
      chip.classList.toggle("active", index === currentStep);
    });
  }
}

function renderCubeCanvas(faces, pitch, yaw) {
  const width = cubeCanvas.width;
  const height = cubeCanvas.height;

  cubeContext.clearRect(0, 0, width, height);
  cubeContext.fillStyle = "#141313";
  cubeContext.fillRect(0, 0, width, height);

  const faceSize = width * 0.28;
  const yawRatio = Math.min(Math.abs(yaw) / 180, 1);
  const tiltRatio = Math.min(Math.abs(pitch) / 70, 1);
  const slant = faceSize * (0.38 + yawRatio * 0.18);
  const lift = faceSize * (0.18 + tiltRatio * 0.18);
  const centerX = width * 0.5;
  const centerY = height * 0.62;

  const showRight = yaw <= 0;

  const front = [
    point(centerX - faceSize / 2, centerY - faceSize / 2),
    point(centerX + faceSize / 2, centerY - faceSize / 2),
    point(centerX + faceSize / 2, centerY + faceSize / 2),
    point(centerX - faceSize / 2, centerY + faceSize / 2),
  ];

  const side = showRight
    ? [
        front[1],
        point(front[1].x + slant, front[1].y - lift),
        point(front[2].x + slant, front[2].y - lift),
        front[2],
      ]
    : [
        point(front[0].x - slant, front[0].y - lift),
        front[0],
        front[3],
        point(front[3].x - slant, front[3].y - lift),
      ];

  const top = [
    point(front[0].x, front[0].y),
    point(front[1].x, front[1].y),
    point(front[1].x + slant, front[1].y - lift),
    point(front[0].x - slant, front[0].y - lift),
  ];

  const frontFace = orientFace(faces.U);
  const sideFace = showRight
    ? orientFace(faces.R, { reverseCols: true })
    : orientFace(faces.L, { reverseCols: true });
  const topFace = orientFace(faces.B, { reverseRows: true, reverseCols: true });

  drawFaceBackground(side);
  drawFaceStickers(side, sideFace, 0.82);
  drawFaceBackground(top);
  drawFaceStickers(top, topFace, 0.9);
  drawFaceBackground(front);
  drawFaceStickers(front, frontFace, 1);
}

function drawFaceBackground(points) {
  cubeContext.beginPath();
  cubeContext.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    cubeContext.lineTo(points[index].x, points[index].y);
  }
  cubeContext.closePath();
  cubeContext.fillStyle = "#070707";
  cubeContext.fill();
  cubeContext.lineWidth = 6;
  cubeContext.strokeStyle = "rgba(255,255,255,0.08)";
  cubeContext.stroke();
}

function drawFaceStickers(points, colors, alpha = 1) {
  const [topLeft, topRight, bottomRight, bottomLeft] = points;
  const inset = 0.08;

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const u0 = col / 3;
      const u1 = (col + 1) / 3;
      const v0 = row / 3;
      const v1 = (row + 1) / 3;
      const quad = [
        interpolateQuad(topLeft, topRight, bottomRight, bottomLeft, u0 + inset / 3, v0 + inset / 3),
        interpolateQuad(topLeft, topRight, bottomRight, bottomLeft, u1 - inset / 3, v0 + inset / 3),
        interpolateQuad(topLeft, topRight, bottomRight, bottomLeft, u1 - inset / 3, v1 - inset / 3),
        interpolateQuad(topLeft, topRight, bottomRight, bottomLeft, u0 + inset / 3, v1 - inset / 3),
      ];
      const colorId = colors[row * 3 + col];
      cubeContext.beginPath();
      cubeContext.moveTo(quad[0].x, quad[0].y);
      cubeContext.lineTo(quad[1].x, quad[1].y);
      cubeContext.lineTo(quad[2].x, quad[2].y);
      cubeContext.lineTo(quad[3].x, quad[3].y);
      cubeContext.closePath();
      cubeContext.globalAlpha = alpha;
      cubeContext.fillStyle = RUBIK_COLORS[colorId].hex;
      cubeContext.fill();
      cubeContext.globalAlpha = 1;
      cubeContext.lineWidth = 2;
      cubeContext.strokeStyle = "rgba(0,0,0,0.24)";
      cubeContext.stroke();
    }
  }
}

function interpolateQuad(topLeft, topRight, bottomRight, bottomLeft, u, v) {
  const top = lerpPoint(topLeft, topRight, u);
  const bottom = lerpPoint(bottomLeft, bottomRight, u);
  return lerpPoint(top, bottom, v);
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function point(x, y) {
  return { x, y };
}

function orientFace(colors, options = {}) {
  const { reverseRows = false, reverseCols = false } = options;
  const rows = [
    colors.slice(0, 3),
    colors.slice(3, 6),
    colors.slice(6, 9),
  ];
  const orderedRows = reverseRows ? [...rows].reverse() : rows;
  return orderedRows
    .map((row) => (reverseCols ? [...row].reverse() : row))
    .flat();
}

function readJson(key, fallback, storage = localStorage) {
  const raw = storage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to parse storage key ${key}`, error);
    return fallback;
  }
}
