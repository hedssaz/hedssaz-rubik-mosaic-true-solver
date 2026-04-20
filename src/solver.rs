use anyhow::{Result, anyhow};

#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;

use crate::colors::CubeColor;
use crate::cube::{CubeState, Face, Move, simplify_moves};
use crate::model::{MosaicCube, OrientationHint};

#[derive(Debug, Clone, Copy)]
pub struct SolverConfig {
    pub max_depth: usize,
}

impl Default for SolverConfig {
    fn default() -> Self {
        Self { max_depth: 8 }
    }
}

fn heuristic(state: &CubeState, target: &[CubeColor; 9]) -> usize {
    state.top_mismatch_count(target).div_ceil(3)
}

fn depth_limited_search(
    state: &mut CubeState,
    target: &[CubeColor; 9],
    g: usize,
    bound: usize,
    previous: Option<Move>,
    path: &mut Vec<Move>,
) -> Result<Option<usize>> {
    let f = g + heuristic(state, target);
    if f > bound {
        return Ok(Some(f));
    }

    if state.matches_top(target) {
        return Ok(None);
    }

    let mut next_bound: Option<usize> = None;

    for mv in Move::ALL {
        if let Some(last) = previous
            && mv.face() == last.face()
        {
            continue;
        }

        state.apply_move(mv);
        path.push(mv);

        match depth_limited_search(state, target, g + 1, bound, Some(mv), path)? {
            None => return Ok(None),
            Some(candidate) => {
                next_bound = Some(next_bound.map_or(candidate, |value| value.min(candidate)));
            }
        }

        path.pop();
        state.apply_move(mv.inverse());
    }

    Ok(next_bound)
}

pub fn solve_top_face(target: [CubeColor; 9], config: SolverConfig) -> Result<Vec<Move>> {
    let mut state = CubeState::oriented_for_top(target[4])?;

    if state.matches_top(&target) {
        return Ok(Vec::new());
    }

    let mut bound = heuristic(&state, &target);
    let mut path = Vec::new();

    while bound <= config.max_depth {
        match depth_limited_search(&mut state, &target, 0, bound, None, &mut path)? {
            None => return Ok(simplify_moves(&path)),
            Some(next) => bound = next,
        }
    }

    Err(anyhow!(
        "no solution found within max depth {} for top-face target",
        config.max_depth
    ))
}

pub fn solve_cubes(mut cubes: Vec<MosaicCube>, config: SolverConfig) -> Vec<MosaicCube> {
    #[cfg(not(target_arch = "wasm32"))]
    let iter = cubes.par_iter_mut();

    #[cfg(target_arch = "wasm32")]
    let iter = cubes.iter_mut();

    iter.for_each(|cube| {
        let target = cube.target_colors();
        let orientation = OrientationHint {
            up: target[4],
            note: format!("Start with {} face up.", target[4].hex()),
        };
        cube.orientation = orientation;

        if target.iter().all(|color| *color == target[0]) {
            cube.formula = Vec::new();
            cube.completed = true;
            return;
        }

        match solve_top_face(target, config) {
            Ok(moves) => {
                cube.formula = moves.iter().map(|mv| mv.notation().to_owned()).collect();
                cube.completed = cube.formula.is_empty();
            }
            Err(error) => {
                cube.formula = vec![format!("UNSOLVED: {error}")];
                cube.completed = false;
            }
        }
    });

    cubes
}

pub fn uniform_face(color: CubeColor) -> [CubeColor; 9] {
    [color; 9]
}

#[allow(dead_code)]
fn _same_axis(a: Face, b: Face) -> bool {
    matches!(
        (a, b),
        (Face::U, Face::D)
            | (Face::D, Face::U)
            | (Face::L, Face::R)
            | (Face::R, Face::L)
            | (Face::F, Face::B)
            | (Face::B, Face::F)
    )
}
