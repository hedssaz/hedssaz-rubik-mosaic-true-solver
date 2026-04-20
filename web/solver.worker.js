import init, { solve_cubes_js } from "./pkg/cube1.js";

let ready = null;

async function ensureReady() {
  if (!ready) {
    ready = init();
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
    const result = solve_cubes_js(payload);
    self.postMessage({ type: "result", payload: result });
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
