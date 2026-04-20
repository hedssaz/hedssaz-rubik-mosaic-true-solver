# Rubik Mosaic True-Solver

Turn an input image into a wall-sized Rubik's Cube mosaic, then generate physically valid move sequences for each individual cube.

This project combines:

- image downsampling and 6-color Rubik palette quantization
- per-cube `3x3` target extraction
- a Rust solver for single-face reconstruction planning
- a WebAssembly frontend with wall preview and single-cube 3D playback

## What It Does

Given a target wall size in cubes, the system:

1. Resizes the source image to `cols * 3` by `rows * 3`
2. Maps every pixel to one of the six standard Rubik colors
3. Splits the result into `3x3` cube targets
4. Solves each cube from a valid physical cube state with the target center color oriented on top
5. Exports formulas and previews the final mosaic in the browser

Unlike a simple mosaic pixelator, this project is designed around **true physical reconstruction**: every cube is treated as a real 3x3 Rubik's Cube, and the generated move list is intended to be executable on an actual cube.

## Tech Stack

- Rust for image processing, cube state modeling, and solving
- `wasm-bindgen` + `wasm-pack` for WebAssembly exports
- Plain HTML, CSS, and JavaScript for the browser UI
- Web Worker isolation for browser-side solving

## Project Structure

```text
src/
  colors.rs       Rubik palette and color quantization
  cube.rs         54-sticker cube model and move permutations
  image_map.rs    image resize and mosaic extraction
  model.rs        shared plan and cube data structures
  solver.rs       IDA*-style top-face solver
  wasm.rs         WebAssembly bindings
web/
  index.html      wall planner UI
  detail.html     single-cube 3D detail page
  app.js          wall preview and navigation logic
  detail.js       formula timeline and manual twist controls
  cube-sim.js     browser-side cube simulator
```

## Current Features

- Image-to-mosaic conversion using standard Rubik colors
- Per-cube target extraction
- Center-aware cube orientation
- Move simplification
- Browser preview of the full mosaic wall
- Single-cube 3D detail page
- Step-by-step formula playback
- Manual face turns in the detail view
- Pure-color shortcut handling with no fake `UNSOLVED` output

## Current Solver Scope

The current Rust solver is focused on the **top face target** of each cube.

That means:

- it finds valid move sequences for the visible `3x3` face target
- it does not try to preserve or optimize the other five faces
- it is aimed at practical mosaic building, not full-cube state restoration

This is intentional for Rubik wall construction, where only the displayed face matters.

## Running the CLI

```bash
cargo run -- --input your-image.png --cols 40 --rows 30 --output plan.json
```

Useful options:

- `--resize smart-fill`
- `--resize stretch`
- `--max-depth 8`

## Running the Web App

Build the WebAssembly package:

```bash
wasm-pack build --target web --out-dir web/pkg
```

Serve the repository locally:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/web/
```

## Tests

Run the Rust test suite with:

```bash
cargo test
```

The current tests cover:

- palette matching
- move simplification
- inverse move correctness
- non-white top orientation
- known scramble recovery
- pure-color no-solve behavior

## Roadmap Ideas

- smoother 3D twist animations
- progress streaming from the solver worker
- better large-wall navigation and zooming
- export formats for build instructions
- optional backend mode for large batch solving

## License

MIT
