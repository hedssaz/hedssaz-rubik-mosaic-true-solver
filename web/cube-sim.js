export const RUBIK_COLORS = [
  { id: 0, name: "white", hex: "#FFFFFF", rgb: [255, 255, 255] },
  { id: 1, name: "yellow", hex: "#FFD500", rgb: [255, 213, 0] },
  { id: 2, name: "green", hex: "#009B48", rgb: [0, 155, 72] },
  { id: 3, name: "blue", hex: "#0046AD", rgb: [0, 70, 173] },
  { id: 4, name: "red", hex: "#B71234", rgb: [183, 18, 52] },
  { id: 5, name: "orange", hex: "#FF5800", rgb: [255, 88, 0] },
];

const FACE_INDICES = {
  U: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  R: [9, 10, 11, 12, 13, 14, 15, 16, 17],
  F: [18, 19, 20, 21, 22, 23, 24, 25, 26],
  D: [27, 28, 29, 30, 31, 32, 33, 34, 35],
  L: [36, 37, 38, 39, 40, 41, 42, 43, 44],
  B: [45, 46, 47, 48, 49, 50, 51, 52, 53],
};

const ALL_MOVES = [
  "U",
  "U'",
  "U2",
  "R",
  "R'",
  "R2",
  "F",
  "F'",
  "F2",
  "D",
  "D'",
  "D2",
  "L",
  "L'",
  "L2",
  "B",
  "B'",
  "B2",
];

let cachedStickerPositions = null;
let cachedMovePermutations = null;

export function solvedState() {
  return [
    ...Array(9).fill(0),
    ...Array(9).fill(4),
    ...Array(9).fill(2),
    ...Array(9).fill(1),
    ...Array(9).fill(5),
    ...Array(9).fill(3),
  ];
}

export function orientedSolvedState(topColorId) {
  const initial = solvedState();
  if (initial[4] === topColorId) {
    return initial;
  }

  const rotations = [axis(1, 0, 0), axis(0, 1, 0), axis(0, 0, 1)];
  const queue = [initial];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    const signature = faceCenters(current).join("-");
    if (visited.has(signature)) {
      continue;
    }
    visited.add(signature);

    if (current[4] === topColorId) {
      return current;
    }

    rotations.forEach((rotationAxis) => {
      queue.push(rotateWholeCube(current, rotationAxis, 1));
    });
  }

  return initial;
}

export function buildStatesForFormula(topColorId, formula) {
  const cleanFormula = Array.isArray(formula)
    ? formula.filter((move) => typeof move === "string" && !move.startsWith("UNSOLVED"))
    : [];
  const states = [orientedSolvedState(topColorId)];
  let current = states[0];
  cleanFormula.forEach((move) => {
    current = applyMove(current, move);
    states.push(current);
  });
  return states;
}

export function applyMove(state, notation) {
  const permutation = movePermutations()[notation];
  if (!permutation) {
    return [...state];
  }

  const next = new Array(54);
  for (let newIndex = 0; newIndex < 54; newIndex += 1) {
    next[newIndex] = state[permutation[newIndex]];
  }
  return next;
}

export function applyMoves(state, notations) {
  return notations.reduce((acc, move) => applyMove(acc, move), [...state]);
}

export function faceMap(state) {
  return Object.fromEntries(
    Object.entries(FACE_INDICES).map(([face, indices]) => [face, indices.map((index) => state[index])]),
  );
}

export function manualMoveList() {
  return [...ALL_MOVES];
}

export function describeFormula(cube) {
  if (isUniformTarget(cube.target)) {
    return "Pure color target, no solve needed.";
  }
  if (cube.formula?.length) {
    return cube.formula.join(" ");
  }
  if (cube.completed) {
    return "Already matched.";
  }
  return "Formula pending.";
}

export function formulaStatusLabel(cube) {
  if (isUniformTarget(cube.target)) {
    return "No solve needed";
  }
  if (cube.formula?.length) {
    return `${cube.formula.length} moves`;
  }
  if (cube.completed) {
    return "Complete";
  }
  return "Pending";
}

