import {
  RUBIK_COLORS,
  applyMoves,
  buildStatesForFormula,
  describeFormula,
  faceMap,
  formulaStatusLabel,
  manualMoveList,
} from "./cube-sim.js?v=20260421k";

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
const stepSlider = document.getElementById("stepSlider");
const stepLabel = document.getElementById("stepLabel");
const prevStep = document.getElementById("prevStep");
const nextStep = document.getElementById("nextStep");
const resetManual = document.getElementById("resetManual");
const formulaChips = document.getElementById("formulaChips");
const manualButtons = document.getElementById("manualButtons");
const manualLabel = document.getElementById("manualLabel");
const backToWall = document.getElementById("backToWall");
const dragHint = document.getElementById("dragHint");

const viewState = {
  pitch: -26,
  yaw: -38,
  dragging: false,
  pointerId: null,
  lastX: 0,
  lastY: 0,
};

backToWall.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = "./index.html?v=20260421k";
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
  bindDragControls();
  renderState();

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

  function renderState() {
    const baseState = states[currentStep];
    const displayState = applyMoves(baseState, manualMoves);
    const faces = faceMap(displayState);
    renderCubeCanvas(faces, viewState.pitch, viewState.yaw);

    stepLabel.textContent = `step ${currentStep}/${states.length - 1}`;
    manualLabel.textContent = `${manualMoves.length} extra turns`;
    formulaChips.querySelectorAll(".chip").forEach((chip, index) => {
      chip.classList.toggle("active", index === currentStep);
    });
  }

  function bindDragControls() {
    const finishDrag = () => {
      viewState.dragging = false;
      viewState.pointerId = null;
      cubeCanvas.classList.remove("dragging");
      if (dragHint) {
        dragHint.textContent = "Drag on the cube to rotate the view.";
      }
    };

    cubeCanvas.addEventListener("pointerdown", (event) => {
      viewState.dragging = true;
      viewState.pointerId = event.pointerId;
      viewState.lastX = event.clientX;
      viewState.lastY = event.clientY;
      cubeCanvas.setPointerCapture(event.pointerId);
      cubeCanvas.classList.add("dragging");
      if (dragHint) {
        dragHint.textContent = "Release to keep this angle.";
      }
    });

    cubeCanvas.addEventListener("pointermove", (event) => {
      if (!viewState.dragging || event.pointerId !== viewState.pointerId) {
        return;
      }

      const dx = event.clientX - viewState.lastX;
      const dy = event.clientY - viewState.lastY;
      viewState.lastX = event.clientX;
      viewState.lastY = event.clientY;
      viewState.yaw = clamp(viewState.yaw + dx * 0.45, -120, 120);
      viewState.pitch = clamp(viewState.pitch + dy * 0.35, -68, 68);
      renderState();
    });

    cubeCanvas.addEventListener("pointerup", finishDrag);
    cubeCanvas.addEventListener("pointercancel", finishDrag);
    cubeCanvas.addEventListener("lostpointercapture", finishDrag);
  }
}

function renderCubeCanvas(faces, pitch, yaw) {
  const width = cubeCanvas.width;
  const height = cubeCanvas.height;

  cubeContext.clearRect(0, 0, width, height);
  cubeContext.fillStyle = "#141313";
  cubeContext.fillRect(0, 0, width, height);

  const geometry = createProjectedCube(width, height, pitch, yaw);
  const displayFaces = {
    F: orientFace(faces.U),
    B: orientFace(faces.D, { reverseRows: true, reverseCols: true }),
    U: orientFace(faces.B, { reverseRows: true, reverseCols: true }),
    D: orientFace(faces.F),
    R: orientFace(faces.R, { reverseCols: true }),
    L: orientFace(faces.L, { reverseCols: true }),
  };

  drawGroundShadow(geometry);
  drawWallPlane(geometry.baseFront);

  const drawQueue = [
    makeStickerFace("B", geometry, displayFaces.B, 0.78),
    makeStickerFace("U", geometry, displayFaces.U, 0.9),
    makeStickerFace("D", geometry, displayFaces.D, 0.88),
    makeStickerFace("R", geometry, displayFaces.R, 0.82),
    makeStickerFace("L", geometry, displayFaces.L, 0.82),
    makeStickerFace("F", geometry, displayFaces.F, 1, true),
  ]
    .filter((face) => face.visible)
    .sort((a, b) => a.depth - b.depth);

  for (const face of drawQueue) {
    if (face.key === "F") {
      drawFrontHalo(face.points);
    }
    drawFaceBackground(face.points, face.key === "F");
    drawFaceStickers(face.points, face.colors, face.alpha);
  }
}

