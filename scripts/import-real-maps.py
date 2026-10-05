"""Download small OSM snapshots, clip them to playable bounds, and retain ODbL provenance."""
import concurrent.futures
import datetime
import json
import pathlib
import urllib.request
import xml.etree.ElementTree as ET

LOCATIONS = {
    'kochi': ('Fort Kochi · Waterfront', (76.2375, 9.9625, 76.2475, 9.9725)),
}
ROAD_WIDTHS = {'motorway': 10, 'trunk': 9, 'primary': 8, 'secondary': 7, 'tertiary': 6, 'residential': 5.5, 'unclassified': 5, 'living_street': 4, 'service': 3.5}


def clip_segment(a, b, bounds):
    dx, dy = b[0] - a[0], b[1] - a[1]
    low, high = 0, 1
    for p, q in zip((-dx, dx, -dy, dy), (a[0] - bounds[0], bounds[2] - a[0], a[1] - bounds[1], bounds[3] - a[1])):
        if p == 0:
            if q < 0:
                return None
        elif p < 0:
            low = max(low, q / p)
        else:
            high = min(high, q / p)
        if low > high:
            return None
    return [[round(a[0] + t * dx, 7), round(a[1] + t * dy, 7)] for t in (low, high)]


def clip_polygon(points, bounds):
    for axis, edge, above in ((0, bounds[0], True), (0, bounds[2], False), (1, bounds[1], True), (1, bounds[3], False)):
        output = []
        for a, b in zip(points, points[1:] + points[:1]):
            inside_a = a[axis] >= edge if above else a[axis] <= edge
            inside_b = b[axis] >= edge if above else b[axis] <= edge
            if inside_a:
                output.append(a)
            if inside_a != inside_b:
                t = (edge - a[axis]) / (b[axis] - a[axis])
                output.append([round(a[i] + t * (b[i] - a[i]), 7) for i in (0, 1)])
        points = output
        if not points:
            break
    return points


def number(value, fallback):
    try:
        return float(value.split()[0])
    except (ValueError, AttributeError):
        return fallback


def stitch(chains):
    chains = [list(c) for c in chains if len(c) > 1]
    result = []
    while chains:
        line = chains.pop(0)
        changed = True
        while changed:
            changed = False
            for i, other in enumerate(chains):
                if line[-1] == other[0]:
                    line.extend(other[1:])
                elif other[-1] == line[0]:
                    line = other[:-1] + line
                else:
                    continue
                chains.pop(i)
                changed = True
                break
        result.append(line)
    return result


def clip_line(points, bounds):
    parts, current = [], []
    for a, b in zip(points, points[1:]):
        segment = clip_segment(a, b, bounds)
        if segment and segment[0] != segment[1]:
            if current and current[-1] != segment[0]:
                parts.append(current)
                current = []
            if not current:
                current.append(segment[0])
            current.append(segment[1])
        elif current:
            parts.append(current)
            current = []
    if current:
        parts.append(current)
    return parts


def coastal_land_polygon(points, bounds):
    # Close the full directed coastline before clipping. Closing each clipped
    # fragment separately can incorrectly flood land where a shore re-enters bounds.
    if points[0] == points[-1]:
        return clip_polygon(points[:-1], bounds)
    west = min(p[0] for p in points + [[bounds[0], bounds[1]]]) - .01
    east = max(p[0] for p in points + [[bounds[2], bounds[3]]]) + .01
    south = min(p[1] for p in points + [[bounds[0], bounds[1]]]) - .01
    north = max(p[1] for p in points + [[bounds[2], bounds[3]]]) + .01
    a, b = points[0], points[-1]
    candidates = [points + [[x,b[1]],[x,a[1]]] for x in (west,east)]
    candidates += [points + [[b[0],y],[a[0],y]] for y in (south,north)]
    def contains(polygon, p):
        inside = False
        for a, b in zip(polygon, polygon[1:] + polygon[:1]):
            if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]:
                inside = not inside
        return inside
    probes = []
    for a, b in zip(points, points[1:]):
        clipped = clip_segment(a,b,bounds)
        if not clipped:
            continue
        a,b = clipped
        dx,dy = b[0]-a[0],b[1]-a[1]
        length = (dx*dx+dy*dy)**.5
        if length:
            probes.append(([(a[0]+b[0])/2-dy/length*1e-6,(a[1]+b[1])/2+dx/length*1e-6],length))
    polygon = max(candidates,key=lambda p: sum(weight for probe,weight in probes if contains(p,probe)))
    return clip_polygon(polygon,bounds)


