use std::{fs, path::PathBuf};

use anyhow::Result;
use clap::{Parser, ValueEnum};
use cube1::image_map::load_and_map_image;
use cube1::model::{MosaicConfig, ResizeMode};
use cube1::solver::{SolverConfig, solve_cubes};

#[derive(Debug, Clone, Copy, ValueEnum)]
enum ResizeArg {
    SmartFill,
    Stretch,
}

#[derive(Debug, Parser)]
#[command(author, version, about = "Rubik mosaic true-solver CLI in Rust")]
struct Cli {
    #[arg(long)]
    input: PathBuf,

    #[arg(long)]
    cols: usize,

    #[arg(long)]
    rows: usize,

    #[arg(long, default_value = "smart-fill")]
    resize: ResizeArg,

    #[arg(long, default_value_t = 0.08)]
    max_stretch_ratio: f32,

    #[arg(long, default_value_t = 8)]
    max_depth: usize,

    #[arg(long)]
    output: Option<PathBuf>,

    #[arg(long, default_value_t = true)]
    solve: bool,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let resize_mode = match cli.resize {
        ResizeArg::SmartFill => ResizeMode::SmartFill {
            max_stretch_ratio: cli.max_stretch_ratio,
        },
        ResizeArg::Stretch => ResizeMode::Stretch,
    };

    let config = MosaicConfig {
        cols: cli.cols,
        rows: cli.rows,
        resize_mode,
    };

    let mut plan = load_and_map_image(&cli.input, config)?;

    if cli.solve {
        plan.cubes = solve_cubes(
            plan.cubes,
            SolverConfig {
                max_depth: cli.max_depth,
            },
        );
    }

    let json = serde_json::to_string_pretty(&plan)?;
    if let Some(output) = cli.output {
        fs::write(output, json)?;
    } else {
        println!("{json}");
    }

    Ok(())
}
