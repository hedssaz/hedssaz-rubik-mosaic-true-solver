use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CubeColor {
    White = 0,
    Yellow = 1,
    Green = 2,
    Blue = 3,
    Red = 4,
    Orange = 5,
}

impl CubeColor {
    pub const ALL: [CubeColor; 6] = [
        CubeColor::White,
        CubeColor::Yellow,
        CubeColor::Green,
        CubeColor::Blue,
        CubeColor::Red,
        CubeColor::Orange,
    ];

    pub const fn id(self) -> u8 {
        self as u8
    }

    pub const fn rgb(self) -> [u8; 3] {
        match self {
            CubeColor::White => [255, 255, 255],
            CubeColor::Yellow => [255, 213, 0],
            CubeColor::Green => [0, 155, 72],
            CubeColor::Blue => [0, 70, 173],
            CubeColor::Red => [183, 18, 52],
            CubeColor::Orange => [255, 88, 0],
        }
    }

    pub const fn hex(self) -> &'static str {
        match self {
            CubeColor::White => "#FFFFFF",
            CubeColor::Yellow => "#FFD500",
            CubeColor::Green => "#009B48",
            CubeColor::Blue => "#0046AD",
            CubeColor::Red => "#B71234",
            CubeColor::Orange => "#FF5800",
        }
    }

    pub fn nearest(rgb: [u8; 3]) -> CubeColor {
        let mut best = CubeColor::White;
        let mut best_distance = u32::MAX;

        for color in CubeColor::ALL {
            let palette = color.rgb();
            let dr = rgb[0] as i32 - palette[0] as i32;
            let dg = rgb[1] as i32 - palette[1] as i32;
            let db = rgb[2] as i32 - palette[2] as i32;
            let distance = (dr * dr + dg * dg + db * db) as u32;
            if distance < best_distance {
                best_distance = distance;
                best = color;
            }
        }

        best
    }
}
