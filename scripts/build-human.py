"""Build the review-only human from authored CC0 MakeHuman assets.

blender --background --python scripts/build-human.py -- /tmp/opencode/makehuman-system.zip
The official pack is https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip
No MakeHuman application code is bundled. Proxy fitting follows the documented
mhclo vertex references; authored OBJ UVs and garment topology are preserved.
"""
import bpy
import math
import sys
import urllib.request
import zipfile
import numpy as np
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
PACK = zipfile.ZipFile(sys.argv[sys.argv.index('--') + 1])
CACHE = Path('/tmp/opencode/mudmeals-human-source')
CACHE.mkdir(exist_ok=True)
SOURCE = 'https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/'


def source(path):
    target = CACHE / Path(path).name
    if not target.exists():
        urllib.request.urlretrieve(SOURCE + path, target)
    return target.read_text()


def obj(text):
    positions, uvs, faces, groups = [], [], [], []
    group = ''
    for line in text.splitlines():
        parts = line.split()
        if not parts:
            continue
        if parts[0] == 'v':
            positions.append(Vector(tuple(map(float, parts[1:4]))))
        elif parts[0] == 'vt':
            uvs.append(tuple(map(float, parts[1:3])))
        elif parts[0] == 'g':
            group = ' '.join(parts[1:])
        elif parts[0] == 'f':
            faces.append([(int(p.split('/')[0]) - 1, int(p.split('/')[1]) - 1) for p in parts[1:]])
            groups.append(group)
    return positions, uvs, faces, groups


base, base_uvs, base_faces, base_groups = obj(source('3dobjs/base.obj'))
morphed = [p.copy() for p in base]
for line in source('targets/macrodetails/asian-male-young.target').splitlines():
    parts = line.split()
    if parts and not parts[0].startswith('#'):
        morphed[int(parts[0])] += Vector(tuple(map(float, parts[1:4]))) * .75


def proxy(path):
    positions, uvs, faces, groups = obj(PACK.read(path + '.obj').decode())
    text = PACK.read(path + '.mhclo').decode()
    refs, deleted, scales = [], set(), Vector((1, 1, 1))
    section = ''
    for line in text.splitlines():
        parts = line.split()
        if not parts or parts[0].startswith('#'):
            continue
        if parts[0] in ('x_scale', 'y_scale', 'z_scale'):
            axis = 'xyz'.index(parts[0][0])
            scales[axis] = abs(morphed[int(parts[1])][axis] - morphed[int(parts[2])][axis]) / float(parts[3])
        elif parts[0] in ('verts', 'delete_verts'):
            section = parts[0]
        elif parts[0][0].isdigit():
            if section == 'verts':
                refs.append(parts)
            elif section == 'delete_verts':
                i = 0
                while i < len(parts):
                    start = int(parts[i])
                    if i + 1 < len(parts) and parts[i + 1] == '-':
                        deleted.update(range(start, int(parts[i + 2]) + 1))
                        i += 3
                    else:
                        deleted.add(start)
                        i += 1
    assert len(refs) == len(positions), (path, len(refs), len(positions))
    for i, ref in enumerate(refs):
        if len(ref) == 1:
            positions[i] = morphed[int(ref[0])].copy()
        else:
            positions[i] = sum((morphed[int(ref[j])] * float(ref[j + 3]) for j in range(3)), Vector())
            positions[i] += Vector(tuple(float(ref[6 + a]) * scales[a] for a in range(3)))
    return positions, uvs, faces, groups, deleted


def smoothstep(low, high, value):
    t = max(0, min(1, (value - low) / (high - low)))
    return t * t * (3 - 2 * t)


