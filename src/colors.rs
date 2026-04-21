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
        let mut best_distance = f32::MAX;
        let sample_lab = rgb_to_oklab(rgb);

        for color in CubeColor::ALL {
            let palette_lab = rgb_to_oklab(color.rgb());
            let dl = sample_lab[0] - palette_lab[0];
            let da = sample_lab[1] - palette_lab[1];
            let db = sample_lab[2] - palette_lab[2];
            let distance = dl * dl + da * da + db * db;
            if distance < best_distance {
                best_distance = distance;
                best = color;
            }
        }

        best
    }
}

fn rgb_to_oklab(rgb: [u8; 3]) -> [f32; 3] {
    let [r, g, b] = rgb.map(|value| srgb_to_linear(value as f32 / 255.0));

    let l = 0.412_221_46 * r + 0.536_332_55 * g + 0.051_445_995 * b;
    let m = 0.211_903_5 * r + 0.680_699_5 * g + 0.107_396_96 * b;
    let s = 0.088_302_46 * r + 0.281_718_85 * g + 0.629_978_7 * b;

    let l_root = l.cbrt();
    let m_root = m.cbrt();
    let s_root = s.cbrt();

    [
        0.210_454_26 * l_root + 0.793_617_8 * m_root - 0.004_072_047 * s_root,
        1.977_998_5 * l_root - 2.428_592_2 * m_root + 0.450_593_7 * s_root,
        0.025_904_037 * l_root + 0.782_771_77 * m_root - 0.808_675_77 * s_root,
    ]
}

fn srgb_to_linear(value: f32) -> f32 {
    if value <= 0.04045 {
        value / 12.92
    } else {
        ((value + 0.055) / 1.055).powf(2.4)
    }
}
