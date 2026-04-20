use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::OnceLock;

use anyhow::{Result, anyhow};
use serde::Serialize;

use crate::colors::CubeColor;

pub const U_FACE: [usize; 9] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum Face {
    U,
    R,
    F,
    D,
    L,
    B,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Move {
    U,
    Up,
    U2,
    R,
    Rp,
    R2,
    F,
    Fp,
    F2,
    D,
    Dp,
    D2,
    L,
    Lp,
    L2,
    B,
    Bp,
    B2,
}

impl Move {
    pub const ALL: [Move; 18] = [
        Move::U,
        Move::Up,
        Move::U2,
        Move::R,
        Move::Rp,
        Move::R2,
        Move::F,
        Move::Fp,
        Move::F2,
        Move::D,
        Move::Dp,
        Move::D2,
        Move::L,
        Move::Lp,
        Move::L2,
        Move::B,
        Move::Bp,
        Move::B2,
    ];

    pub const fn face(self) -> Face {
        match self {
            Move::U | Move::Up | Move::U2 => Face::U,
            Move::R | Move::Rp | Move::R2 => Face::R,
            Move::F | Move::Fp | Move::F2 => Face::F,
            Move::D | Move::Dp | Move::D2 => Face::D,
            Move::L | Move::Lp | Move::L2 => Face::L,
            Move::B | Move::Bp | Move::B2 => Face::B,
        }
    }

    pub const fn turns(self) -> u8 {
        match self {
            Move::U | Move::R | Move::F | Move::D | Move::L | Move::B => 1,
            Move::U2 | Move::R2 | Move::F2 | Move::D2 | Move::L2 | Move::B2 => 2,
            Move::Up | Move::Rp | Move::Fp | Move::Dp | Move::Lp | Move::Bp => 3,
        }
    }

    pub const fn inverse(self) -> Move {
        match self {
            Move::U => Move::Up,
            Move::Up => Move::U,
            Move::U2 => Move::U2,
            Move::R => Move::Rp,
            Move::Rp => Move::R,
            Move::R2 => Move::R2,
            Move::F => Move::Fp,
            Move::Fp => Move::F,
            Move::F2 => Move::F2,
            Move::D => Move::Dp,
            Move::Dp => Move::D,
            Move::D2 => Move::D2,
            Move::L => Move::Lp,
            Move::Lp => Move::L,
            Move::L2 => Move::L2,
            Move::B => Move::Bp,
            Move::Bp => Move::B,
            Move::B2 => Move::B2,
        }
    }

    pub const fn notation(self) -> &'static str {
        match self {
            Move::U => "U",
            Move::Up => "U'",
            Move::U2 => "U2",
            Move::R => "R",
            Move::Rp => "R'",
            Move::R2 => "R2",
            Move::F => "F",
            Move::Fp => "F'",
            Move::F2 => "F2",
            Move::D => "D",
            Move::Dp => "D'",
            Move::D2 => "D2",
            Move::L => "L",
            Move::Lp => "L'",
            Move::L2 => "L2",
            Move::B => "B",
            Move::Bp => "B'",
            Move::B2 => "B2",
        }
    }

    fn from_face_turns(face: Face, turns: u8) -> Option<Move> {
        match (face, turns % 4) {
            (_, 0) => None,
            (Face::U, 1) => Some(Move::U),
            (Face::U, 2) => Some(Move::U2),
            (Face::U, 3) => Some(Move::Up),
            (Face::R, 1) => Some(Move::R),
            (Face::R, 2) => Some(Move::R2),
            (Face::R, 3) => Some(Move::Rp),
            (Face::F, 1) => Some(Move::F),
            (Face::F, 2) => Some(Move::F2),
            (Face::F, 3) => Some(Move::Fp),
            (Face::D, 1) => Some(Move::D),
            (Face::D, 2) => Some(Move::D2),
            (Face::D, 3) => Some(Move::Dp),
            (Face::L, 1) => Some(Move::L),
            (Face::L, 2) => Some(Move::L2),
            (Face::L, 3) => Some(Move::Lp),
            (Face::B, 1) => Some(Move::B),
            (Face::B, 2) => Some(Move::B2),
            (Face::B, 3) => Some(Move::Bp),
            _ => None,
        }
    }
}

