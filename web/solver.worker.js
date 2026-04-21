const ASSET_VERSION = "20260421h";

import init, { solve_cube_js } from "./pkg/cube1.js?v=20260421h";

let ready = null;

async function ensureReady() {
  if (!ready) {
    ready = init(new URL(`./pkg/cube1_bg.wasm?v=${ASSET_VERSION}`, import.meta.url));
  }
  await ready;
}

self.addEventListener("message", async (event) => {
  const { type, payload } = event.data;
  if (type !== "solve") {
    return;
  }

  try {
    await ensureReady();

    const total = payload.cubes.length;
    const results = [];

    for (let index = 0; index < total; index += 1) {
      const cube = payload.cubes[index];
      const solved = solve_cube_js({
        cube,
        max_depth: payload.max_depth,
      });
      results.push(solved);

      self.postMessage({
        type: "progress",
        payload: {
          completed: index + 1,
          total,
          cube_id: cube.id,
        },
      });
    }

    self.postMessage({ type: "result", payload: results });
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: error instanceof Error ? error.message : String(error),
    });
  }
});

ensureReady()
  .then(() => self.postMessage({ type: "ready" }))
  .catch((error) =>
    self.postMessage({
      type: "error",
      payload: error instanceof Error ? error.message : String(error),
    }),
  );
