use serde::{Deserialize, Serialize};

use crate::colors::CubeColor;

#[derive(Debug, Clone, Copy)]
pub enum ResizeMode {
    SmartFill { max_stretch_ratio: f32 },
    Stretch,
}

#[derive(Debug, Clone, Copy)]
pub struct MosaicConfig {
    pub cols: usize,
    pub rows: usize,
    pub resize_mode: ResizeMode,
}

impl MosaicConfig {
    pub fn pixel_width(&self) -> usize {
        self.cols * 3
    }

    pub fn pixel_height(&self) -> usize {
        self.rows * 3
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrientationHint {
    pub up: CubeColor,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MosaicCube {
    pub id: usize,
    pub x: usize,
    pub y: usize,
    pub target: [u8; 9],
    pub formula: Vec<String>,
    pub completed: bool,
    pub orientation: OrientationHint,
}

impl MosaicCube {
    pub fn target_colors(&self) -> [CubeColor; 9] {
        self.target.map(|id| CubeColor::ALL[id as usize])
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MosaicPlan {
    pub cols: usize,
    pub rows: usize,
    pub pixel_width: usize,
    pub pixel_height: usize,
    pub cubes: Vec<MosaicCube>,
}