function drawWallPlane(points) {
  cubeContext.save();
  drawQuad(points, "rgba(255,255,255,0.045)", "rgba(255,255,255,0.1)", 3);
  for (let step = 1; step < 3; step += 1) {
    const t = step / 3;
    const horizontalStart = lerpPoint(points[0], points[3], t);
    const horizontalEnd = lerpPoint(points[1], points[2], t);
    const verticalStart = lerpPoint(points[0], points[1], t);
    const verticalEnd = lerpPoint(points[3], points[2], t);
    cubeContext.strokeStyle = "rgba(255,255,255,0.03)";
    cubeContext.lineWidth = 1;
    cubeContext.beginPath();
    cubeContext.moveTo(horizontalStart.x, horizontalStart.y);
    cubeContext.lineTo(horizontalEnd.x, horizontalEnd.y);
    cubeContext.stroke();
    cubeContext.beginPath();
    cubeContext.moveTo(verticalStart.x, verticalStart.y);
    cubeContext.lineTo(verticalEnd.x, verticalEnd.y);
    cubeContext.stroke();
  }
  cubeContext.restore();
}

function drawGroundShadow(geometry) {
  const front = geometry.baseFront;
  const skew = geometry.rotatedNormals.R.z >= 0 ? 40 : -40;
  const drop = 34;
  cubeContext.save();
  cubeContext.beginPath();
  cubeContext.moveTo(front[0].x + skew, front[0].y + drop * 0.18);
  cubeContext.lineTo(front[1].x + skew, front[1].y + drop * 0.18);
  cubeContext.lineTo(front[2].x + skew, front[2].y + drop);
  cubeContext.lineTo(front[3].x + skew, front[3].y + drop);
  cubeContext.closePath();
  cubeContext.fillStyle = "rgba(0,0,0,0.2)";
  cubeContext.fill();
  cubeContext.restore();
}

function drawFrontHalo(points) {
  const halo = expandQuad(points, 1.14);
  cubeContext.save();
  cubeContext.beginPath();
  cubeContext.moveTo(halo[0].x, halo[0].y);
  for (let index = 1; index < halo.length; index += 1) {
    cubeContext.lineTo(halo[index].x, halo[index].y);
  }
  cubeContext.closePath();
  cubeContext.lineWidth = 18;
  cubeContext.strokeStyle = "rgba(255, 154, 92, 0.22)";
  cubeContext.stroke();
  cubeContext.restore();
}

