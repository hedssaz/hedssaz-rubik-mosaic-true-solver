pub mod colors;
pub mod cube;
pub mod image_map;
pub mod model;
pub mod solver;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

#[cfg(test)]
mod tests {
    use crate::colors::CubeColor;
    use crate::cube::{CubeState, Move, simplify_moves};
    use crate::solver::{SolverConfig, solve_top_face, uniform_face};

    #[test]
    fn nearest_palette_color_matches_red() {
        assert_eq!(CubeColor::nearest([190, 20, 60]), CubeColor::Red);
    }

    #[test]
    fn simplify_adjacent_turns() {
        let simplified = simplify_moves(&[Move::R, Move::R, Move::Rp]);
        assert_eq!(simplified, vec![Move::R]);
    }

    #[test]
    fn move_followed_by_inverse_restores_state() {
        let mut state = CubeState::solved();
        state.apply_move(Move::F);
        state.apply_move(Move::Fp);
        assert_eq!(state, CubeState::solved());
    }

    #[test]
    fn uniform_face_requires_no_moves() {
        let solution =
            solve_top_face(uniform_face(CubeColor::White), SolverConfig::default()).unwrap();
        assert!(solution.is_empty());
    }

    #[test]
    fn non_white_top_orientation_is_supported() {
        for color in [
            CubeColor::Green,
            CubeColor::Red,
            CubeColor::Blue,
            CubeColor::Orange,
            CubeColor::Yellow,
        ] {
            let solution = solve_top_face(uniform_face(color), SolverConfig::default()).unwrap();
            assert!(solution.is_empty(), "{color:?} should support zero-move uniform target");
        }
    }

    #[test]
    fn uniform_cube_is_marked_complete_without_unsolved_formula() {
        let cubes = vec![crate::model::MosaicCube {
            id: 0,
            x: 0,
            y: 0,
            target: [2; 9],
            formula: vec!["placeholder".to_owned()],
            completed: false,
            orientation: crate::model::OrientationHint {
                up: CubeColor::Green,
                note: String::new(),
            },
        }];

        let solved = crate::solver::solve_cubes(cubes, SolverConfig::default());
        assert!(solved[0].completed);
        assert!(solved[0].formula.is_empty());
    }

    #[test]
    fn solver_recovers_known_scramble_projection() {
        let mut state = CubeState::oriented_for_top(CubeColor::White).unwrap();
        state.apply_moves(&[Move::R, Move::U, Move::F]);
        let target = state.top_face();

        let solution = solve_top_face(target, SolverConfig { max_depth: 6 }).unwrap();

        let mut replay = CubeState::oriented_for_top(CubeColor::White).unwrap();
        replay.apply_moves(&solution);
        assert_eq!(replay.top_face(), target);
    }
}
