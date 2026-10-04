"""Download small OSM snapshots, clip them to playable bounds, and retain ODbL provenance."""
import concurrent.futures
import datetime
import json
import pathlib
import urllib.request
import xml.etree.ElementTree as ET

LOCATIONS = {
    'kochi': ('Busy Kochi · Ernakulam', (76.277, 9.964, 76.286, 9.973)),
    'munnar': ('Munnar town & hill roads', (77.050, 10.082, 77.068, 10.096)),
    'thekkady': ('Thekkady · Periyar approach', (77.150, 9.603, 77.170, 9.622)),
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


def download(item):
    location, (name, bounds) = item
    source = 'https://api.openstreetmap.org/api/0.6/map?bbox=' + ','.join(map(str, bounds))
    request = urllib.request.Request(source, headers={'User-Agent': 'MudMeals-map-import/1.0'})
    with urllib.request.urlopen(request, timeout=55) as response:
        xml = ET.fromstring(response.read())
    nodes = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])] for n in xml.findall('node')}
    roads, buildings, areas = [], [], []
    for way in xml.findall('way'):
        tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
        points = [nodes[n.attrib['ref']] for n in way.findall('nd') if n.attrib['ref'] in nodes]
        if len(points) < 2:
            continue
        if tags.get('oneway') == '-1':
            points.reverse()
        feature = {'id': int(way.attrib['id'])}
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
                height = max(2.5, min(50, number(tags.get('height'), number(tags.get('building:levels'), 2) * 3)))
                buildings.append({**feature, 'height': height, 'points': polygon})
            elif tags.get('natural') in ('water', 'wood') or tags.get('landuse') in ('forest', 'reservoir'):
                kind = 'water' if tags.get('natural') == 'water' or tags.get('landuse') == 'reservoir' else 'wood'
                areas.append({**feature, 'kind': kind, 'points': polygon})
    if not roads:
        raise ValueError(f'{location}: no drivable roads in snapshot')
    data = {'id': location, 'name': name, 'bounds': bounds, 'origin': [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2], 'source': source, 'fetchedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'attribution': '© OpenStreetMap contributors', 'license': 'ODbL-1.0', 'licenseUrl': 'https://opendatacommons.org/licenses/odbl/1-0/', 'roads': roads, 'buildings': buildings, 'areas': areas}
    path = pathlib.Path('public/maps') / (location + '.json')
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    return f'{name}: {len(roads)} roads, {len(buildings)} buildings, {len(areas)} mapped areas; {path.stat().st_size:,} bytes'


if __name__ == '__main__':
    pathlib.Path('public/maps').mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(download, LOCATIONS.items()):
            print(result)
