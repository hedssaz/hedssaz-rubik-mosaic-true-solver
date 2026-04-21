import { RUBIK_COLORS, describeFormula } from "./cube-sim.js?v=20260421g";

const ASSET_VERSION = "20260421g";
const MAIN_STATE_KEY = "cube1:main-state";

const state = {
  file: null,
  sourceImage: null,
  cubes: [],
  solvedCubes: [],
  cols: 12,
  rows: 8,
  selectedCubeId: null,
  lastEditedDimension: "cols",
};

const canvas = document.getElementById("mosaicCanvas");
const ctx = canvas.getContext("2d");
const imageInput = document.getElementById("imageInput");
const colsInput = document.getElementById("colsInput");
const rowsInput = document.getElementById("rowsInput");
const resizeMode = document.getElementById("resizeMode");
const maxDepthInput = document.getElementById("maxDepthInput");
const previewButton = document.getElementById("previewButton");
const solveButton = document.getElementById("solveButton");
const downloadButton = document.getElementById("downloadButton");
const statusText = document.getElementById("statusText");
const progressLabel = document.getElementById("progressLabel");
const solveProgress = document.getElementById("solveProgress");
const selectionBadge = document.getElementById("selectionBadge");
const selectionInfo = document.getElementById("selectionInfo");
const cubeList = document.getElementById("cubeList");

const worker = new Worker(new URL(`./solver.worker.js?v=${ASSET_VERSION}`, import.meta.url), {
  type: "module",
});

restoreMainState();

worker.addEventListener("message", (event) => {
  const { type, payload } = event.data;
  if (type === "ready") {
    statusText.textContent = currentSource().length ? "Solver ready, state restored" : "Solver ready";
    return;
  }

  if (type === "progress") {
    solveProgress.max = Math.max(payload.total ?? 0, 1);
    solveProgress.value = payload.completed ?? 0;
    progressLabel.textContent = `${payload.completed} / ${payload.total}`;
    statusText.textContent = `Solving cube ${payload.completed} of ${payload.total}`;
    return;
  }

  if (type === "error") {
    statusText.textContent = `Solve failed: ${payload}`;
    solveButton.disabled = false;
    persistMainState();
    return;
  }

  if (type === "result") {
    state.solvedCubes = payload.map(normalizeCube);
    solveButton.disabled = false;
    statusText.textContent = "Solve complete";
    solveProgress.max = Math.max(payload.length, 1);
    solveProgress.value = payload.length;
    progressLabel.textContent = `${payload.length} / ${payload.length}`;
    renderMosaic(state.solvedCubes);
    renderCubeList(state.solvedCubes);
    updateSelection();
    persistMainState();
  }
});

imageInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  state.file = file;
  state.sourceImage = await loadImage(file);
  syncDimensionsFromAspect(state.lastEditedDimension);
  statusText.textContent = `Loaded ${file.name}`;
  await generatePreview();
});

colsInput.addEventListener("input", () => {
  state.lastEditedDimension = "cols";
  if (shouldLockAspect()) {
    syncDimensionsFromAspect("cols");
  }
  persistMainState();
});

rowsInput.addEventListener("input", () => {
  state.lastEditedDimension = "rows";
  if (shouldLockAspect()) {
    syncDimensionsFromAspect("rows");
  }
  persistMainState();
});

resizeMode.addEventListener("change", () => {
  if (shouldLockAspect()) {
    syncDimensionsFromAspect(state.lastEditedDimension);
  }
  persistMainState();
});

maxDepthInput.addEventListener("input", persistMainState);

previewButton.addEventListener("click", () => {
  generatePreview().catch(handleError);
});

solveButton.addEventListener("click", async () => {
  try {
    if (!state.cubes.length) {
      await generatePreview();
    }
    if (!state.cubes.length) {
      throw new Error("Please upload an image first.");
    }

    statusText.textContent = "Solving in WASM";
    solveButton.disabled = true;
    solveProgress.max = Math.max(state.cubes.length, 1);
    solveProgress.value = 0;
    progressLabel.textContent = `0 / ${state.cubes.length}`;

    worker.postMessage({
      type: "solve",
      payload: {
        cubes: state.cubes.map(({ id, x, y, target }) => ({ id, x, y, target })),
        max_depth: Number(maxDepthInput.value),
      },
    });
  } catch (error) {
    handleError(error);
  }
});

