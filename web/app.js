import { RUBIK_COLORS, describeFormula } from "./cube-sim.js";

const state = {
  file: null,
  sourceImage: null,
  cubes: [],
  solvedCubes: [],
  cols: 12,
  rows: 8,
  selectedCubeId: null,
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

const worker = new Worker(new URL("./solver.worker.js", import.meta.url), {
  type: "module",
});

worker.addEventListener("message", (event) => {
  const { type, payload } = event.data;
  if (type === "ready") {
    statusText.textContent = "Solver ready";
    return;
  }

  if (type === "error") {
    statusText.textContent = `Solve failed: ${payload}`;
    solveButton.disabled = false;
    return;
  }

  if (type === "result") {
    state.solvedCubes = payload.map(normalizeCube);
    solveButton.disabled = false;
    statusText.textContent = "Solve complete";
    solveProgress.value = 1;
    progressLabel.textContent = `${payload.length} / ${payload.length}`;
    renderMosaic(state.solvedCubes);
    renderCubeList(state.solvedCubes);
    updateSelection();
  }
});

imageInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  state.file = file;
  state.sourceImage = await loadImage(file);
  statusText.textContent = `Loaded ${file.name}`;
  await generatePreview();
});

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
    solveProgress.value = 0.15;
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
  const cubes = currentSource();
  if (!cubes.length) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const cubeWidth = canvas.width / state.cols;
  const cubeHeight = canvas.height / state.rows;
  const cubeX = Math.floor(x / cubeWidth);
  const cubeY = Math.floor(y / cubeHeight);
  const cube = cubes.find((item) => item.x === cubeX && item.y === cubeY);

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
  progressLabel.textContent = `0 / ${state.cubes.length}`;
  renderMosaic(state.cubes);
  renderCubeList(state.cubes);
  updateSelection();
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
    card.addEventListener("mouseenter", () => {
      state.selectedCubeId = cube.id;
      updateSelection();
    });
    card.addEventListener("click", () => {
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
  const orientation = cube.orientation?.note ?? "Open the 3D view to inspect this cube.";
  selectionInfo.innerHTML = `
    <strong>coords</strong>: (${cube.x}, ${cube.y})<br />
    <strong>center</strong>: ${center.name}<br />
    <strong>hint</strong>: ${orientation}<br />
    <strong>formula</strong>: ${describeFormula(cube)}
  `;
  renderMosaic(source);
}

function openCubeDetail(cube) {
  const source = currentSource();
  sessionStorage.setItem("cube1:selected-cube", JSON.stringify(cube));
  sessionStorage.setItem(
    "cube1:meta",
    JSON.stringify({ cols: state.cols, rows: state.rows, total: source.length }),
  );
  window.location.href = "./detail.html";
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