function drawFaceBackground(points, emphasize = false, fillOverride = null) {
  drawQuad(
    points,
    fillOverride ?? (emphasize ? "#0d0d0d" : "#070707"),
    emphasize ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
    emphasize ? 8 : 6,
  );
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

function point3(x, y, z) {
  return { x, y, z };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawQuad(points, fillStyle, strokeStyle, lineWidth) {
  cubeContext.beginPath();
  cubeContext.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    cubeContext.lineTo(points[index].x, points[index].y);
  }
  cubeContext.closePath();
  cubeContext.fillStyle = fillStyle;
  cubeContext.fill();
  cubeContext.lineWidth = lineWidth;
  cubeContext.strokeStyle = strokeStyle;
  cubeContext.stroke();
}

function createProjectedCube(width, height, pitch, yaw) {
  const pitchRad = (pitch * Math.PI) / 180;
  const yawRad = (yaw * Math.PI) / 180;
  const centerX = width * 0.5;
  const centerY = height * 0.58;
  const scale = width * 0.34;
  const cameraDistance = 6.2;
  const halfSize = 1.04;
  const halfDepth = 0.82;
  const rawVertices = {
    ftl: point3(-halfSize, halfSize, halfDepth),
    ftr: point3(halfSize, halfSize, halfDepth),
    fbr: point3(halfSize, -halfSize, halfDepth),
    fbl: point3(-halfSize, -halfSize, halfDepth),
    btl: point3(-halfSize, halfSize, -halfDepth),
    btr: point3(halfSize, halfSize, -halfDepth),
    bbr: point3(halfSize, -halfSize, -halfDepth),
    bbl: point3(-halfSize, -halfSize, -halfDepth),
  };

  const rotated = Object.fromEntries(
    Object.entries(rawVertices).map(([key, vertex]) => [key, rotatePoint(vertex, pitchRad, yawRad)]),
  );
  const projected = Object.fromEntries(
    Object.entries(rotated).map(([key, vertex]) => [
      key,
      projectPoint(vertex, centerX, centerY, scale, cameraDistance),
    ]),
  );

  const rotatedNormals = {
    F: rotateVector(point3(0, 0, 1), pitchRad, yawRad),
    B: rotateVector(point3(0, 0, -1), pitchRad, yawRad),
    U: rotateVector(point3(0, 1, 0), pitchRad, yawRad),
    D: rotateVector(point3(0, -1, 0), pitchRad, yawRad),
    R: rotateVector(point3(1, 0, 0), pitchRad, yawRad),
    L: rotateVector(point3(-1, 0, 0), pitchRad, yawRad),
  };

  return {
    rotated,
    rotatedNormals,
    baseFront: [projected.ftl, projected.ftr, projected.fbr, projected.fbl],
    facePoints: {
      B: [projected.btr, projected.btl, projected.bbl, projected.bbr],
      U: [projected.btl, projected.btr, projected.ftr, projected.ftl],
      D: [projected.fbl, projected.fbr, projected.bbr, projected.bbl],
      R: [projected.ftr, projected.btr, projected.bbr, projected.fbr],
      L: [projected.btl, projected.ftl, projected.fbl, projected.bbl],
      F: [projected.ftl, projected.ftr, projected.fbr, projected.fbl],
    },
  };
}

function rotatePoint(vertex, pitchRad, yawRad) {
  const cosYaw = Math.cos(yawRad);
  const sinYaw = Math.sin(yawRad);
  const cosPitch = Math.cos(pitchRad);
  const sinPitch = Math.sin(pitchRad);

  const yawed = point3(
    vertex.x * cosYaw + vertex.z * sinYaw,
    vertex.y,
    -vertex.x * sinYaw + vertex.z * cosYaw,
  );

  return point3(
    yawed.x,
    yawed.y * cosPitch - yawed.z * sinPitch,
    yawed.y * sinPitch + yawed.z * cosPitch,
  );
}

function rotateVector(vector, pitchRad, yawRad) {
  return rotatePoint(vector, pitchRad, yawRad);
}

function projectPoint(vertex, centerX, centerY, scale, cameraDistance) {
  const depth = cameraDistance - vertex.z;
  const perspective = scale / depth;
  return point(
    centerX + vertex.x * perspective,
    centerY - vertex.y * perspective,
  );
}

function makeStickerFace(key, geometry, colors, alpha, emphasize = false) {
  return {
    key,
    points: geometry.facePoints[key],
    colors,
    alpha,
    visible: geometry.rotatedNormals[key].z > 0.02,
    depth: averageDepth(geometry, faceVertexKeys(key)),
    emphasize,
  };
}

function faceVertexKeys(key) {
  switch (key) {
    case "B":
      return ["btr", "btl", "bbl", "bbr"];
    case "U":
      return ["btl", "btr", "ftr", "ftl"];
    case "D":
      return ["fbl", "fbr", "bbr", "bbl"];
    case "R":
      return ["ftr", "btr", "bbr", "fbr"];
    case "L":
      return ["btl", "ftl", "fbl", "bbl"];
    default:
      return ["ftl", "ftr", "fbr", "fbl"];
  }
}

function averageDepth(geometry, keys) {
  return (
    keys.reduce((sum, key) => sum + geometry.rotated[key].z, 0) / keys.length
  );
}

function expandQuad(points, scale) {
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }),
    { x: 0, y: 0 },
  );
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale,
  }));
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