pub fn simplify_moves(moves: &[Move]) -> Vec<Move> {
    let mut simplified: Vec<Move> = Vec::new();

    for mv in moves {
        if let Some(last) = simplified.last().copied()
            && last.face() == mv.face()
        {
            simplified.pop();
            let turns = (last.turns() + mv.turns()) % 4;
            if let Some(combined) = Move::from_face_turns(last.face(), turns) {
                simplified.push(combined);
            }
        } else {
            simplified.push(*mv);
        }
    }

    simplified
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct StickerPos {
    x: i8,
    y: i8,
    z: i8,
    nx: i8,
    ny: i8,
    nz: i8,
}

#[derive(Debug, Clone, Copy)]
struct Axis {
    x: i8,
    y: i8,
    z: i8,
}

impl Axis {
    const fn new(x: i8, y: i8, z: i8) -> Self {
        Self { x, y, z }
    }
}

fn rotate90(value: (i8, i8, i8), axis: Axis) -> (i8, i8, i8) {
    let (x, y, z) = value;
    match (axis.x, axis.y, axis.z) {
        (1, 0, 0) => (x, -z, y),
        (-1, 0, 0) => (x, z, -y),
        (0, 1, 0) => (z, y, -x),
        (0, -1, 0) => (-z, y, x),
        (0, 0, 1) => (-y, x, z),
        (0, 0, -1) => (y, -x, z),
        _ => unreachable!("axis must be unit"),
    }
}

fn face_axis(face: Face) -> Axis {
    match face {
        Face::U => Axis::new(0, 1, 0),
        Face::R => Axis::new(1, 0, 0),
        Face::F => Axis::new(0, 0, 1),
        Face::D => Axis::new(0, -1, 0),
        Face::L => Axis::new(-1, 0, 0),
        Face::B => Axis::new(0, 0, -1),
    }
}

fn is_on_face_layer(pos: StickerPos, face: Face) -> bool {
    match face {
        Face::U => pos.y == 1,
        Face::D => pos.y == -1,
        Face::R => pos.x == 1,
        Face::L => pos.x == -1,
        Face::F => pos.z == 1,
        Face::B => pos.z == -1,
    }
}

fn sticker_positions() -> &'static [StickerPos; 54] {
    static POSITIONS: OnceLock<[StickerPos; 54]> = OnceLock::new();
    POSITIONS.get_or_init(|| {
        let mut items = [StickerPos {
            x: 0,
            y: 0,
            z: 0,
            nx: 0,
            ny: 0,
            nz: 0,
        }; 54];

        let mut index = 0;

        for z in [-1, 0, 1] {
            for x in [-1, 0, 1] {
                items[index] = StickerPos {
                    x,
                    y: 1,
                    z,
                    nx: 0,
                    ny: 1,
                    nz: 0,
                };
                index += 1;
            }
        }

        for y in [1, 0, -1] {
            for z in [-1, 0, 1] {
                items[index] = StickerPos {
                    x: 1,
                    y,
                    z,
                    nx: 1,
                    ny: 0,
                    nz: 0,
                };
                index += 1;
            }
        }

        for y in [1, 0, -1] {
            for x in [-1, 0, 1] {
                items[index] = StickerPos {
                    x,
                    y,
                    z: 1,
                    nx: 0,
                    ny: 0,
                    nz: 1,
                };
                index += 1;
            }
        }

        for z in [1, 0, -1] {
            for x in [-1, 0, 1] {
                items[index] = StickerPos {
                    x,
                    y: -1,
                    z,
                    nx: 0,
                    ny: -1,
                    nz: 0,
                };
                index += 1;
            }
        }

        for y in [1, 0, -1] {
            for z in [1, 0, -1] {
                items[index] = StickerPos {
                    x: -1,
                    y,
                    z,
                    nx: -1,
                    ny: 0,
                    nz: 0,
                };
                index += 1;
            }
        }

        for y in [1, 0, -1] {
            for x in [1, 0, -1] {
                items[index] = StickerPos {
                    x,
                    y,
                    z: -1,
                    nx: 0,
                    ny: 0,
                    nz: -1,
                };
                index += 1;
            }
        }

        items
    })
}

