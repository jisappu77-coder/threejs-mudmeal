"""Build two fictional adventure loops around the unchanged OSM road network."""
import heapq
import json
import math
from pathlib import Path

source = json.loads(Path('public/maps/munnar.json').read_text())
lon, lat = source['origin']
def project(p):
    return {'x': (p[0]-lon)*111320*math.cos(math.radians(lat)), 'z': -(p[1]-lat)*111320}
def key(p):
    return (round(p['x'], 3), round(p['z'], 3))
polygons = [list(map(project, f['points'])) for f in source['buildings'] + [a for a in source['areas'] if a['kind']=='water']]
boxes = [(min(p['x'] for p in poly)-3.5, max(p['x'] for p in poly)+3.5, min(p['z'] for p in poly)-3.5, max(p['z'] for p in poly)+3.5, poly) for poly in polygons]
def segment_distance(x,z,a,b):
    dx,dz=b['x']-a['x'],b['z']-a['z']; ll=dx*dx+dz*dz
    t=max(0,min(1,((x-a['x'])*dx+(z-a['z'])*dz)/ll)) if ll else 0
    return math.hypot(x-a['x']-t*dx,z-a['z']-t*dz)
def blocked(x,z):
    for left,right,top,bottom,poly in boxes:
        if not (left<x<right and top<z<bottom): continue
        inside=False
        for a,b in zip(poly,poly[1:]+poly[:1]):
            if (a['z']>z)!=(b['z']>z) and x<(b['x']-a['x'])*(z-a['z'])/(b['z']-a['z'])+a['x']: inside=not inside
            if segment_distance(x,z,a,b)<3.5: return True
        if inside: return True
    return False
nodes={}; graph={}
for r in source['roads']:
    points=list(map(project,r['points']))
    for p in points: nodes[key(p)]=p;graph.setdefault(key(p),{})
    for a,b in zip(points,points[1:]):
        ka,kb=key(a),key(b);d=math.hypot(a['x']-b['x'],a['z']-b['z'])
        graph[ka][kb]=d;graph[kb][ka]=d
hub=min(nodes,key=lambda k:math.hypot(*k))
reachable={hub}; queue=[hub]
for n in queue:
    for neighbour in graph[n]:
        if neighbour not in reachable: reachable.add(neighbour);queue.append(neighbour)
def anchor(x,z):
    return min((k for k in reachable if not blocked(*k)),key=lambda k:math.hypot(k[0]-x,k[1]-z))
def road_path(a,b,excluded=None):
    heap=[(0,a)];cost={a:0};parent={}
    while heap:
        d,n=heapq.heappop(heap)
        if n==b: break
        if d!=cost[n]: continue
        for q,w in graph[n].items():
            if excluded and frozenset((n,q))==excluded:continue
            nd=d+w
            if nd<cost.get(q,float('inf')):cost[q]=nd;parent[q]=n;heapq.heappush(heap,(nd,q))
    if b not in cost:return None
    path=[b]
    while path[-1]!=a:path.append(parent[path[-1]])
    return [nodes[k] for k in reversed(path)]
# Grid routing uses a 3.5m clearance envelope, then simplifies only through clear corridors.
cache={}
def clear(p):
    if p not in cache:cache[p]=not blocked(*p)
    return cache[p]
def line_clear(a,b):
    n=max(1,math.ceil(math.dist(a,b)))
    return all(clear((a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n)) for i in range(n+1))
def trail_leg(a,b):
    start=tuple(round(v/4)*4 for v in a);end=tuple(round(v/4)*4 for v in b)
    if not clear(start) or not clear(end):raise ValueError(f'Blocked waypoint: {a}, {b}')
    heap=[(math.dist(start,end),0,start)];cost={start:0};parent={};margin=160
    while heap:
        _,d,n=heapq.heappop(heap)
        if n==end:break
        if d!=cost[n]:continue
        for dx,dz in [(4,0),(-4,0),(0,4),(0,-4),(4,4),(-4,4),(4,-4),(-4,-4)]:
            q=(n[0]+dx,n[1]+dz)
            if not(min(a[0],b[0])-margin<q[0]<max(a[0],b[0])+margin and min(a[1],b[1])-margin<q[1]<max(a[1],b[1])+margin):continue
            if not clear(q) or not line_clear(n,q):continue
            nd=d+math.hypot(dx,dz)
            if nd<cost.get(q,float('inf')):cost[q]=nd;parent[q]=n;heapq.heappush(heap,(nd+math.dist(q,end),nd,q))
    if end not in cost:raise ValueError(f'No clear route from {a} to {b}')
    path=[end]
    while path[-1]!=start:path.append(parent[path[-1]])
    path=list(reversed(path));path=[a]+path+[b];simple=[path[0]];i=0
    while i<len(path)-1:
        j=len(path)-1
        while j>i+1 and not line_clear(path[i],path[j]):j-=1
        simple.append(path[j]);i=j
    return simple
plans=[('tea','Tea estate loop','dirt',(-520,-190),(-450,35),[(-620,-125),(-700,-30),(-655,65),(-550,75)]),('ridge','Ridge gravel loop','gravel',(-625,-380),(-330,-100),[(-590,-455),(-440,-490),(-300,-395),(-280,-220)])]
trails=[]
for name,title,surface,a,b,via in plans:
    start,end=anchor(*a),anchor(*b);waypoints=[start]+via+[end];points=[]
    for a,b in zip(waypoints,waypoints[1:]):points+=trail_leg(a,b)[:-1]
    points.append(end)
    if not all(line_clear(a,b) for a,b in zip(points,points[1:])):raise ValueError('Invalid corridor')
    trails.append({'id':name,'name':title,'surface':surface,'width':3.6,'fictional':True,'points':[{'x':round(x,3),'z':round(z,3)} for x,z in points],'returnRoad':road_path(start,end)})
    print(title,len(points),'control points;',round(sum(math.dist(a,b) for a,b in zip(points,points[1:]))),'m; both ends connected to town')
west=anchor(-550,185)
outbound=road_path(hub,west)
alternatives=[]
for a,b in zip(outbound,outbound[1:]):
    path=road_path(hub,west,frozenset((key(a),key(b))))
    if path:alternatives.append(path)
if not alternatives:raise ValueError('No connected paved circuit')
length=lambda path:sum(math.dist(key(a),key(b)) for a,b in zip(path,path[1:]))
return_path=min(alternatives,key=length)
circuit=outbound+list(reversed(return_path))[1:]
print('Paved town circuit:',round(length(circuit)),'m')
data={'name':'Munnar adventure layout','note':'Fictional game trails attached to attributed OpenStreetMap roads; illustrative elevation.', 'hub':nodes[hub],'mainCircuit':circuit,'trails':trails}
Path('public/maps/munnar-adventure.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