def download(item):
    location, (name, bounds) = item
    source = 'https://api.openstreetmap.org/api/0.6/map?bbox=' + ','.join(map(str, bounds))
    request = urllib.request.Request(source, headers={'User-Agent': 'MudMeals-map-import/1.0'})
    with urllib.request.urlopen(request, timeout=55) as response:
        raw = response.read()
        xml = ET.fromstring(raw)
    nodes = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])] for n in xml.findall('node')}
    roads, buildings, areas, coastlines, landmarks = [], [], [], [], []
    coast_chains, coast_sources = [], []
    for way in xml.findall('way'):
        tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
        points = [nodes[n.attrib['ref']] for n in way.findall('nd') if n.attrib['ref'] in nodes]
        if len(points) < 2:
            continue
        if tags.get('oneway') == '-1':
            points.reverse()
        feature = {'id': int(way.attrib['id'])}
        if tags.get('natural') == 'coastline':
            coast_chains.append(points)
            coast_sources.append((feature['id'],points))
        if tags.get('name'):
            feature['name'] = tags['name']
        highway = tags.get('highway')
        if highway in ROAD_WIDTHS and tags.get('access') not in ('no', 'private') and tags.get('motor_vehicle') != 'no':
            parts, current = [], []
            for a, b in zip(points, points[1:]):
                segment = clip_segment(a, b, bounds)
                if segment and segment[0] != segment[1]:
                    if current and current[-1] != segment[0]:
                        parts.append(current)
                        current = []
                    if not current:
                        current.append(segment[0])
                    current.append(segment[1])
                elif current:
                    parts.append(current)
                    current = []
            if current:
                parts.append(current)
            width = max(2.5, min(14, number(tags.get('width'), ROAD_WIDTHS[highway])))
            for i, part in enumerate(parts):
                roads.append({**feature, 'part': i, 'kind': highway, 'name': tags.get('name', ''), 'width': width, 'oneway': tags.get('oneway') in ('yes', '1', '-1') or (tags.get('junction') == 'roundabout' and tags.get('oneway') != 'no'), 'points': part})
        elif points[0] == points[-1] and len(points) >= 4:
            polygon = clip_polygon(points[:-1], bounds)
            if len(polygon) < 3:
                continue
            if tags.get('building') and tags['building'] != 'no':
                specified = 'height' in tags or 'building:levels' in tags
                default = 7.2 if tags.get('building') == 'church' else 3.7 if tags.get('building') in ('house','industrial','warehouse') or any(word in tags.get('name','').lower() for word in ('godown','laboratory')) else (3.7 if int(way.attrib['id']) % 3 == 0 else 6.2)
                height = max(2.5, min(50, number(tags.get('height'), number(tags.get('building:levels'), default / 3) * 3)))
                buildings.append({**feature, 'height': height, 'heightSpecified': specified, 'kind': tags.get('building'), 'points': polygon})
            elif tags.get('natural') in ('water', 'wood') or tags.get('landuse') in ('forest', 'reservoir'):
                kind = 'water' if tags.get('natural') == 'water' or tags.get('landuse') == 'reservoir' else 'wood'
                areas.append({**feature, 'kind': kind, 'points': polygon})
    coastal_land = []
    for i, line in enumerate(stitch(coast_chains)):
        source_ids = [way_id for way_id, points in coast_sources if any(p in line for p in points)]
        land = coastal_land_polygon(line,bounds)
        if len(land) >= 3:
            coastal_land.append(land)
        for part in clip_line(line, bounds):
            if len(part) < 3:
                continue
            coastlines.append({'id': source_ids[0], 'sourceIds': source_ids, 'part': len(coastlines), 'points': part})
    if coastal_land:
        west, south, east, north = bounds
        areas.append({'id': coast_sources[0][0], 'sourceIds': [way_id for way_id, _ in coast_sources], 'kind': 'water', 'sourceKind': 'coastline', 'points': [[west,south],[east,south],[east,north],[west,north]], 'holes': coastal_land})
    for node in xml.findall('node'):
        tags = {t.attrib['k']: t.attrib['v'] for t in node.findall('tag')}
        point = nodes[node.attrib['id']]
        if bounds[0] <= point[0] <= bounds[2] and bounds[1] <= point[1] <= bounds[3] and (tags.get('tourism') == 'attraction' or tags.get('amenity') == 'ferry_terminal'):
            landmarks.append({'id': int(node.attrib['id']), 'name': tags.get('name', ''), 'point': point})
    if not roads:
        raise ValueError(f'{location}: no drivable roads in snapshot')
    data = {'id': location, 'name': name, 'bounds': bounds, 'origin': [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2], 'source': source, 'fetchedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'attribution': '© OpenStreetMap contributors', 'license': 'ODbL-1.0', 'licenseUrl': 'https://opendatacommons.org/licenses/odbl/1-0/', 'roads': roads, 'buildings': buildings, 'areas': areas, 'coastlines': coastlines, 'landmarks': landmarks}
    path = pathlib.Path('public/maps') / (location + '.json')
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    return f'{name}: {len(roads)} roads, {len(buildings)} buildings, {len(areas)} mapped areas; {path.stat().st_size:,} bytes'


if __name__ == '__main__':
    pathlib.Path('public/maps').mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(download, LOCATIONS.items()):
            print(result)
