import os
import sys
import bpy
import mathutils

def find_asset_files():
    possible_dirs = [
        os.path.abspath("./raw_assets"),
        os.path.abspath("./.raw_assets"),
        os.path.abspath("."),
    ]
    blend_path = None
    texture_dir = None

    for d in possible_dirs:
        if os.path.exists(d):
            for f in os.listdir(d):
                if f.lower().endswith(".blend") and "curiosity" in f.lower():
                    blend_path = os.path.join(d, f)
                    texture_dir = d
                    break
        if blend_path:
            break

    return blend_path, texture_dir

def main():
    print("=== NASA Curiosity .blend to .glb Asset Pipeline ===")
    blend_path, texture_dir = find_asset_files()

    if not blend_path:
        print("ERROR: Could not locate Curiosity .blend file in ./raw_assets or workspace root.")
        sys.exit(1)

    print(f"Loading .blend file: {blend_path}")
    print(f"Texture search directory: {texture_dir}")

    # Open the Curiosity .blend file
    bpy.ops.wm.open_mainfile(filepath=blend_path)

    # 1. Relink Textures
    if texture_dir and os.path.exists(texture_dir):
        print("Relinking missing textures...")
        try:
            bpy.ops.file.find_missing_files(directory=texture_dir)
        except Exception as e:
            print(f"Warning during find_missing_files: {e}")

    # Ensure in Object Mode
    if bpy.context.mode != 'OBJECT':
        try:
            bpy.ops.object.mode_set(mode='OBJECT')
        except Exception:
            pass

    # 2. Remove Studio Lights, Backdrop, and Fake Ground Shadows
    for obj in list(bpy.data.objects):
        name_lower = obj.name.lower()
        if any(k in name_lower for k in ['_hemi', 'light', 'lamp', 'camera', 'studio', 'backdrop', 'floor']):
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        if obj.type == 'MESH':
            mats = [m.name.lower() for m in obj.data.materials if m] if obj.data else []
            if 'shadow' in name_lower or 'shadow2' in mats:
                print(f"Removing studio shadow plane: {obj.name}")
                bpy.data.objects.remove(obj, do_unlink=True)

    # 3. Clear Geometry from Dummy Pivot Helpers
    # In NASA's 3D file, pivot helpers were authored as dummy cube meshes with 'pivot' material.
    # By calling clear_geometry(), they become zero-vertex transform nodes (Empties) so they maintain
    # the entire rigging parent-child hierarchy without rendering any visible white boxes.
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj.data:
            mats = [m.name.lower() for m in obj.data.materials if m]
            if 'pivot' in mats or obj.name.endswith('_p') or obj.name.startswith('_root'):
                print(f"Clearing dummy mesh geometry from pivot helper: {obj.name}")
                obj.data.clear_geometry()

    # Clear all keyframe animations so rover components remain solidly in nominal rest pose
    for obj in bpy.data.objects:
        if obj.animation_data:
            obj.animation_data_clear()

    # Locate root transform object (_root_p)
    root = bpy.data.objects.get('_root_p')
    if not root:
        roots = [o for o in bpy.data.objects if o.parent is None]
        root = roots[0] if roots else None

    if not root:
        print("ERROR: Could not find root object in blend file.")
        sys.exit(1)

    root.hide_viewport = False
    root.hide_render = False
    try:
        root.hide_set(False)
    except Exception:
        pass

    # 4. Compute Bounding Box of Actual Visible Rover Meshes
    active_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.data and len(o.data.vertices) > 0]
    print(f"Found {len(active_meshes)} active rover mesh components.")

    min_v = mathutils.Vector((float('inf'), float('inf'), float('inf')))
    max_v = mathutils.Vector((float('-inf'), float('-inf'), float('-inf')))

    for m in active_meshes:
        for corner in m.bound_box:
            v_world = m.matrix_world @ mathutils.Vector(corner)
            min_v.x = min(min_v.x, v_world.x)
            min_v.y = min(min_v.y, v_world.y)
            min_v.z = min(min_v.z, v_world.z)
            max_v.x = max(max_v.x, v_world.x)
            max_v.y = max(max_v.y, v_world.y)
            max_v.z = max(max_v.z, v_world.z)

    dim = max_v - min_v
    center = (min_v + max_v) / 2.0
    longest_dim = max(dim.x, dim.y, dim.z)
    s = 3.0 / longest_dim if longest_dim > 0 else 1.0

    print(f"True rover dimensions: Width={dim.x:.3f}m, Length={dim.y:.3f}m, Height={dim.z:.3f}m")
    print(f"Scale factor: {s:.5f} (scaling to 3.0m Three.js standard)")

    # 5. Apply Scale & Translation to Root Object ONLY
    root.scale = (s, s, s)
    root.location = (-center.x * s, -center.y * s, -min_v.z * s)
    bpy.context.view_layer.update()

    # 6. Export Optimized GLB
    output_dir = os.path.abspath("./public/models")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "curiosity.glb")

    print(f"Exporting optimized web-ready GLB to: {output_path}")

    try:
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format='GLB',
            use_selection=False,
            export_animations=False,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
            export_image_format='AUTO',
            export_materials='EXPORT',
            export_cameras=False,
            export_lights=False
        )
        print("GLB export succeeded with Draco compression.")
    except Exception as e:
        print(f"Draco export failed ({e}), falling back to standard GLB...")
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format='GLB',
            use_selection=False,
            export_animations=False,
            export_draco_mesh_compression_enable=False,
            export_materials='EXPORT',
            export_cameras=False,
            export_lights=False
        )
        print("Standard GLB export succeeded.")

    if os.path.exists(output_path):
        file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"SUCCESS: Generated {output_path} ({file_size_mb:.2f} MB)")
    else:
        print("ERROR: Output file was not created.")
        sys.exit(1)

if __name__ == "__main__":
    main()
