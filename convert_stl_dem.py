#!/usr/bin/env python3
"""
convert_stl_dem.py - Automated Mars Trek .STL to DEM Heightmap Pipeline

Bakes 3D printable terrain meshes downloaded from NASA Mars Trek (e.g. trekSTL.stl)
into an optimized, 256x256 8-bit grayscale Digital Elevation Model (DEM) heightmap
at public/terrains/gale_crater_dem.png.

Pipeline Steps:
1. Parse Binary / ASCII STL triangles.
2. Strip 3D-print flat bottom baseplate (z <= z.min() + 1e-4).
3. Rasterize onto a 256x256 elevation grid with nearest-neighbor fill for empty cells.
4. Apply 1px Gaussian blur to eliminate 8-bit stair-stepping.
5. Normalize to 0-255 and save as 8-bit grayscale PNG.
"""

import os
import sys
import glob
import struct
import numpy as np
from PIL import Image, ImageFilter

try:
    from scipy.ndimage import distance_transform_edt
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


def find_stl_file(candidate_path=None):
    """Locate the target STL file in the workspace or raw_assets."""
    if candidate_path and os.path.isfile(candidate_path):
        return os.path.abspath(candidate_path)

    search_dirs = [".", "./raw_assets"]
    explicit_names = [
        "trekSTL.stl",
        "trekstl.stl",
        "gale_crater.stl",
        "GaleCrater.stl",
        "gale_crater_dem.stl",
    ]

    for d in search_dirs:
        for name in explicit_names:
            p = os.path.join(d, name)
            if os.path.isfile(p):
                return os.path.abspath(p)

    # Search for any *.stl in search directories
    for d in search_dirs:
        matches = glob.glob(os.path.join(d, "*.stl")) + glob.glob(os.path.join(d, "*.STL"))
        if matches:
            return os.path.abspath(matches[0])

    return None


def parse_binary_stl(filepath):
    """Parse triangles from a standard binary STL file using numpy."""
    file_size = os.path.getsize(filepath)
    if file_size < 84:
        return None

    with open(filepath, "rb") as f:
        header = f.read(80)
        num_triangles = struct.unpack("<I", f.read(4))[0]

        expected_size = 84 + num_triangles * 50
        if file_size != expected_size:
            # Not a matching binary STL
            return None

        # Triangle record layout:
        # normal (3 floats) + v0 (3 floats) + v1 (3 floats) + v2 (3 floats) + attr (uint16) = 50 bytes
        tri_dtype = np.dtype([
            ("normal", np.float32, (3,)),
            ("v0", np.float32, (3,)),
            ("v1", np.float32, (3,)),
            ("v2", np.float32, (3,)),
            ("attr", np.uint16)
        ])
        data = np.fromfile(f, dtype=tri_dtype, count=num_triangles)

    vertices = np.concatenate([data["v0"], data["v1"], data["v2"]], axis=0)
    return vertices


def parse_ascii_stl(filepath):
    """Fallback parser for ASCII STL files."""
    vertices = []
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if line.startswith("vertex"):
                parts = line.split()
                if len(parts) >= 4:
                    vertices.append([float(parts[1]), float(parts[2]), float(parts[3])])
    if not vertices:
        return None
    return np.array(vertices, dtype=np.float32)


