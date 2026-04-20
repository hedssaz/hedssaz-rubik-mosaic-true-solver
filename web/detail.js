import {
  RUBIK_COLORS,
  applyMoves,
  buildStatesForFormula,
  describeFormula,
  faceMap,
  formulaStatusLabel,
  manualMoveList,
} from "./cube-sim.js";

const cube = JSON.parse(sessionStorage.getItem("cube1:selected-cube") ?? "null");
const meta = JSON.parse(sessionStorage.getItem("cube1:meta") ?? "{}");

const title = document.getElementById("detailTitle");
const detailStatus = document.getElementById("detailStatus");
const detailInfo = document.getElementById("detailInfo");
const cube3d = document.getElementById("cube3d");
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

if (!cube) {
  title.textContent = "No cube selected";
  detailStatus.textContent = "empty";
  detailInfo.textContent = "Go back to the wall page and choose a cube first.";
} else {
  startDetail();
}

function startDetail() {
  const cleanFormula = cube.formula.filter((move) => !move.startsWith("UNSOLVED"));
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
    cube3d.style.setProperty("--rot-x", `${cameraX.value}deg`);
    cube3d.style.setProperty("--rot-y", `${cameraY.value}deg`);
  }

  function renderState() {
    const baseState = states[currentStep];
    const displayState = applyMoves(baseState, manualMoves);
    const faces = faceMap(displayState);
    renderFace(".face-front", faces.F);
    renderFace(".face-back", faces.B);
    renderFace(".face-right", faces.R);
    renderFace(".face-left", faces.L);
    renderFace(".face-up", faces.U);
    renderFace(".face-down", faces.D);

    stepLabel.textContent = `step ${currentStep}/${states.length - 1}`;
    manualLabel.textContent = `${manualMoves.length} extra turns`;
    formulaChips.querySelectorAll(".chip").forEach((chip, index) => {
      chip.classList.toggle("active", index === currentStep);
    });
  }
}

function renderFace(selector, colors) {
  const face = cube3d.querySelector(selector);
  face.innerHTML = colors
    .map((colorId) => `<span class="sticker" style="background:${RUBIK_COLORS[colorId].hex}"></span>`)
    .join("");
}
