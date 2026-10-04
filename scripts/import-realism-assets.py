"""Download CC0 Poly Haven assets for the contained realism review scene."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT=Path('public/realism')
MODELS=['fern_02','grass_medium_01','rock_moss_set_01','island_tree_01','shrub_04']
TEXTURES=['gravel_ground_01','asphalt_02','grass_ground','plastered_wall_04','clay_roof_tiles_02']
def get(url):
    request=urllib.request.Request(url,headers={'User-Agent':'MudMeals-realism-review/1.0'})
    with urllib.request.urlopen(request,timeout=90) as response:return response.read()
def files(name):return json.loads(get('https://api.polyhaven.com/files/'+name))
def download(job):
    path,entry=job;path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists() and hashlib.md5(path.read_bytes()).hexdigest()==entry['md5']:return
    data=get(entry['url'])
    if hashlib.md5(data).hexdigest()!=entry['md5']:raise ValueError('Asset checksum mismatch: '+str(path))
    path.write_bytes(data)
jobs=[];metadata={}
for name in MODELS:
    metadata[name]=files(name);entry=metadata[name]['gltf']['1k']['gltf'];directory=ROOT/name
    jobs.append((directory/(name+'.gltf'),entry))
    for filename,part in entry['include'].items():jobs.append((directory/filename,part))
for name in TEXTURES:
    data=files(name)
    for channel,field in [('diff','Diffuse'),('normal','nor_gl'),('arm','arm')]:jobs.append((ROOT/name/(channel+'.jpg'),data[field]['1k']['jpg']))
for name,target in [('rainforest_trail','lighting.hdr'),('kloofendal_48d_partly_cloudy_puresky','sky.hdr')]:
    data=files(name);jobs.append((ROOT/target,data['hdri']['1k']['hdr']))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(download,jobs))
from PIL import Image
for name in MODELS:
    directory=ROOT/name;path=directory/(name+'.gltf');g=json.loads(path.read_text())
    for material in g['materials']:
        if material.get('alphaMode') not in ('MASK','BLEND'):continue
        image=g['images'][g['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
        field='leaves_alpha' if name=='island_tree_01' else 'Alpha';formats=metadata[name][field]['1k'];entry=formats.get('png',formats.get('jpg'));alpha=directory/'source-alpha.png';download((alpha,entry))
        old=directory/image['uri'];rgb=Image.open(old).convert('RGBA');rgb.putalpha(Image.open(alpha).convert('L').resize(rgb.size));target=old.with_suffix('.png');rgb.save(target);image['uri']=str(target.relative_to(directory));image['mimeType']='image/png';material['alphaMode']='MASK';material['alphaCutoff']=.4
    path.write_text(json.dumps(g))
ROOT.mkdir(parents=True,exist_ok=True)
(ROOT/'LICENSE.txt').write_text('Poly Haven assets: CC0 1.0. https://polyhaven.com/license\nSources: '+', '.join('https://polyhaven.com/a/'+name for name in MODELS+TEXTURES+['rainforest_trail','kloofendal_48d_partly_cloudy_puresky'])+'\nTree geometry is reduced for this review sample; source materials are preserved.\nOriginal game bike and human assets retain their existing licences.\nTea foliage atlas is an original generated project asset; supplied reference photographs are not redistributed. Tea bark reuses CC0 island_tree_01.\nTerrain: NASA/USGS SRTM 30m via Open Topo Data. Road coordinates: OpenStreetMap contributors, ODbL 1.0.\n')
print('Downloaded',len(jobs),'verified asset files; CC0 provenance saved.')
