"""Cache a small SRTM elevation grid via Open Topo Data for the realism sample."""
import json
import math
from pathlib import Path
import time
import urllib.parse
import urllib.request
source=json.loads(Path('public/maps/munnar.json').read_text())
plan=json.loads(Path('public/maps/munnar-adventure.json').read_text())
center=plan['trails'][0]['points'][0];origin=source['origin'];size=21;step=60
points=[]
for row in range(size):
    for col in range(size):
        x=center['x']+(col-(size-1)/2)*step;z=center['z']+(row-(size-1)/2)*step
        points.append((origin[1]-z/111320,origin[0]+x/(111320*math.cos(math.radians(origin[1])))))
values=[]
for start in range(0,len(points),100):
    if start:time.sleep(1.2)
    locations='|'.join(f'{lat:.7f},{lon:.7f}' for lat,lon in points[start:start+100])
    url='https://api.opentopodata.org/v1/srtm30m?'+urllib.parse.urlencode({'locations':locations,'interpolation':'bilinear'})
    req=urllib.request.Request(url,headers={'User-Agent':'MudMeals-realism-review/1.0'})
    with urllib.request.urlopen(req,timeout=30) as response:data=json.load(response)
    if data['status']!='OK' or any(r['elevation'] is None for r in data['results']):raise ValueError('Elevation data unavailable')
    values.extend(r['elevation'] for r in data['results'])
output={'center':center,'origin':origin,'size':size,'step':step,'values':values,'source':'NASA/USGS SRTM 30m via https://www.opentopodata.org/datasets/srtm/','note':'30m source elevation sampled on a 60m grid; interpolation is not surveyed road detail.'}
Path('public/realism/elevation.json').write_text(json.dumps(output,separators=(',',':'))+'\n')
print('SRTM grid:',len(values),'samples;',min(values),'to',max(values),'metres above sea level')
