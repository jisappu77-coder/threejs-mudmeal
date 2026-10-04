import bpy
from pathlib import Path
root=Path(__file__).resolve().parent.parent/'public/realism/shrub_04'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'shrub_04.gltf'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
ratio=min(1,3000/triangles)
for o in meshes:
 bpy.context.view_layer.objects.active=o
 modifier=o.modifiers.new('Review mesh budget','DECIMATE');modifier.ratio=ratio
 bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.ops.export_scene.gltf(filepath=str(root/'shrub.glb'),export_format='GLB',export_apply=True)
print('Shrub source triangles',triangles,'reduced ratio',ratio)