def pose(point):
    p = point.copy()
    side = 1 if p.x >= 0 else -1
    a = Vector((side * 1.677, 5.245, .146))
    b = Vector((side * 3.13, 3.493, .131))
    c = Vector((side * 4.312, 2.452, 1.756))
    if ((abs(p.x) > 2.7 and p.y > -.7) or (abs(p.x) > 1.5 and p.y > 2.5)) and p.y < 5.8:
        q1 = Quaternion((0, 0, 1), -side * (.44 if side > 0 else .40))
        target_b = a + q1 @ (b - a)
        q2 = (c - b).normalized().rotation_difference(Vector((side * .11, -1, .09)).normalized())
        upper = a + q1 @ (p - a)
        lower = target_b + q2 @ (p - b)
        t = smoothstep(-.1, .45, (p - b).dot(c - b) / (c - b).length_squared)
        p = p.lerp(upper.lerp(lower, t), smoothstep(1.5, 2.0, abs(p.x)))
    if p.y < .85:
        p.x -= side * smoothstep(0, 7, .85 - p.y) * .65
        # A small fore/aft offset and outward foot angle break the rigid symmetry.
        p.z += (.12 if side > 0 else -.09) * smoothstep(0, 6, .85 - p.y)
        if p.y < -6.5:
            pivot = Vector((side * .85, -7.7, .4))
            p = pivot + Quaternion((0, 1, 0), side * .09) @ (p - pivot)
    return p


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def image(path):
    target = CACHE / Path(path).name
    if not target.exists():
        target.write_bytes(PACK.read(path))
    im = bpy.data.images.load(str(target), check_existing=True)
    limit = 1024 if any(s in path for s in ('normal', '_ao', 'hair/', 'eyebrows/')) else 2048
    if max(im.size) > limit:
        factor = limit / max(im.size)
        im.scale(round(im.size[0] * factor), round(im.size[1] * factor))
    if path == 'eyes/materials/brown_eye.png':
        # The source's red-brown iris is very saturated under sun lighting.
        # Preserve its authored radial detail while grading to dark brown.
        pixels = np.array(im.pixels[:], dtype=np.float32).reshape((-1, 4))
        iris = (pixels[:, 0] > pixels[:, 1] * 1.7) & (pixels[:, 0] > pixels[:, 2] * 1.7)
        value = pixels[iris, 0].copy()
        pixels[iris, 0] = value * .32
        pixels[iris, 1] = value * .23
        pixels[iris, 2] = value * .15
        im.pixels.foreach_set(pixels.ravel())
        im.file_format = 'PNG'
        im.filepath_raw = str(CACHE / 'brown-eye-review.png')
        im.save()
    # Colour atlases do not need lossless RGBA. Keep strand/eye alpha lossless.
    if 'diffuse' in path and not path.startswith('hair/'):
        im.file_format = 'JPEG'
        im.filepath_raw = str(CACHE / (Path(path).stem + '-review.jpg'))
        im.save()
    im.pack()
    return im


