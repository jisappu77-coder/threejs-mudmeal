#!/usr/bin/env python3
"""Generate authored GLB assets used by Mud Meals.

No third-party Python packages are required. The generated files are normal
binary glTF 2.0 assets and are consumed by Three.js GLTFLoader at runtime.
"""
from __future__ import annotations

import json
import math
import os
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models"
WORLD_DIR = MODEL_DIR / "world"


def pad4(data: bytes, fill: bytes = b"\x00") -> bytes:
    return data + fill * ((4 - len(data) % 4) % 4)


class GLB:
    def __init__(self):
        self.bin = bytearray()
        self.buffer_views = []
        self.accessors = []
        self.materials = []
        self.meshes = []
        self.nodes = []
        self.material_map = {}

    def material(self, name, color, metallic=0.0, roughness=0.75):
        key = (name, tuple(color), metallic, roughness)
        if key in self.material_map:
            return self.material_map[key]
        idx = len(self.materials)
        self.material_map[key] = idx
        self.materials.append({
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": [*color, 1.0],
                "metallicFactor": metallic,
                "roughnessFactor": roughness,
            }
        })
        return idx

    def _view(self, raw: bytes, target: int):
        offset = len(self.bin)
        self.bin.extend(raw)
        while len(self.bin) % 4:
            self.bin.append(0)
        idx = len(self.buffer_views)
        self.buffer_views.append({
            "buffer": 0,
            "byteOffset": offset,
            "byteLength": len(raw),
            "target": target,
        })
        return idx

    def _accessor_vec3(self, values):
        flat = [c for v in values for c in v]
        raw = struct.pack("<" + "f" * len(flat), *flat)
        view = self._view(raw, 34962)
        mins = [min(v[i] for v in values) for i in range(3)]
        maxs = [max(v[i] for v in values) for i in range(3)]
        idx = len(self.accessors)
        self.accessors.append({
            "bufferView": view,
            "componentType": 5126,
            "count": len(values),
            "type": "VEC3",
            "min": mins,
            "max": maxs,
        })
        return idx

    def _accessor_indices(self, values):
        use_u32 = max(values, default=0) > 65535
        fmt = "I" if use_u32 else "H"
        raw = struct.pack("<" + fmt * len(values), *values)
        view = self._view(raw, 34963)
        idx = len(self.accessors)
        self.accessors.append({
            "bufferView": view,
            "componentType": 5125 if use_u32 else 5123,
            "count": len(values),
            "type": "SCALAR",
            "min": [min(values, default=0)],
            "max": [max(values, default=0)],
        })
        return idx

    def mesh(self, name, vertices, normals, indices, material):
        p = self._accessor_vec3(vertices)
        n = self._accessor_vec3(normals)
        i = self._accessor_indices(indices)
        mesh_idx = len(self.meshes)
        self.meshes.append({
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": p, "NORMAL": n},
                "indices": i,
                "material": material,
            }]
        })
        node_idx = len(self.nodes)
        self.nodes.append({"name": name, "mesh": mesh_idx})
        return node_idx

    def write(self, path: Path):
        doc = {
            "asset": {"version": "2.0", "generator": "MudMeals Asset Forge"},
            "scene": 0,
            "scenes": [{"nodes": list(range(len(self.nodes)))}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [{"byteLength": len(self.bin)}],
        }
        json_bytes = pad4(json.dumps(doc, separators=(",", ":")).encode(), b" ")
        bin_bytes = pad4(bytes(self.bin))
        total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
        glb = bytearray()
        glb += struct.pack("<III", 0x46546C67, 2, total)
        glb += struct.pack("<I4s", len(json_bytes), b"JSON")
        glb += json_bytes
        glb += struct.pack("<I4s", len(bin_bytes), b"BIN\x00")
        glb += bin_bytes
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(glb)


def transform(v, pos=(0,0,0), scale=(1,1,1), ry=0.0):
    x, y, z = v
    x *= scale[0]; y *= scale[1]; z *= scale[2]
    c = math.cos(ry); s = math.sin(ry)
    x, z = x*c + z*s, -x*s + z*c
    return (x + pos[0], y + pos[1], z + pos[2])


def add_box(g, name, size, pos, mat, ry=0.0):
    sx, sy, sz = [x / 2 for x in size]
    faces = [
        ((-sx,-sy, sz),( sx,-sy, sz),( sx, sy, sz),(-sx, sy, sz),(0,0,1)),
        (( sx,-sy,-sz),(-sx,-sy,-sz),(-sx, sy,-sz),( sx, sy,-sz),(0,0,-1)),
        (( sx,-sy, sz),( sx,-sy,-sz),( sx, sy,-sz),( sx, sy, sz),(1,0,0)),
        ((-sx,-sy,-sz),(-sx,-sy, sz),(-sx, sy, sz),(-sx, sy,-sz),(-1,0,0)),
        ((-sx, sy, sz),( sx, sy, sz),( sx, sy,-sz),(-sx, sy,-sz),(0,1,0)),
        ((-sx,-sy,-sz),( sx,-sy,-sz),( sx,-sy, sz),(-sx,-sy, sz),(0,-1,0)),
    ]
    verts=[]; norms=[]; inds=[]
    for face in faces:
        base=len(verts)
        for p in face[:4]:
            verts.append(transform(p, pos=pos, ry=ry))
            n=face[4]
            norms.append(transform(n, scale=(1,1,1), ry=ry))
            norms[-1]=(norms[-1][0],norms[-1][1],norms[-1][2])
        inds += [base,base+1,base+2, base,base+2,base+3]
    g.mesh(name, verts, norms, inds, mat)


def add_cylinder(g, name, radius, height, pos, mat, segments=24, ry=0.0, axis="y"):
    verts=[]; norms=[]; inds=[]
    for i in range(segments):
        a=2*math.pi*i/segments
        ca,sa=math.cos(a),math.sin(a)
        for y in (-height/2,height/2):
            p=(radius*ca,y,radius*sa)
            n=(ca,0,sa)
            if axis=="x":
                p=(y,radius*ca,radius*sa); n=(0,ca,sa)
            elif axis=="z":
                p=(radius*ca,radius*sa,y); n=(ca,sa,0)
            verts.append(transform(p,pos=pos,ry=ry))
            nn=transform(n,ry=ry); norms.append(nn)
    for i in range(segments):
        a=i*2; b=((i+1)%segments)*2
        inds += [a,b,a+1, b,b+1,a+1]
    g.mesh(name,verts,norms,inds,mat)


def add_uv_sphere(g, name, radius, pos, mat, segments=24, rings=12, scale=(1,1,1)):
    verts=[]; norms=[]; inds=[]
    for r in range(rings+1):
        v=r/rings
        phi=math.pi*v
        for s in range(segments+1):
            u=s/segments
            th=2*math.pi*u
            n=(math.sin(phi)*math.cos(th), math.cos(phi), math.sin(phi)*math.sin(th))
            p=(radius*n[0]*scale[0], radius*n[1]*scale[1], radius*n[2]*scale[2])
            verts.append((p[0]+pos[0],p[1]+pos[1],p[2]+pos[2]))
            norms.append(n)
    for r in range(rings):
        for s in range(segments):
            a=r*(segments+1)+s
            b=a+segments+1
            inds += [a,b,a+1, a+1,b,b+1]
    g.mesh(name,verts,norms,inds,mat)


def add_roof(g, name, width, depth, height, y, mat):
    # two sloped roof slabs, authored as thin boxes
    slope=math.atan2(height, depth/2)
    length=math.sqrt((depth/2)**2+height**2)
    add_box(g,name+"_A",(width*1.08,0.18,length),(0,y+height/2,depth*0.23),mat,ry=0)
    # simple ridge + eaves give more silhouette detail
    add_box(g,name+"_ridge",(width*1.1,0.16,0.18),(0,y+height,0),mat)


def bike(path):
    g=GLB()
    red=g.material("paint",(0.62,0.035,0.025),0.25,0.22)
    black=g.material("black",(0.025,0.028,0.03),0.05,0.55)
    rubber=g.material("rubber",(0.008,0.008,0.008),0.0,0.92)
    metal=g.material("metal",(0.42,0.45,0.48),0.8,0.25)
    skin=g.material("skin",(0.46,0.25,0.14),0.0,0.72)
    jacket=g.material("jacket",(0.06,0.12,0.18),0.0,0.68)
    orange=g.material("delivery",(0.95,0.29,0.04),0.05,0.42)
    glass=g.material("visor",(0.06,0.12,0.16),0.15,0.12)

    for z in (-0.86,0.86):
        add_cylinder(g,f"tire_{z}",0.37,0.14,(0,0.39,z),rubber,32,axis="x")
        add_cylinder(g,f"rim_{z}",0.25,0.15,(0,0.39,z),metal,24,axis="x")
    add_box(g,"frame",(0.35,0.28,1.45),(0,0.66,0),black)
    add_uv_sphere(g,"tank",0.48,(0,0.92,0.1),red,32,16,(0.82,0.62,1.12))
    add_box(g,"seat",(0.52,0.16,0.8),(0,1.0,-0.48),black)
    add_cylinder(g,"fork_l",0.025,0.8,(-0.17,0.72,0.67),metal,12)
    add_cylinder(g,"fork_r",0.025,0.8,(0.17,0.72,0.67),metal,12)
    add_cylinder(g,"handle",0.025,0.76,(0,1.16,0.58),metal,12,axis="x")
    add_cylinder(g,"exhaust",0.065,1.0,(-0.28,0.48,-0.45),metal,16,axis="z")
    add_box(g,"delivery_box",(0.86,0.72,0.72),(0,1.18,-0.95),orange)
    add_box(g,"box_lid",(0.9,0.09,0.76),(0,1.57,-0.95),black)
    add_uv_sphere(g,"rider_torso",0.34,(0,1.58,-0.18),jacket,24,12,(0.8,1.45,0.78))
    add_uv_sphere(g,"helmet",0.27,(0,2.12,0.05),black,28,14,(1,1.03,1.08))
    add_uv_sphere(g,"visor",0.245,(0,2.13,0.16),glass,24,10,(0.9,0.65,0.55))
    for x in (-0.22,0.22):
        add_cylinder(g,"arm",0.055,0.7,(x,1.52,0.28),jacket,12)
        add_cylinder(g,"leg",0.07,0.78,(x,1.08,-0.25),black,12)
    g.write(path)


def kerala_house(path, shop=False):
    g=GLB()
    plaster=g.material("plaster",(0.86,0.67,0.39) if shop else (0.89,0.76,0.52),0,0.82)
    trim=g.material("trim",(0.91,0.88,0.79),0,0.72)
    roof=g.material("roof_tile",(0.50,0.12,0.07),0.02,0.68)
    dark=g.material("frames",(0.08,0.09,0.085),0.08,0.55)
    glass=g.material("glass",(0.16,0.34,0.39),0.05,0.18)
    wood=g.material("wood",(0.28,0.12,0.055),0,0.7)
    awning=g.material("awning",(0.04,0.34,0.40) if shop else (0.44,0.13,0.08),0,0.55)

    add_box(g,"main",(7.8,3.6,6.4),(0,1.8,0),plaster)
    add_box(g,"plinth",(8.2,0.42,6.8),(0,0.21,0),trim)
    add_roof(g,"roof",8.6,7.1,1.5,3.55,roof)
    add_box(g,"ridge",(8.9,0.24,0.28),(0,5.05,0),roof)
    add_box(g,"verandah",(7.2,0.18,1.6),(0,2.0,3.65),awning)
    for x in (-2.2,2.2):
        add_box(g,"pillar",(0.28,2.4,0.28),(x,1.2,3.15),trim)
    add_box(g,"door",(1.25,2.35,0.16),(0,1.18,3.28),wood)
    for x in (-2.1,2.1):
        add_box(g,"window_frame",(1.55,1.45,0.18),(x,1.75,3.3),dark)
        add_box(g,"window_glass",(1.28,1.18,0.08),(x,1.75,3.4),glass)
    if shop:
        add_box(g,"shop_counter",(5.4,1.05,0.75),(0,0.72,3.45),wood)
        add_box(g,"signboard",(5.7,0.92,0.20),(0,3.08,3.36),dark)
        for x in (-2.4,-1.2,0,1.2,2.4):
            add_cylinder(g,"awning_support",0.035,1.45,(x,1.85,3.9),trim,10)
    else:
        for x in (-2.8,2.8):
            add_box(g,"side_column",(0.24,2.2,0.24),(x,1.1,2.9),trim)
        add_box(g,"steps",(2.2,0.22,1.2),(0,0.11,3.6),trim)
    g.write(path)


def auto_rickshaw(path):
    g=GLB()
    yellow=g.material("yellow",(0.94,0.55,0.03),0.12,0.45)
    black=g.material("black",(0.018,0.02,0.018),0,0.74)
    glass=g.material("glass",(0.10,0.25,0.28),0.05,0.16)
    rubber=g.material("rubber",(0.006,0.006,0.006),0,0.95)
    metal=g.material("metal",(0.4,0.43,0.44),0.75,0.28)

    add_box(g,"lower",(1.55,0.78,2.25),(0,0.78,0),yellow)
    add_box(g,"cabin",(1.48,1.25,1.55),(0,1.65,-0.18),black)
    add_box(g,"roof",(1.62,0.16,1.85),(0,2.32,-0.15),yellow)
    add_box(g,"windscreen",(1.2,0.82,0.08),(0,1.72,0.82),glass)
    add_box(g,"front_apron",(1.25,0.58,0.20),(0,0.95,1.18),yellow)
    for x,z in ((0,0.92),(-0.62,-0.75),(0.62,-0.75)):
        add_cylinder(g,"wheel",0.32,0.14,(x,0.34,z),rubber,24,axis="x" if x else "y")
    add_cylinder(g,"handle",0.025,0.8,(0,1.35,0.58),metal,12,axis="x")
    g.write(path)


def bus(path):
    g=GLB()
    red=g.material("bus_red",(0.58,0.07,0.045),0.12,0.42)
    cream=g.material("cream",(0.83,0.72,0.54),0.0,0.7)
    glass=g.material("glass",(0.08,0.20,0.24),0.04,0.16)
    rubber=g.material("rubber",(0.008,0.008,0.008),0,0.95)
    metal=g.material("metal",(0.36,0.39,0.4),0.72,0.3)

    add_box(g,"body",(2.65,2.1,6.9),(0,1.3,0),red)
    add_box(g,"upper",(2.68,1.35,6.85),(0,2.78,0),cream)
    add_box(g,"roof",(2.82,0.22,7.05),(0,3.57,0),cream)
    add_box(g,"front_glass",(2.28,1.18,0.08),(0,2.72,3.46),glass)
    add_box(g,"rear_glass",(2.2,1.0,0.08),(0,2.72,-3.46),glass)
    for side in (-1,1):
        for z in (-2.5,-1.3,-0.1,1.1,2.3):
            add_box(g,"side_window",(0.08,0.85,0.92),(side*1.35,2.75,z),glass)
    for x in (-1.05,1.05):
        for z in (-2.35,2.25):
            add_cylinder(g,"wheel",0.45,0.18,(x,0.5,z),rubber,28,axis="x")
            add_cylinder(g,"hub",0.24,0.19,(x,0.5,z),metal,20,axis="x")
    add_box(g,"bumper",(2.55,0.24,0.22),(0,0.55,3.53),metal)
    g.write(path)


def palm(path):
    g=GLB()
    trunk=g.material("trunk",(0.34,0.20,0.10),0,0.92)
    leaf=g.material("leaf",(0.05,0.34,0.09),0,0.62)
    coconut=g.material("coconut",(0.18,0.11,0.045),0,0.78)
    # segmented leaning trunk
    for i in range(8):
        y=0.48+i*0.88
        x=0.03*i*i/8
        add_cylinder(g,f"trunk_{i}",0.26-0.012*i,0.95,(x,y,0),trunk,18,ry=-0.01*i)
    crown=(0.28,7.55,0)
    for i in range(14):
        a=2*math.pi*i/14
        # three overlapping leaf segments create a curved frond
        for j in range(3):
            r=0.9+j*0.95
            x=crown[0]+math.cos(a)*r
            z=math.sin(a)*r
            y=crown[1]+0.1-j*0.18
            add_box(g,f"frond_{i}_{j}",(0.52,0.06,1.65),(x,y,z),leaf,ry=-a)
    for i in range(6):
        a=2*math.pi*i/6
        add_uv_sphere(g,"coconut",0.18,(crown[0]+math.cos(a)*0.35,crown[1]-0.3,math.sin(a)*0.35),coconut,16,8)
    g.write(path)


def bridge(path):
    g=GLB()
    concrete=g.material("bridge_concrete",(0.62,0.58,0.50),0.0,0.82)
    asphalt=g.material("bridge_asphalt",(0.14,0.15,0.16),0.0,0.92)
    metal=g.material("bridge_metal",(0.34,0.36,0.36),0.72,0.28)
    flower=g.material("flowers",(0.82,0.08,0.22),0.0,0.62)
    pot=g.material("pots",(0.48,0.23,0.10),0.0,0.82)

    add_box(g,"deck",(20.0,0.72,11.6),(0,0.36,0),concrete)
    add_box(g,"road",(20.0,0.14,9.35),(0,0.79,0),asphalt)
    add_box(g,"left_edge",(20.2,0.4,0.55),(0,0.96,-5.52),concrete)
    add_box(g,"right_edge",(20.2,0.4,0.55),(0,0.96,5.52),concrete)

    for z in (-5.55,5.55):
        for x in [i*2.1-8.4 for i in range(9)]:
            add_box(g,"rail_post",(0.22,1.35,0.26),(x,1.55,z),concrete)
        add_box(g,"rail_top",(18.4,0.16,0.18),(0,2.16,z),metal)
        add_box(g,"rail_mid",(18.4,0.14,0.16),(0,1.62,z),metal)
        for x in (-7.2,-4.0,-0.8,2.4,5.6):
            add_cylinder(g,"flower_pot",0.18,0.36,(x,1.4,z),pot,12)
            add_uv_sphere(g,"flower",0.26,(x,1.75,z),flower,14,8,(1.0,0.7,1.0))

    g.write(path)


def utility_pole(path):
    g=GLB()
    concrete=g.material("concrete",(0.46,0.45,0.41),0,0.9)
    metal=g.material("metal",(0.20,0.22,0.22),0.72,0.34)
    ceramic=g.material("insulator",(0.18,0.22,0.18),0.05,0.42)
    add_cylinder(g,"pole",0.12,7.4,(0,3.7,0),concrete,18)
    add_box(g,"crossarm",(2.6,0.16,0.18),(0,6.7,0),metal)
    add_box(g,"lower_arm",(1.9,0.12,0.14),(0,5.9,0),metal)
    for x in (-1.05,0,1.05):
        add_cylinder(g,"insulator",0.07,0.35,(x,6.96,0),ceramic,12)
    g.write(path)


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    WORLD_DIR.mkdir(parents=True, exist_ok=True)

    bike(MODEL_DIR / "delivery-bike.glb")
    kerala_house(WORLD_DIR / "kerala-house.glb", False)
    kerala_house(WORLD_DIR / "kerala-shop.glb", True)
    auto_rickshaw(WORLD_DIR / "auto-rickshaw.glb")
    bus(WORLD_DIR / "ksrtc-bus.glb")
    palm(WORLD_DIR / "coconut-palm.glb")
    bridge(WORLD_DIR / "bridge.glb")
    utility_pole(WORLD_DIR / "utility-pole.glb")

    for path in [
        MODEL_DIR / "delivery-bike.glb",
        WORLD_DIR / "kerala-house.glb",
        WORLD_DIR / "kerala-shop.glb",
        WORLD_DIR / "auto-rickshaw.glb",
        WORLD_DIR / "ksrtc-bus.glb",
        WORLD_DIR / "coconut-palm.glb",
        WORLD_DIR / "bridge.glb",
        WORLD_DIR / "utility-pole.glb",
    ]:
        print(f"generated {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
