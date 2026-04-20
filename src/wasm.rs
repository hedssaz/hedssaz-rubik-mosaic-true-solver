use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::model::{MosaicCube, OrientationHint};
use crate::solver::{SolverConfig, solve_cubes};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmCubeInput {
    pub id: usize,
    pub x: usize,
    pub y: usize,
    pub target: [u8; 9],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmSolveRequest {
    pub cubes: Vec<WasmCubeInput>,
    pub max_depth: Option<usize>,
}

#[wasm_bindgen]
pub fn solve_cubes_js(request: JsValue) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();

    let request: WasmSolveRequest = serde_wasm_bindgen::from_value(request).map_err(js_error)?;

    let cubes = request
        .cubes
        .into_iter()
        .map(|cube| MosaicCube {
            id: cube.id,
            x: cube.x,
            y: cube.y,
            target: cube.target,
            formula: Vec::new(),
            completed: false,
            orientation: OrientationHint {
                up: crate::colors::CubeColor::ALL[cube.target[4] as usize],
                note: "Pending solver.".to_owned(),
            },
        })
        .collect();

    let solved = solve_cubes(
        cubes,
        SolverConfig {
            max_depth: request.max_depth.unwrap_or(8),
        },
    );

    serde_wasm_bindgen::to_value(&solved).map_err(js_error)
}

fn js_error(error: impl ToString) -> JsValue {
    JsValue::from_str(&error.to_string())
}