def material(name, diffuse, roughness=.85, tint=(1, 1, 1, 1), normal=None, ao=None, alpha=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = tint
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Specular IOR Level'].default_value = .25
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = image(diffuse)
    if tint != (1, 1, 1, 1):
        mix = nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1
        mix.inputs[2].default_value = tint
        links.new(tex.outputs['Color'], mix.inputs[1])
        links.new(mix.outputs[0], bsdf.inputs['Base Color'])
    else:
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha:
        links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        mat.blend_method = 'CLIP'
        mat.alpha_threshold = .35
        mat.use_backface_culling = False
    if normal:
        tex_n = nodes.new('ShaderNodeTexImage')
        tex_n.image = image(normal)
        tex_n.image.colorspace_settings.name = 'Non-Color'
        normal_node = nodes.new('ShaderNodeNormalMap')
        normal_node.inputs['Strength'].default_value = .45
        links.new(tex_n.outputs['Color'], normal_node.inputs['Color'])
        links.new(normal_node.outputs['Normal'], bsdf.inputs['Normal'])
    if ao:
        tex_ao = nodes.new('ShaderNodeTexImage')
        tex_ao.image = image(ao)
        tex_ao.image.colorspace_settings.name = 'Non-Color'
        group = bpy.data.node_groups.new(name + ' glTF occlusion', 'ShaderNodeTree')
        group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        group_node = nodes.new('ShaderNodeGroup')
        group_node.node_tree = group
        group_node.name = 'glTF Material Output'
        links.new(tex_ao.outputs['Color'], group_node.inputs['Occlusion'])
    return mat


skin = material('Skin · authored colour atlas', 'skins/young_african_male/young_darkskinned_male_diffuse.png', .68)
outfit_path = 'clothes/male_casualsuit01/male_casualsuit01'
outfit = material('Cotton shirt and denim · seams, pockets, belt', outfit_path + '_diffuse.png', .92,
                  normal=outfit_path + '_normal.png', ao=outfit_path + '_ao.png')
shoes = material('Leather shoes and cotton socks', 'clothes/shoes01/shoes01_diffuse.png', .8,
                 normal='clothes/shoes01/shoes01_normal.png')
hair = material('Short hair · textured black crop', 'hair/short02/short02_diffuse.png', .88,
                tint=(.12, .10, .09, 1), alpha=True)
brows = material('Eyebrows · tapered hair cards', 'eyebrows/eyebrow001/eyebrow001.png', .95, alpha=True)
eyes = material('Brown eyes · iris and sclera atlas', 'eyes/materials/brown_eye.png', .23, alpha=True)

clothing = proxy(outfit_path)
footwear = proxy('clothes/shoes01/shoes01')
deleted = clothing[4] | footwear[4]
body_faces = [f for f, g in zip(base_faces, base_groups) if g == 'body' and not any(v in deleted for v, uv in f)]
assert len(body_faces) > 1000, 'Missing exposed anatomical body'


def mesh(name, positions, uvs, faces, mat, subdivision=1):
    used = sorted({v for f in faces for v, uv in f})
    mapping = {v: i for i, v in enumerate(used)}
    geo = bpy.data.meshes.new(name)
    geo.from_pydata([positions[v] for v in used], [], [[mapping[v] for v, uv in f] for f in faces])
    geo.update()
    uv_layer = geo.uv_layers.new(name='Authored UV')
    for polygon, face in zip(geo.polygons, faces):
        polygon.use_smooth = True
        for loop, (v, uv) in zip(polygon.loop_indices, face):
            uv_layer.data[loop].uv = uvs[uv]
    ob = bpy.data.objects.new(name, geo)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    if subdivision:
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new('Smooth authored surface', 'SUBSURF')
        mod.levels = subdivision
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for vertex in ob.data.vertices:
        vertex.co = pose(vertex.co)
    return ob


body = mesh('Human · face, ears, neck and articulated hands', morphed, base_uvs, body_faces, skin, 2)
# Separate garment objects, preserving the authored collar, cuffs, fly and pockets.
for name, predicate in [('Shirt · collar, placket and cuffs', lambda y: y > .5),
                         ('Jeans · belt, pockets and hems', lambda y: y <= .5)]:
    selected = [f for f in clothing[2] if predicate(sum(clothing[0][v].y for v, uv in f) / len(f))]
    mesh(name, *clothing[:2], selected, outfit)
# The sock shafts are concealed by these full-length jeans. Do not retain
# overlapping upper shafts: they visibly pierced the denim in the close render.
shoe_faces = [f for f in footwear[2] if sum(footwear[0][v].y for v, uv in f) / len(f) < -7.15]
mesh('Footwear · welt, laces and soles', *footwear[:2], shoe_faces, shoes)
for name, path, mat in [('Hair · authored short waves', 'hair/short02/short02', hair),
                         ('Eyebrows · individual textured hairs', 'eyebrows/eyebrow001/eyebrow001', brows),
                         ('Eyes · anatomical brown eyes', 'eyes/high-poly/high-poly', eyes)]:
    fitted = proxy(path)
    part = mesh(name, *fitted[:3], mat, 0 if mat in (hair, brows) else 1)

# Blender Z-up; glTF exporter converts back to Three.js Y-up. One unit = one metre.
objects = list(bpy.context.scene.objects)
low = min(v.co.y for ob in objects for v in ob.data.vertices)
high = max(v.co.y for ob in objects for v in ob.data.vertices)
scale = 1.75 / (high - low)
for ob in objects:
    for v in ob.data.vertices:
        p = v.co.copy()
        v.co = (p.x * scale, -p.z * scale, (p.y - low) * scale)
    ob['reviewOnly'] = True
    ob['source'] = 'MakeHuman system assets CC0 · September 2020 release'
    ob.data.update()

bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/review/customer.glb'), export_format='GLB',
                          export_yup=True, export_extras=True, export_image_format='AUTO')
print('Exported review human:', len(objects), 'meshes; height 1.75 m')