downloadButton.addEventListener("click", () => {
  const payload = {
    cols: state.cols,
    rows: state.rows,
    cubes: currentSource(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mosaic-plan.json";
  link.click();
  URL.revokeObjectURL(url);
});

canvas.addEventListener("click", (event) => {
  const cube = findCubeFromCanvasEvent(event);
  if (!cube) {
    return;
  }

  state.selectedCubeId = cube.id;
  updateSelection();
  persistMainState();
});

canvas.addEventListener("dblclick", (event) => {
  const cube = findCubeFromCanvasEvent(event);
  if (cube) {
    openCubeDetail(cube);
  }
});

async function generatePreview() {
  if (!state.sourceImage) {
    throw new Error("Please upload an image first.");
  }

  state.cols = Number(colsInput.value);
  state.rows = Number(rowsInput.value);
  state.selectedCubeId = null;
  state.solvedCubes = [];

  const raster = rasterizeToGrid(
    state.sourceImage,
    state.cols * 3,
    state.rows * 3,
    resizeMode.value,
  );
  state.cubes = splitIntoCubes(raster, state.cols, state.rows).map(normalizeCube);

  statusText.textContent = `Preview ready for ${state.cols} x ${state.rows}`;
  solveProgress.value = 0;
  solveProgress.max = Math.max(state.cubes.length, 1);
  progressLabel.textContent = `0 / ${state.cubes.length}`;
  renderMosaic(state.cubes);
  renderCubeList(state.cubes);
  updateSelection();
  persistMainState();
}

function rasterizeToGrid(image, width, height, mode) {
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const offCtx = offscreen.getContext("2d", { willReadFrequently: true });

  const srcRatio = image.width / image.height;
  const dstRatio = width / height;
  const maxStretchRatio = 0.08;
  const stretchRatio = Math.abs(srcRatio / dstRatio - 1);

  if (mode === "stretch" || stretchRatio <= maxStretchRatio) {
    offCtx.drawImage(image, 0, 0, width, height);
  } else {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const dx = (width - drawWidth) / 2;
    const dy = (height - drawHeight) / 2;
    offCtx.drawImage(image, dx, dy, drawWidth, drawHeight);
  }

  return offCtx.getImageData(0, 0, width, height);
}

function splitIntoCubes(imageData, cols, rows) {
  const cubes = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const target = [];
      for (let dy = 0; dy < 3; dy += 1) {
        for (let dx = 0; dx < 3; dx += 1) {
          const pixelX = x * 3 + dx;
          const pixelY = y * 3 + dy;
          const index = (pixelY * imageData.width + pixelX) * 4;
          const rgb = [
            imageData.data[index],
            imageData.data[index + 1],
            imageData.data[index + 2],
          ];
          target.push(nearestRubikColor(rgb).id);
        }
      }

      cubes.push({
        id: cubes.length,
        x,
        y,
        target,
        formula: [],
        completed: isUniformTarget(target),
        orientation: null,
      });
    }
  }
  return cubes;
}

function nearestRubikColor(rgb) {
  let best = RUBIK_COLORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const color of RUBIK_COLORS) {
    const dr = rgb[0] - color.rgb[0];
    const dg = rgb[1] - color.rgb[1];
    const db = rgb[2] - color.rgb[2];
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = color;
    }
  }

  return best;
}

function renderMosaic(cubes) {
  if (!cubes.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const cubeWidth = 48;
  const cubeHeight = 48;
  canvas.width = state.cols * cubeWidth;
  canvas.height = state.rows * cubeHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#090909";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const cube of cubes) {
    drawCube(cube, cubeWidth, cubeHeight);
  }
}

function shouldLockAspect() {
  return resizeMode.value === "smart-fill" && Boolean(state.sourceImage);
}

function syncDimensionsFromAspect(changedDimension) {
  if (!shouldLockAspect()) {
    return;
  }

  const aspectRatio = state.sourceImage.width / state.sourceImage.height;
  const min = 1;
  const max = 120;

  if (changedDimension === "cols") {
    const cols = clampDimension(colsInput.value);
    const rows = clampDimension(Math.round(cols / aspectRatio), min, max);
    colsInput.value = String(cols);
    rowsInput.value = String(rows);
    return;
  }

  const rows = clampDimension(rowsInput.value);
  const cols = clampDimension(Math.round(rows * aspectRatio), min, max);
  rowsInput.value = String(rows);
  colsInput.value = String(cols);
}

function clampDimension(value, min = 1, max = 120) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function drawCube(cube, cubeWidth, cubeHeight) {
  const offsetX = cube.x * cubeWidth;
  const offsetY = cube.y * cubeHeight;
  const stickerSize = cubeWidth / 3;

  for (let index = 0; index < cube.target.length; index += 1) {
    const color = RUBIK_COLORS[cube.target[index]];
    const dx = index % 3;
    const dy = Math.floor(index / 3);
    ctx.fillStyle = color.hex;
    ctx.fillRect(
      offsetX + dx * stickerSize + 2,
      offsetY + dy * stickerSize + 2,
      stickerSize - 4,
      stickerSize - 4,
    );
  }

  ctx.lineWidth = state.selectedCubeId === cube.id ? 3 : 2;
  ctx.strokeStyle = state.selectedCubeId === cube.id ? "#f7d7a1" : "rgba(255,255,255,0.25)";
  ctx.strokeRect(offsetX + 1, offsetY + 1, cubeWidth - 2, cubeHeight - 2);
}