def convert_stl_to_dem(stl_path, output_png_path, grid_size=256, blur_radius=1.0):
    """Execute the full STL to DEM rasterization pipeline."""
    print(f"[Step 0B] Loading Mars Trek STL: {stl_path}")

    # 1. Parse STL (Binary with ASCII fallback)
    vertices = parse_binary_stl(stl_path)
    if vertices is None:
        print("[Step 0B] Attempting ASCII STL fallback parser...")
        vertices = parse_ascii_stl(stl_path)

    if vertices is None or len(vertices) == 0:
        raise ValueError(f"Failed to read valid vertices from STL: {stl_path}")

    total_vertices = len(vertices)
    print(f"[Step 0B] Total vertices extracted: {total_vertices:,}")

    # 2. Strip 3D-Print Baseplate (z <= z.min() + 1e-4)
    z = vertices[:, 2]
    z_min = float(z.min())
    baseplate_threshold = z_min + 1e-4
    terrain_mask = z > baseplate_threshold

    terrain_vertices = vertices[terrain_mask]
    stripped_count = total_vertices - len(terrain_vertices)
    print(
        f"[Step 0B] Baseplate stripped (Z <= {baseplate_threshold:.4f}): "
        f"{stripped_count:,} vertices removed ({stripped_count / total_vertices * 100:.1f}%)"
    )
    print(f"[Step 0B] Martian terrain vertices: {len(terrain_vertices):,}")

    if len(terrain_vertices) == 0:
        raise ValueError("No terrain vertices remaining after baseplate removal.")

    x = terrain_vertices[:, 0]
    y = terrain_vertices[:, 1]
    tz = terrain_vertices[:, 2]

    x_min, x_max = float(x.min()), float(x.max())
    y_min, y_max = float(y.min()), float(y.max())
    z_terrain_min, z_terrain_max = float(tz.min()), float(tz.max())
    print(f"[Step 0B] Terrain Bounds -> X: [{x_min:.1f}, {x_max:.1f}] | Y: [{y_min:.1f}, {y_max:.1f}] | Z: [{z_terrain_min:.2f}, {z_terrain_max:.2f}]")

    # 3. Rasterize onto 256x256 grid recording maximum Z per cell
    # Map X to column [0, grid_size-1]
    gx = np.clip(
        np.floor((x - x_min) / (x_max - x_min + 1e-9) * (grid_size - 1)).astype(int),
        0,
        grid_size - 1,
    )
    # Map Y to row [0, grid_size-1] with row 0 = top/North (y_max)
    gy = np.clip(
        np.floor((y_max - y) / (y_max - y_min + 1e-9) * (grid_size - 1)).astype(int),
        0,
        grid_size - 1,
    )

    grid = np.full((grid_size, grid_size), -np.inf, dtype=np.float32)
    flat_indices = gy * grid_size + gx
    np.maximum.at(grid.ravel(), flat_indices, tz)

    # Fill any empty cells via nearest-neighbor interpolation
    empty_cells = np.isneginf(grid)
    num_empty = int(np.sum(empty_cells))
    if num_empty > 0:
        print(f"[Step 0B] Filling {num_empty} empty interior cells via nearest-neighbor...")
        if HAS_SCIPY:
            indices = distance_transform_edt(empty_cells, return_distances=False, return_indices=True)
            grid = grid[tuple(indices)]
        else:
            # Fallback iterative fill
            valid_mean = float(np.mean(grid[~empty_cells])) if np.any(~empty_cells) else 0.0
            grid[empty_cells] = valid_mean

    # 4. Normalize elevation values to 0–255
    min_elev = float(grid.min())
    max_elev = float(grid.max())
    elev_range = max_elev - min_elev if max_elev > min_elev else 1.0
    normalized = ((grid - min_elev) / elev_range * 255.0).clip(0, 255).astype(np.uint8)

    # 5. Apply subtle 1px Gaussian blur to eliminate 8-bit quantization stair-stepping
    raw_img = Image.fromarray(normalized, mode="L")
    smoothed_img = raw_img.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    # Save 8-bit Grayscale DEM
    os.makedirs(os.path.dirname(os.path.abspath(output_png_path)), exist_ok=True)
    smoothed_img.save(output_png_path, format="PNG")

    file_size_kb = os.path.getsize(output_png_path) / 1024.0
    print(f"[Step 0B] SUCCESS: Baked 256x256 DEM heightmap to {output_png_path} ({file_size_kb:.1f} KB)")
    print(f"[Step 0B] Elevation range normalized: [{min_elev:.2f} m -> {max_elev:.2f} m] -> [0 -> 255]")


def main():
    candidate = sys.argv[1] if len(sys.argv) > 1 else None
    stl_path = find_stl_file(candidate)

    output_path = os.path.join("public", "terrains", "gale_crater_dem.png")

    if not stl_path:
        print("[Step 0B] No NASA Mars Trek .stl file found in ./ or ./raw_assets/.")
        print("[Step 0B] Skipping Step 0B cleanly; relying on procedural Gale Crater DEM fallback.")
        sys.exit(0)

    try:
        convert_stl_to_dem(stl_path, output_path, grid_size=256, blur_radius=1.0)
    except Exception as e:
        print(f"[Step 0B] Error baking STL DEM: {e}", file=sys.stderr)
        print("[Step 0B] Relying on procedural Gale Crater DEM fallback.")
        sys.exit(1)


if __name__ == "__main__":
    main()

