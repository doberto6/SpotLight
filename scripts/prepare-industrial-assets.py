"""Extract selected GLB components and downsample embedded textures with macOS sips.

Usage: python3 scripts/prepare-industrial-assets.py --source-dir /path/to/models
Original source files are read only. No downloaded tooling or remote assets required.
"""
import argparse
import copy
import json
from pathlib import Path
import struct
import subprocess
import tempfile

SELECTIONS = {
    'factory_modular_kit': ([16, 18, 47], False),
    'industrial_electrical_box': ([0, 1, 2], True),
    'industrial_factory_with_towers_and_pipes': ([0], True),
    'industrial_pipes_pack': ([6, 10, 24], False),
    'large_modular_pipes_metal': ([0, 2, 5, 17, 21, 25], False),
}

def read_glb(path):
    raw = path.read_bytes()
    magic, version, size = struct.unpack_from('<III', raw)
    assert magic == 0x46546C67 and version == 2 and size == len(raw)
    length, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4E4F534A
    gltf = json.loads(raw[20:20 + length])
    offset = 20 + length
    bin_length, kind = struct.unpack_from('<II', raw, offset)
    assert kind == 0x004E4942
    return gltf, raw[offset + 8:offset + 8 + bin_length]

def extract(path, output, selected, keep_transforms):
    gltf, binary = read_glb(path)
    chunks = bytearray()
    result = {'asset': copy.deepcopy(gltf['asset']), 'scene': 0, 'scenes': [{'nodes': []}],
              'nodes': [], 'meshes': [], 'materials': [], 'textures': [], 'images': [],
              'samplers': gltf.get('samplers', []), 'accessors': [], 'bufferViews': []}
    remap = {key: {} for key in ['meshes', 'materials', 'textures', 'images', 'accessors', 'bufferViews']}

    def append_view(data, original=None):
        while len(chunks) % 4:
            chunks.append(0)
        view = copy.deepcopy(original or {})
        view.update(buffer=0, byteOffset=len(chunks), byteLength=len(data))
        index = len(result['bufferViews'])
        result['bufferViews'].append(view)
        chunks.extend(data)
        return index

    def view(index):
        if index not in remap['bufferViews']:
            old = gltf['bufferViews'][index]
            start = old.get('byteOffset', 0)
            remap['bufferViews'][index] = append_view(binary[start:start + old['byteLength']], old)
        return remap['bufferViews'][index]

    def accessor(index):
        if index not in remap['accessors']:
            a = copy.deepcopy(gltf['accessors'][index])
            assert 'sparse' not in a, 'Sparse accessors require explicit support'
            old = gltf['bufferViews'][a['bufferView']]
            start = old.get('byteOffset', 0) + a.get('byteOffset', 0)
            components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
            item_size = components * {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[a['componentType']]
            stride = old.get('byteStride', item_size)
            packed = b''.join(binary[start + i * stride:start + i * stride + item_size] for i in range(a['count']))
            a['bufferView'] = append_view(packed)
            a['byteOffset'] = 0
            remap['accessors'][index] = len(result['accessors'])
            result['accessors'].append(a)
        return remap['accessors'][index]

    def image(index):
        if index not in remap['images']:
            old = gltf['images'][index]
            v = gltf['bufferViews'][old['bufferView']]
            start = v.get('byteOffset', 0)
            with tempfile.TemporaryDirectory(prefix='spot-texture-') as directory:
                ext = 'jpg' if old['mimeType'] == 'image/jpeg' else 'png'
                source = Path(directory) / ('texture.' + ext)
                source.write_bytes(binary[start:start + v['byteLength']])
                subprocess.run(['sips', '--resampleHeightWidthMax', '768', str(source)], check=True, capture_output=True)
                payload = source.read_bytes()
            remap['images'][index] = len(result['images'])
            result['images'].append({'mimeType': old['mimeType'], 'bufferView': append_view(payload)})
        return remap['images'][index]

    def texture(index):
        if index not in remap['textures']:
            t = copy.deepcopy(gltf['textures'][index])
            t['source'] = image(t['source'])
            remap['textures'][index] = len(result['textures'])
            result['textures'].append(t)
        return remap['textures'][index]

    def material(index):
        if index not in remap['materials']:
            m = copy.deepcopy(gltf['materials'][index])
            def walk(item):
                if isinstance(item, dict):
                    for k, v in item.items():
                        if k.endswith('Texture') and isinstance(v, dict) and 'index' in v:
                            v['index'] = texture(v['index'])
                        else:
                            walk(v)
                elif isinstance(item, list):
                    for v in item:
                        walk(v)
            walk(m)
            remap['materials'][index] = len(result['materials'])
            result['materials'].append(m)
        return remap['materials'][index]

    for index in selected:
        m = copy.deepcopy(gltf['meshes'][index])
        for p in m['primitives']:
            p['attributes'] = {k: accessor(v) for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = accessor(p['indices'])
            if 'material' in p:
                p['material'] = material(p['material'])
        remap['meshes'][index] = len(result['meshes'])
        result['meshes'].append(m)
    if keep_transforms:
        result['nodes'] = copy.deepcopy(gltf['nodes'])
        result['scenes'] = copy.deepcopy(gltf['scenes'])
        result['scene'] = gltf.get('scene', 0)
        for node in result['nodes']:
            if 'mesh' in node:
                if node['mesh'] in remap['meshes']:
                    node['mesh'] = remap['meshes'][node['mesh']]
                else:
                    del node['mesh']
    else:
        result['nodes'] = [{'mesh': i, 'name': m.get('name', f'Component_{i}')} for i, m in enumerate(result['meshes'])]
        result['scenes'][0]['nodes'] = list(range(len(result['nodes'])))
    while len(chunks) % 4:
        chunks.append(0)
    result['buffers'] = [{'byteLength': len(chunks)}]
    header = json.dumps(result, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    payload = struct.pack('<III', 0x46546C67, 2, 28 + len(header) + len(chunks))
    payload += struct.pack('<II', len(header), 0x4E4F534A) + header
    payload += struct.pack('<II', len(chunks), 0x004E4942) + chunks
    output.write_bytes(payload)
    triangles = sum(gltf['accessors'][p['indices']]['count'] // 3 for i in selected for p in gltf['meshes'][i]['primitives'])
    return {'source': path.name, 'output': output.name, 'sourceBytes': path.stat().st_size,
            'outputBytes': len(payload), 'triangles': triangles, 'components': [m.get('name') for m in result['meshes']],
            'textureLimit': 768, 'preservedSceneTransforms': keep_transforms, 'sourceMetadata': gltf['asset']}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', required=True, type=Path)
    args = parser.parse_args()
    dest = Path(__file__).resolve().parents[1] / 'public' / 'models' / 'industrial'
    dest.mkdir(parents=True, exist_ok=True)
    reports = [extract(args.source_dir / (name + '.glb'), dest / (name + '.glb'), *config) for name, config in SELECTIONS.items()]
    (dest / 'manifest.json').write_text(json.dumps(reports, indent=2) + '\n')
    for report in reports:
        print(report['output'], round(report['outputBytes'] / 1024 / 1024, 2), 'MB', report['triangles'], 'triangles')
