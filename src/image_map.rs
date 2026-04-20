use anyhow::Result;
use image::{DynamicImage, GenericImageView, RgbImage, imageops::FilterType};

use crate::colors::CubeColor;
use crate::model::{MosaicConfig, MosaicCube, MosaicPlan, OrientationHint, ResizeMode};

pub fn load_and_map_image(path: &std::path::Path, config: MosaicConfig) -> Result<MosaicPlan> {
    let source = image::open(path)?;
    let raster = rasterize_image(source, config);

    let mut cubes = Vec::with_capacity(config.cols * config.rows);
    for y in 0..config.rows {
        for x in 0..config.cols {
            let mut target = [0u8; 9];
            for dy in 0..3 {
                for dx in 0..3 {
                    let pixel = raster.get_pixel((x * 3 + dx) as u32, (y * 3 + dy) as u32).0;
                    let color = CubeColor::nearest([pixel[0], pixel[1], pixel[2]]);
                    target[dy * 3 + dx] = color.id();
                }
            }

            cubes.push(MosaicCube {
                id: cubes.len(),
                x,
                y,
                target,
                formula: Vec::new(),
                completed: false,
                orientation: OrientationHint {
                    up: CubeColor::ALL[target[4] as usize],
                    note: "Pending solver.".to_owned(),
                },
            });
        }
    }

    Ok(MosaicPlan {
        cols: config.cols,
        rows: config.rows,
        pixel_width: config.pixel_width(),
        pixel_height: config.pixel_height(),
        cubes,
    })
}

fn rasterize_image(image: DynamicImage, config: MosaicConfig) -> RgbImage {
    let width = config.pixel_width() as u32;
    let height = config.pixel_height() as u32;

    match config.resize_mode {
        ResizeMode::Stretch => image
            .resize_exact(width, height, FilterType::Lanczos3)
            .to_rgb8(),
        ResizeMode::SmartFill { max_stretch_ratio } => {
            let (src_w, src_h) = image.dimensions();
            let src_ratio = src_w as f32 / src_h as f32;
            let dst_ratio = width as f32 / height as f32;
            let stretch_ratio = (src_ratio / dst_ratio - 1.0).abs();

            if stretch_ratio <= max_stretch_ratio {
                image
                    .resize_exact(width, height, FilterType::Lanczos3)
                    .to_rgb8()
            } else {
                image
                    .resize_to_fill(width, height, FilterType::Lanczos3)
                    .to_rgb8()
            }
        }
    }
}
