"""Export game crowd variants from the approved CC0 human source.
blender --background --python scripts/build-npcs.py -- /tmp/opencode/makehuman-system.zip
"""
import importlib.util
import json
from pathlib import Path
import bpy
from mathutils import Vector

spec = importlib.util.spec_from_file_location('human', Path(__file__).with_name('build-human.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
h.IMAGE_LIMIT = 1024
h.ARM_THRESHOLD = 1.9

# CC0 authored skin weights keep seams and fingers attached through articulation.
source_weights = json.loads(h.source('rigs/default_weights.mhw'))
assert source_weights['license'] == 'CC0'
body_weights = [{} for p in h.base]
def reduced_bone(name):
    side = 'l' if name.endswith('.L') else 'r'
    if name.startswith('upperarm'): return 'arm_' + side
    if name.startswith('lowerarm'): return 'forearm_' + side
    if name.startswith(('wrist', 'finger', 'metacarpal')): return 'hand_' + side
    if name.startswith('upperleg'): return 'thigh_' + side
    if name.startswith('lowerleg'): return 'shin_' + side
    if name.startswith(('foot', 'toe')): return 'foot_' + side
    if name.startswith('neck'): return 'neck'
    if name.startswith(('root', 'pelvis', 'spine04', 'spine05')): return 'pelvis'
    if name.startswith(('spine', 'clavicle', 'shoulder', 'breast')): return 'spine'
    return 'head'
for name, entries in source_weights['weights'].items():
    bone = reduced_bone(name)
    for vertex, weight in entries:
        body_weights[vertex][bone] = body_weights[vertex].get(bone, 0) + weight

def proxy_weights(path):
    result, reading = [], False
    for line in h.PACK.read(path + '.mhclo').decode().splitlines():
        values = line.split()
        if not values or values[0].startswith('#'): continue
        if values[0] == 'verts': reading = True; continue
        if values[0] == 'delete_verts': reading = False; continue
        if not reading or not values[0][0].isdigit(): continue
        refs = [(int(values[0]), 1)] if len(values) == 1 else [(int(values[i]), float(values[i + 3])) for i in range(3)]
        weights = {}
        for vertex, contribution in refs:
            for name, weight in body_weights[vertex].items():
                weights[name] = weights.get(name, 0) + max(0, contribution) * weight
        total = sum(weights.values())
        result.append({name: weight / total for name, weight in weights.items()} if total else {'pelvis': 1})
    return result

# Authored garment cuts and hairstyles, rather than one recoloured uniform.
styles = [
    ('collared', 'male', 'male_casualsuit01', 'short02', 'shoes01', 1.75),
    ('striped', 'male', 'male_casualsuit03', 'short04', 'shoes02', 1.72),
    ('casual', 'male', 'male_casualsuit06', 'short01', 'shoes02', 1.78),
    ('ponytail', 'female', 'female_casualsuit01', 'ponytail01', 'shoes02', 1.65),
]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
roots = []

for style, gender, garment, hairstyle, shoe, height in styles:
    h.morphed = [p.copy() for p in h.base]
    for line in h.source(f'targets/macrodetails/asian-{gender}-young.target').splitlines():
        values = line.split()
        if values and not values[0].startswith('#'):
            h.morphed[int(values[0])] += Vector(tuple(map(float, values[1:4]))) * .75
    outfit_path = f'clothes/{garment}/{garment}'
    skin_path = 'skins/young_african_male/young_darkskinned_male_diffuse.png' if gender == 'male' else 'skins/young_african_female/young_darkskinned_female_diffuse.png'
    skin = h.material('Skin ' + style, skin_path, .75)
    outfit = h.material('Fabric ' + style, outfit_path + '_diffuse.png', .94,
                        normal=outfit_path + '_normal.png', ao=outfit_path + '_ao.png')
    shoes = h.material('Footwear ' + style, f'clothes/{shoe}/{shoe}_diffuse.png', .85)
    hair = h.material('Short hair ' + style, f'hair/{hairstyle}/{hairstyle}_diffuse.png', .9,
                      tint=(.12, .1, .09, 1), alpha=True)
    brows = h.material('Eyebrows ' + style, 'eyebrows/eyebrow001/eyebrow001.png', .95, alpha=True)
    eyes = h.material('Brown eyes ' + style, 'eyes/materials/brown_eye.png', .35, alpha=True)
    clothing, footwear = h.proxy(outfit_path), h.proxy(f'clothes/{shoe}/{shoe}')
    deleted = clothing[4] | footwear[4]
    body_faces = [f for f, g in zip(h.base_faces, h.base_groups) if g == 'body' and not any(v in deleted for v, uv in f)]
    objects = [h.mesh('Body', h.morphed, h.base_uvs, body_faces, skin, 1, body_weights)]
    for name, predicate in [('Top', lambda y: y > .5), ('Trousers', lambda y: y <= .5)]:
        faces = [f for f in clothing[2] if predicate(sum(clothing[0][v].y for v, uv in f) / len(f))]
        objects.append(h.mesh(name, *clothing[:2], faces, outfit, 1, proxy_weights(outfit_path)))
    faces = [f for f in footwear[2] if sum(footwear[0][v].y for v, uv in f) / len(f) < -7.15]
    objects.append(h.mesh('Shoes', *footwear[:2], faces, shoes, 1, proxy_weights(f'clothes/{shoe}/{shoe}')))
    for name, path, mat in [('Hair', f'hair/{hairstyle}/{hairstyle}', hair),
                           ('Brows', 'eyebrows/eyebrow001/eyebrow001', brows),
                           ('Eyes', 'eyes/high-poly/high-poly', eyes)]:
        fitted = h.proxy(path)
        objects.append(h.mesh(name, *fitted[:3], mat, 0, [{'head': 1} for p in fitted[0]]))

    low = min(v.co.y for ob in objects for v in ob.data.vertices)
    high = max(v.co.y for ob in objects for v in ob.data.vertices)
    scale = height / (high - low)
    def convert(p):
        return Vector((p.x * scale, -p.z * scale, (p.y - low) * scale))
    def joint(name):
        ids = {v for f, group in zip(h.base_faces, h.base_groups) if group == 'joint-' + name for v, uv in f}
        return convert(h.pose(sum((h.morphed[i] for i in ids), Vector()) / len(ids)))

    root = bpy.data.objects.new(style, None)
    root['style'] = style
    root['height'] = height
    root['source'] = 'MakeHuman CC0 system assets, September 2020'
    bpy.context.collection.objects.link(root)
    roots.append(root)
    arm = bpy.data.armatures.new(style + ' skeleton')
    rig = bpy.data.objects.new(style + ' rig', arm)
    bpy.context.collection.objects.link(rig)
    rig.parent = root
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    locations = {'pelvis': joint('pelvis'), 'spine': joint('spine-3'), 'neck': joint('neck'), 'head': joint('head')}
    parents = {'pelvis': None, 'spine': 'pelvis', 'neck': 'spine', 'head': 'neck'}
    for side in ['l', 'r']:
        for name, source, parent in [('thigh', 'upper-leg', 'pelvis'), ('shin', 'knee', f'thigh_{side}'),
                                     ('foot', 'ankle', f'shin_{side}'), ('arm', 'shoulder', 'spine'),
                                     ('forearm', 'elbow', f'arm_{side}'), ('hand', 'hand', f'forearm_{side}')]:
            locations[f'{name}_{side}'] = joint(f'{side}-{source}')
            parents[f'{name}_{side}'] = parent
    for name, position in locations.items():
        bone = arm.edit_bones.new(name)
        bone.head, bone.tail = position, position + Vector((0, 0, .1))
        if parents[name]:
            bone.parent = arm.edit_bones[parents[name]]
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.select_set(False)

    for ob in objects:
        for v in ob.data.vertices:
            v.co = convert(v.co)
        # Preserve the authored face and garment UVs while reducing crowd cost.
        if len(ob.data.polygons) > 1500:
            bpy.context.view_layer.objects.active = ob
            mod = ob.modifiers.new('Game mesh reduction', 'DECIMATE')
            mod.ratio = .4
            bpy.ops.object.modifier_apply(modifier=mod.name)
        ob.parent = rig
        modifier = ob.modifiers.new('Articulated customer', 'ARMATURE')
        modifier.object = rig
        ob.data.update()

out = h.ROOT / 'public/characters/crowd.glb'
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True,
                          export_extras=True, export_image_format='AUTO')
print('Exported', len(roots), 'rigged crowd styles:', out)