function movePermutations() {
  if (cachedMovePermutations) {
    return cachedMovePermutations;
  }

  const positions = stickerPositions();
  const indexByPos = new Map(positions.map((item, index) => [signature(item), index]));
  cachedMovePermutations = Object.fromEntries(
    ALL_MOVES.map((notation) => {
      const move = parseMove(notation);
      const permutation = new Array(54);
      positions.forEach((position, oldIndex) => {
        let next = { ...position };
        if (isOnFaceLayer(position, move.face)) {
          for (let turn = 0; turn < move.turns; turn += 1) {
            const coords = rotate90([next.x, next.y, next.z], faceAxis(move.face));
            const normal = rotate90([next.nx, next.ny, next.nz], faceAxis(move.face));
            next = {
              x: coords[0],
              y: coords[1],
              z: coords[2],
              nx: normal[0],
              ny: normal[1],
              nz: normal[2],
            };
          }
        }
        permutation[indexByPos.get(signature(next))] = oldIndex;
      });
      return [notation, permutation];
    }),
  );

  return cachedMovePermutations;
}

function rotateWholeCube(state, rotationAxis, turns) {
  const positions = stickerPositions();
  const indexByPos = new Map(positions.map((item, index) => [signature(item), index]));
  const rotated = new Array(54);

  positions.forEach((position, oldIndex) => {
    let next = { ...position };
    for (let turn = 0; turn < turns; turn += 1) {
      const coords = rotate90([next.x, next.y, next.z], rotationAxis);
      const normal = rotate90([next.nx, next.ny, next.nz], rotationAxis);
      next = {
        x: coords[0],
        y: coords[1],
        z: coords[2],
        nx: normal[0],
        ny: normal[1],
        nz: normal[2],
      };
    }
    rotated[indexByPos.get(signature(next))] = state[oldIndex];
  });

  return rotated;
}

function faceCenters(state) {
  return [state[4], state[13], state[22], state[31], state[40], state[49]];
}

function stickerPositions() {
  if (cachedStickerPositions) {
    return cachedStickerPositions;
  }

  const positions = [];

  [-1, 0, 1].forEach((z) => {
    [-1, 0, 1].forEach((x) => {
      positions.push({ x, y: 1, z, nx: 0, ny: 1, nz: 0 });
    });
  });
  [1, 0, -1].forEach((y) => {
    [-1, 0, 1].forEach((z) => {
      positions.push({ x: 1, y, z, nx: 1, ny: 0, nz: 0 });
    });
  });
  [1, 0, -1].forEach((y) => {
    [-1, 0, 1].forEach((x) => {
      positions.push({ x, y, z: 1, nx: 0, ny: 0, nz: 1 });
    });
  });
  [1, 0, -1].forEach((z) => {
    [-1, 0, 1].forEach((x) => {
      positions.push({ x, y: -1, z, nx: 0, ny: -1, nz: 0 });
    });
  });
  [1, 0, -1].forEach((y) => {
    [1, 0, -1].forEach((z) => {
      positions.push({ x: -1, y, z, nx: -1, ny: 0, nz: 0 });
    });
  });
  [1, 0, -1].forEach((y) => {
    [1, 0, -1].forEach((x) => {
      positions.push({ x, y, z: -1, nx: 0, ny: 0, nz: -1 });
    });
  });

  cachedStickerPositions = positions;
  return positions;
}

function parseMove(notation) {
  const face = notation[0];
  const turns = notation.endsWith("2") ? 2 : notation.endsWith("'") ? 3 : 1;
  return { face, turns };
}

function faceAxis(face) {
  switch (face) {
    case "U":
      return axis(0, 1, 0);
    case "R":
      return axis(1, 0, 0);
    case "F":
      return axis(0, 0, 1);
    case "D":
      return axis(0, -1, 0);
    case "L":
      return axis(-1, 0, 0);
    case "B":
      return axis(0, 0, -1);
    default:
      return axis(0, 1, 0);
  }
}

function isOnFaceLayer(position, face) {
  switch (face) {
    case "U":
      return position.y === 1;
    case "D":
      return position.y === -1;
    case "R":
      return position.x === 1;
    case "L":
      return position.x === -1;
    case "F":
      return position.z === 1;
    case "B":
      return position.z === -1;
    default:
      return false;
  }
}

function rotate90([x, y, z], rotationAxis) {
  const { x: ax, y: ay, z: az } = rotationAxis;
  if (ax === 1) {
    return [x, -z, y];
  }
  if (ax === -1) {
    return [x, z, -y];
  }
  if (ay === 1) {
    return [z, y, -x];
  }
  if (ay === -1) {
    return [-z, y, x];
  }
  if (az === 1) {
    return [-y, x, z];
  }
  return [y, -x, z];
}

function signature(position) {
  return `${position.x},${position.y},${position.z},${position.nx},${position.ny},${position.nz}`;
}

function axis(x, y, z) {
  return { x, y, z };
}

function isUniformTarget(target) {
  return target.every((item) => item === target[0]);
}