fn move_permutations() -> &'static HashMap<Move, [usize; 54]> {
    static PERMS: OnceLock<HashMap<Move, [usize; 54]>> = OnceLock::new();
    PERMS.get_or_init(|| {
        let positions = sticker_positions();
        let index_by_pos: HashMap<StickerPos, usize> = positions
            .iter()
            .enumerate()
            .map(|(i, pos)| (*pos, i))
            .collect();

        let mut map = HashMap::new();

        for mv in Move::ALL {
            let mut permutation = [0usize; 54];
            let face = mv.face();
            let turns = mv.turns();

            for (old_index, pos) in positions.iter().copied().enumerate() {
                let mut next = pos;
                if is_on_face_layer(pos, face) {
                    for _ in 0..turns {
                        let axis = face_axis(face);
                        let rotated = rotate90((next.x, next.y, next.z), axis);
                        let normal = rotate90((next.nx, next.ny, next.nz), axis);
                        next = StickerPos {
                            x: rotated.0,
                            y: rotated.1,
                            z: rotated.2,
                            nx: normal.0,
                            ny: normal.1,
                            nz: normal.2,
                        };
                    }
                }

                let new_index = *index_by_pos
                    .get(&next)
                    .expect("rotated sticker must resolve to an index");
                permutation[new_index] = old_index;
            }

            map.insert(mv, permutation);
        }

        map
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CubeState {
    stickers: [CubeColor; 54],
}

impl CubeState {
    pub fn solved() -> Self {
        let mut stickers = [CubeColor::White; 54];
        for slot in stickers.iter_mut().take(9) {
            *slot = CubeColor::White;
        }
        for slot in stickers.iter_mut().take(18).skip(9) {
            *slot = CubeColor::Red;
        }
        for slot in stickers.iter_mut().take(27).skip(18) {
            *slot = CubeColor::Green;
        }
        for slot in stickers.iter_mut().take(36).skip(27) {
            *slot = CubeColor::Yellow;
        }
        for slot in stickers.iter_mut().take(45).skip(36) {
            *slot = CubeColor::Orange;
        }
        for slot in stickers.iter_mut().skip(45) {
            *slot = CubeColor::Blue;
        }
        Self { stickers }
    }

    pub fn oriented_for_top(top: CubeColor) -> Result<Self> {
        let solved = CubeState::solved();
        if solved.stickers[4] == top {
            return Ok(solved);
        }

        let rotations = [Axis::new(1, 0, 0), Axis::new(0, 1, 0), Axis::new(0, 0, 1)];
        let mut queue = VecDeque::from([solved]);
        let mut visited = HashSet::new();

        while let Some(state) = queue.pop_front() {
            let signature = state.face_centers();
            if !visited.insert(signature) {
                continue;
            }

            if state.stickers[4] == top {
                return Ok(state);
            }

            for axis in rotations {
                let mut next = state.clone();
                next.rotate_cube(axis, 1);
                queue.push_back(next);
            }
        }

        Err(anyhow!("unable to orient cube with {:?} on top", top))
    }

    pub fn face_centers(&self) -> [CubeColor; 6] {
        [
            self.stickers[4],
            self.stickers[13],
            self.stickers[22],
            self.stickers[31],
            self.stickers[40],
            self.stickers[49],
        ]
    }

    pub fn apply_move(&mut self, mv: Move) {
        let perm = move_permutations()
            .get(&mv)
            .expect("permutation must exist for every move");
        let old = self.stickers;
        for new_index in 0..54 {
            self.stickers[new_index] = old[perm[new_index]];
        }
    }

    pub fn apply_moves(&mut self, moves: &[Move]) {
        for mv in moves {
            self.apply_move(*mv);
        }
    }

    fn rotate_cube(&mut self, axis: Axis, turns: u8) {
        let positions = sticker_positions();
        let index_by_pos: HashMap<StickerPos, usize> = positions
            .iter()
            .enumerate()
            .map(|(i, pos)| (*pos, i))
            .collect();

        let mut rotated = self.stickers;
        for (old_index, pos) in positions.iter().copied().enumerate() {
            let mut next = pos;
            for _ in 0..turns {
                let coords = rotate90((next.x, next.y, next.z), axis);
                let normal = rotate90((next.nx, next.ny, next.nz), axis);
                next = StickerPos {
                    x: coords.0,
                    y: coords.1,
                    z: coords.2,
                    nx: normal.0,
                    ny: normal.1,
                    nz: normal.2,
                };
            }

            let new_index = *index_by_pos
                .get(&next)
                .expect("rotated cube sticker must resolve to an index");
            rotated[new_index] = self.stickers[old_index];
        }

        self.stickers = rotated;
    }

    pub fn top_face(&self) -> [CubeColor; 9] {
        U_FACE.map(|idx| self.stickers[idx])
    }

    pub fn matches_top(&self, target: &[CubeColor; 9]) -> bool {
        self.top_face() == *target
    }

    pub fn top_mismatch_count(&self, target: &[CubeColor; 9]) -> usize {
        self.top_face()
            .iter()
            .zip(target.iter())
            .filter(|(a, b)| a != b)
            .count()
    }
}