function renderCubeList(cubes) {
  cubeList.innerHTML = "";

  cubes.slice(0, 240).forEach((cube) => {
    const card = document.createElement("button");
    card.className = `cube-card${cube.id === state.selectedCubeId ? " active" : ""}`;
    card.type = "button";
    card.innerHTML = `
      <h3>Cube #${cube.id} (${cube.x}, ${cube.y})</h3>
      <p>${describeFormula(cube)}</p>
      <div class="target-grid">
        ${cube.target
          .map((id) => `<span class="swatch" style="background:${RUBIK_COLORS[id].hex}"></span>`)
          .join("")}
      </div>
    `;
    card.addEventListener("click", () => {
      state.selectedCubeId = cube.id;
      updateSelection();
      persistMainState();
    });
    card.addEventListener("dblclick", () => {
      openCubeDetail(cube);
    });
    cubeList.appendChild(card);
  });
}

function updateSelection() {
  const source = currentSource();
  const cube = source.find((item) => item.id === state.selectedCubeId);

  if (!cube) {
    selectionBadge.textContent = "none";
    selectionInfo.textContent = "Choose a cube to inspect its target colors and formula summary.";
    renderMosaic(source);
    return;
  }

  selectionBadge.textContent = `#${cube.id}`;
  const center = RUBIK_COLORS[cube.target[4]];
  const orientation = cube.orientation?.note ?? "Double-click to inspect this cube in 3D.";
  selectionInfo.innerHTML = `
    <strong>coords</strong>: (${cube.x}, ${cube.y})<br />
    <strong>center</strong>: ${center.name}<br />
    <strong>hint</strong>: ${orientation}<br />
    <strong>formula</strong>: ${describeFormula(cube)}
  `;
  renderMosaic(source);
}

function openCubeDetail(cube) {
  persistMainState();
  localStorage.setItem("cube1:selected-cube", JSON.stringify(cube));
  localStorage.setItem(
    "cube1:meta",
    JSON.stringify({ cols: state.cols, rows: state.rows, total: currentSource().length }),
  );
  window.location.href = `./detail.html?v=${ASSET_VERSION}`;
}

function currentSource() {
  return state.solvedCubes.length ? state.solvedCubes : state.cubes;
}

function normalizeCube(cube) {
  return {
    ...cube,
    completed: cube.completed ?? false,
    formula: Array.isArray(cube.formula) ? cube.formula : [],
  };
}

function isUniformTarget(target) {
  return target.every((item) => item === target[0]);
}

function findCubeFromCanvasEvent(event) {
  const cubes = currentSource();
  if (!cubes.length) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const cubeWidth = canvas.width / state.cols;
  const cubeHeight = canvas.height / state.rows;
  const cubeX = Math.floor(x / cubeWidth);
  const cubeY = Math.floor(y / cubeHeight);
  return cubes.find((item) => item.x === cubeX && item.y === cubeY) ?? null;
}

function persistMainState() {
  const payload = {
    cols: state.cols,
    rows: state.rows,
    cubes: state.cubes,
    solvedCubes: state.solvedCubes,
    selectedCubeId: state.selectedCubeId,
    resizeMode: resizeMode.value,
    maxDepth: Number(maxDepthInput.value),
    lastEditedDimension: state.lastEditedDimension,
  };
  localStorage.setItem(MAIN_STATE_KEY, JSON.stringify(payload));
}

function restoreMainState() {
  const raw = localStorage.getItem(MAIN_STATE_KEY);
  if (!raw) {
    return;
  }

  try {
    const saved = JSON.parse(raw);
    state.cols = saved.cols ?? state.cols;
    state.rows = saved.rows ?? state.rows;
    state.cubes = Array.isArray(saved.cubes) ? saved.cubes.map(normalizeCube) : [];
    state.solvedCubes = Array.isArray(saved.solvedCubes)
      ? saved.solvedCubes.map(normalizeCube)
      : [];
    state.selectedCubeId = saved.selectedCubeId ?? null;
    state.lastEditedDimension = saved.lastEditedDimension ?? state.lastEditedDimension;

    colsInput.value = String(state.cols);
    rowsInput.value = String(state.rows);
    resizeMode.value = saved.resizeMode ?? resizeMode.value;
    maxDepthInput.value = String(saved.maxDepth ?? Number(maxDepthInput.value));

    if (currentSource().length) {
      renderMosaic(currentSource());
      renderCubeList(currentSource());
      solveProgress.max = Math.max(currentSource().length, 1);
      solveProgress.value = state.solvedCubes.length ? currentSource().length : 0;
      progressLabel.textContent = `${currentSource().length} / ${currentSource().length}`;
      statusText.textContent = state.solvedCubes.length
        ? "Restored solved wall"
        : "Restored preview wall";
      updateSelection();
    }
  } catch (error) {
    console.warn("Failed to restore saved wall state", error);
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}

function handleError(error) {
  statusText.textContent = error instanceof Error ? error.message : String(error);
  solveButton.disabled = false;
}
