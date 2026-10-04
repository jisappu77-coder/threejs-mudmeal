"""Compress reviewed CC0 texture derivatives without changing their dimensions or alpha."""
import io
import json
from pathlib import Path
import struct
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent/'public/realism'
def jpeg(data,name):
    output=io.BytesIO()
    Image.open(io.BytesIO(data)).save(output,format='JPEG',quality=92 if any(k in name.lower() for k in ['normal','nor_','arm','rough']) else 87,optimize=True)
    return output.getvalue()

before=after=0
for path in ROOT.rglob('*.jpg'):
    original=path.read_bytes();compressed=jpeg(original,path.name)
    before+=len(original)
    if len(compressed)<len(original):path.write_bytes(compressed)
    after+=path.stat().st_size

for path in ROOT.rglob('*.glb'):
    original=path.read_bytes();json_size=struct.unpack_from('<I',original,12)[0]
    document=json.loads(original[20:20+json_size]);binary=original[28+json_size:];replacement={}
    for image in document.get('images',[]):
        if image.get('mimeType')!='image/jpeg':continue
        view_index=image['bufferView'];view=document['bufferViews'][view_index]
        data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        compressed=jpeg(data,image.get('name','diffuse'))
        if len(compressed)<len(data):replacement[view_index]=compressed
    if not replacement:continue
    rebuilt=bytearray()
    for index,view in enumerate(document['bufferViews']):
        start=view.get('byteOffset',0);data=replacement.get(index,binary[start:start+view['byteLength']])
        rebuilt.extend(b'\0'*((-len(rebuilt))%4));view['byteOffset']=len(rebuilt);view['byteLength']=len(data);rebuilt.extend(data)
    document['buffers'][0]['byteLength']=len(rebuilt)
    encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);rebuilt.extend(b'\0'*((-len(rebuilt))%4))
    result=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(rebuilt))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(rebuilt),b'BIN\0')+rebuilt
    before+=len(original)
    if len(result)<len(original):path.write_bytes(result)
    after+=path.stat().st_size
print(f'Review textures: {before/1e6:.1f} MB -> {after/1e6:.1f} MB; dimensions and alpha preserved.')
