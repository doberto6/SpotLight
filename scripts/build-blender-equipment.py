"""Run in Blender's Python console/MCP. Original scene and source assets are retained.

Set SPOT_BUILD_NAMES to a list for staged builds; omit to export the full library.
Coordinates are metres, Z up. glTF exports convert to Three.js Y up.
"""
import bpy, math, random, json, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/models/engineered')
os.makedirs(OUT, exist_ok=True)
scene = bpy.data.scenes.get('SPOT_Engineered_Equipment') or bpy.data.scenes.new('SPOT_Engineered_Equipment')
bpy.context.window.scene = scene
materials = {}

def material(name, color, metal=0.6, rough=0.5):
    key = 'SPOT_' + name
    mat = bpy.data.materials.get(key) or bpy.data.materials.new(key)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    # Packed metallic/roughness and tangent-space micro-normal images survive GLB export.
    # Seeded flecks/brushing give each coating subtle manufacturing and wear variation.
    if not any(n.type == 'TEX_IMAGE' for n in nodes):
        rng = random.Random(917)
        orm = bpy.data.images.new(key + '_metal_rough', width=128, height=128)
        normal = bpy.data.images.new(key + '_micro_normal', width=128, height=128)
        orm.colorspace_settings.name = 'Non-Color'
        normal.colorspace_settings.name = 'Non-Color'
        op, np = [], []
        for y in range(128):
            for x in range(128):
                noise = rng.uniform(-.075, .075)
                scratch = .09 if (x * 13 + y * 3) % 109 == 0 else 0
                op.extend((1, max(.1, min(.95, rough + noise + scratch)), metal, 1))
                np.extend((.5 + noise * .16, .5 + math.sin(y * 2.7) * .012, .999, 1))
        orm.pixels.foreach_set(op)
        normal.pixels.foreach_set(np)
        for img in (orm, normal):
            img.pack()
        tex = nodes.new('ShaderNodeTexImage'); tex.image = orm
        separate = nodes.new('ShaderNodeSeparateColor')
        mat.node_tree.links.new(tex.outputs['Color'], separate.inputs['Color'])
        mat.node_tree.links.new(separate.outputs['Green'], bsdf.inputs['Roughness'])
        mat.node_tree.links.new(separate.outputs['Blue'], bsdf.inputs['Metallic'])
        nt = nodes.new('ShaderNodeTexImage'); nt.image = normal
        nm = nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = .35
        mat.node_tree.links.new(nt.outputs['Color'], nm.inputs['Color'])
        mat.node_tree.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    materials[name] = mat
    return mat

material('petrol_enamel', (.055,.19,.22), .4,.53)
material('sage_enamel', (.19,.27,.21), .35,.6)
material('machined_steel', (.43,.48,.51), .87,.36)
material('cast_iron', (.09,.12,.13), .72,.69)
material('safety_yellow', (.72,.42,.035), .35,.52)
material('rubber', (.017,.022,.025), .02,.89)
material('ceramic', (.56,.33,.18), .05,.31)
material('valve_red', (.44,.055,.027), .4,.57)

parts = []
def finish(o, name, mat):
    o.name = name
    o.data.materials.append(materials[mat])
    for p in o.data.polygons: p.use_smooth = len(p.vertices) == 4 and o.get('curved', False)
    parts.append(o)
    return o

def box(name, pos, size, mat='cast_iron', bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod=o.modifiers.new('Manufactured edge radii', 'BEVEL'); mod.width=bevel; mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,mat)

def cyl(name, a, b, r, mat='machined_steel', vertices=24):
    a,b=Vector(a),Vector(b); delta=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=delta.length, location=(a+b)/2)
    o=bpy.context.object; o.rotation_mode='QUATERNION'; o.rotation_quaternion=delta.to_track_quat('Z','Y')
    o['curved']=True
    return finish(o,name,mat)

def sphere(name, pos, size, mat='machined_steel'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=pos)
    o=bpy.context.object; o.scale=size; o['curved']=True
    return finish(o,name,mat)

def ring(name, pos, radius, tube=.025, mat='machined_steel', axis='Z'):
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=6, location=pos, major_radius=radius, minor_radius=tube)
    o=bpy.context.object
    if axis=='Y': o.rotation_euler.x=math.pi/2
    elif axis=='X': o.rotation_euler.y=math.pi/2
    o['curved']=True
    return finish(o,name,mat)

def flange(pos, r=.2, axis='Z', bolts=8):
    p=Vector(pos); d=Vector({'Z':(0,0,1),'Y':(0,1,0),'X':(1,0,0)}[axis])
    cyl('Bolted machined flange',p-d*.035,p+d*.035,r)
    for i in range(bolts):
        a=i*math.tau/bolts; u,v=math.cos(a)*r*.8,math.sin(a)*r*.8
        offset=Vector((u,v,0) if axis=='Z' else (u,0,v) if axis=='Y' else (0,u,v))
        cyl('Hex flange fastener',p+offset-d*.052,p+offset+d*.052,.022,'cast_iron',6)

def gauge(pos):
    x,y,z=pos
    cyl('Gauge stem',(x,y,z-.15),(x,y,z),.023)
    cyl('Pressure gauge bezel',(x,y-.055,z),(x,y+.015,z),.115)
    cyl('Enamel dial',(x,y-.06,z),(x,y-.065,z),.097,'ceramic')
    cyl('Dial needle',(x,y-.07,z),(x+.052,y-.07,z+.043),.005,'cast_iron',8)

def base(w,d):
    for x in [-w/2+.11,w/2-.11]:
        box('Skid rail',(x,0,.12),(.18,d,.22))
    for y in [-d/2+.12,d/2-.12]:
        box('Skid cross member',(0,y,.12),(w,.2,.22))
    for x in [-w/2+.14,w/2-.14]:
        for y in [-d/2+.16,d/2-.16]: cyl('Anchor bolt',(x,y,.2),(x,y,.27),.028,'machined_steel',6)

def pump():
    base(2.65,2.05)
    for x in [-.63,.63]:
        for y in [-.62,.45]: box('Motor mounting foot',(x,y,.32),(.55,.25,.2),'petrol_enamel')
        cyl('Motor stator',(x,-.92,.7),(x,-.05,.7),.28,'petrol_enamel')
        for i in range(18):
            a=i*math.tau/18
            fin=box('Axial motor cooling fin',(x+math.cos(a)*.285,-.46,.7+math.sin(a)*.285),(.04,.78,.065),'petrol_enamel',.004)
            fin.rotation_euler.y=-a
        cyl('Fan cowl',(x,-1,.7),(x,-.87,.7),.305,'cast_iron')
        for yy in [-.99,-.96,-.93]: ring('Fan guard', (x,yy,.7),.29,.009,'machined_steel','Y')
        box('Terminal box',(x,-.45,1.04),(.31,.35,.22),'petrol_enamel')
        cyl('Drive coupling',(x,-.05,.7),(x,.28,.7),.1)
        for yy in [.025,.09,.155]: ring('Coupling safety cage',(x,yy,.7),.19,.013,'safety_yellow','Y')
        # Volute shell, tangential discharge and axial suction are recognizable pump anatomy.
        cyl('Pump volute',(x,.26,.7),(x,.6,.7),.34,'sage_enamel')
        flange((x,.62,.7),.27,'Y')
        cyl('Suction nozzle',(x,.62,.7),(x,.97,.7),.105); flange((x,.94,.7),.17,'Y')
        cyl('Discharge riser',(x+.18,.45,.86),(x+.18,.45,1.7),.085)
        flange((x+.18,.45,1.17),.16)
        cyl('Valve bonnet',(x+.18,.45,1.35),(x+.18,.45,1.52),.135,'valve_red')
        ring('Valve handwheel',(x+.18,.45,1.75),.18,.021,'valve_red')
        for a in range(4):
            cyl('Wheel spoke',(x+.18,.45,1.75),(x+.18+.17*math.cos(a*math.pi/2),.45+.17*math.sin(a*math.pi/2),1.75),.012,'valve_red',8)
        gauge((x-.15,.35,1.31))

def turbine():
    base(2.18,3.65)
    for y in [-1.3,1.3]: box('Bearing pedestal',(0,y,.52),(1.35,.4,.65),'sage_enamel')
    cyl('Turbine casing',(0,-.8,1.16),(0,1.05,1.16),.67,'petrol_enamel',32)
    for y in [-.8,1.05]: flange((0,y,1.16),.72,'Y',12)
    for y in [-.53,-.2,.13,.46,.79]: ring('Casing reinforcing rib',(0,y,1.16),.68,.03,'petrol_enamel','Y')
    box('Horizontal split flange',(0,.12,1.16),(1.48,1.8,.08),'machined_steel')
    for x in [-.69,.69]:
        for y in [-.62,-.3,.02,.34,.66,.94]: cyl('Casing split bolt',(x,y,1.15),(x,y,1.25),.028,'cast_iron',6)
    cyl('Rotor shaft',(0,-1.65,1.16),(0,1.66,1.16),.15)
    for y in [-1.36,1.38]: cyl('Bearing housing',(0,y-.14,1.16),(0,y+.14,1.16),.31,'sage_enamel')
    cyl('Steam inlet',(0,.35,1.65),(0,.35,2.12),.22); flange((0,.35,2.08),.32)
    cyl('Exhaust manifold',(.49,-.1,1.12),(1.02,-.1,1.12),.25); flange((.95,-.1,1.12),.33,'X')
    gauge((-.34,-.4,1.93))
    for x in [-.46,.46]: ring('Lifting eye',(x,.15,1.88),.09,.025,'machined_steel','Y')

def vessel():
    base(2.25,1.85)
    for x in [-.55,.55]:
        for y in [-.48,.48]: cyl('Vessel leg',(x,y,.2),(x,y,.7),.065)
    cyl('Pressure vessel shell',(0,0,.68),(0,0,1.75),.65,'machined_steel',32)
    sphere('Dished lower head',(0,0,.7),(.65,.65,.28))
    sphere('Dished upper head',(0,0,1.74),(.65,.65,.28))
    for z in [.7,1.74]: ring('Circumferential weld',(0,0,z),.65,.012,'cast_iron')
    cyl('Manway neck',(0,-.5,1.2),(0,-.79,1.2),.23); flange((0,-.82,1.2),.3,'Y')
    cyl('Relief valve nozzle',(.28,0,1.87),(.28,0,2.22),.06)
    cyl('Relief valve',(.28,0,2.05),(.28,0,2.22),.115,'valve_red')
    cyl('Outlet',(0,.5,.95),(0,.86,.95),.09); flange((0,.82,.95),.17,'Y')
    gauge((-.28,-.49,1.9))
    for x in [-.82,-.62]: cyl('Inspection ladder rail',(x,.2,.28),(x,.2,2.1),.02)
    for z in [.4,.66,.92,1.18,1.44,1.7,1.96]: cyl('Ladder rung',(-.82,.2,z),(-.62,.2,z),.018)

def transformer():
    base(2.55,2.02)
    box('Oil tank',(0,0,.92),(1.5,1.28,1.35),'sage_enamel',.065)
    box('Tank cover',(0,0,1.63),(1.67,1.44,.1),'machined_steel')
    for x in [-.98,.98]:
        for i in range(11): box('Corrugated cooling radiator',(x,-.65+i*.13,1.02),(.32,.045,1.29),'sage_enamel',.008)
        for z in [.52,1.53]: cyl('Radiator oil header',(x,-.74,z),(x,.74,z),.052)
    for x in [-.48,0,.48]:
        cyl('HV porcelain bushing',(x,0,1.66),(x,0,2.16),.067,'ceramic')
        for z in [1.75,1.85,1.95,2.05]: cyl('Bushing shed',(x,0,z),(x,0,z+.028),.122,'ceramic')
        cyl('Terminal stud',(x,0,2.12),(x,0,2.25),.029,'machined_steel',12)
    cyl('Conservator reservoir',(-.62,.47,1.96),(.62,.47,1.96),.15,'sage_enamel')
    gauge((.41,-.67,1.38))
    box('Tap changer panel',(.46,-.69,.87),(.37,.12,.42),'cast_iron')
    ring('Tap selector',(.46,-.78,.9),.095,.016,'valve_red','Y')

def cabinet():
    base(2.3,1.4)
    for x in [-.56,.56]:
        box('Control enclosure',(x,0,1.24),(1.03,1.18,2.03),'sage_enamel',.035)
        box('Gasketed door',(x,-.61,1.24),(.94,.045,1.9),'petrol_enamel')
        box('HMI bezel',(x,-.655,1.71),(.54,.04,.36),'cast_iron')
        box('HMI glass',(x,-.68,1.71),(.46,.015,.28),'machined_steel')
        for dx in [-.2,0,.2]: cyl('Pilot light',(x+dx,-.64,1.32),(x+dx,-.69,1.32),.032,'valve_red' if dx<0 else 'safety_yellow')
        cyl('Door pull',(x+.35,-.69,.9),(x+.35,-.69,1.17),.018)
        for z in [.5,.59,.68,.77]: box('Vent louvre',(x,-.66,z),(.7,.035,.028),'cast_iron',.003)
        for z in [.58,1.84]: box('Door hinge',(x-.46,-.64,z),(.04,.065,.13),'machined_steel')

BUILDERS={'pump_skid':pump,'turbine_generator':turbine,'pressure_vessel':vessel,'oil_transformer':transformer,'control_cabinets':cabinet}
manifest_path=os.path.join(OUT,'manifest.json')
manifest=json.load(open(manifest_path)) if os.path.exists(manifest_path) else []
for name in globals().get('SPOT_BUILD_NAMES', list(BUILDERS)):
    # Only replace this generator's own collection, never the user's scene objects.
    collection_name='SPOT_Asset_'+name
    old=bpy.data.collections.get(collection_name)
    if old:
        for obj in list(old.objects): bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(old)
    parts=[]
    BUILDERS[name]()
    collection=bpy.data.collections.new(collection_name);scene.collection.children.link(collection)
    for obj in parts:
        for c in list(obj.users_collection): c.objects.unlink(obj)
        collection.objects.link(obj)
    # Join by material: 6-8 mesh primitives per asset rather than hundreds of draw calls.
    joined=[]
    for mat in materials.values():
        group=[o for o in collection.objects if o.data.materials[0]==mat]
        if not group: continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group: obj.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        if len(group)>1: bpy.ops.object.join()
        obj=bpy.context.object;obj.name=name+'_'+mat.name
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        joined.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in joined: obj.select_set(True)
    bpy.context.view_layer.objects.active=joined[0]
    path=os.path.join(OUT,name+'.glb')
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True,export_animations=False)
    points=[o.matrix_world@Vector(c) for o in joined for c in o.bound_box]
    dims=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in joined)
    entry={'name':name,'output':name+'.glb','outputBytes':os.path.getsize(path),'triangles':triangles,'meshes':len(joined),'dimensionsBlender':dims,'author':'SPOTlight project — original procedural geometry','license':'Project license','textureLimit':128}
    manifest=[m for m in manifest if m['name']!=name]+[entry]
    print(json.dumps(entry))
    index=list(BUILDERS).index(name)
    for obj in joined: obj.location=(index%3*4.3,index//3*4.2,0)
with open(manifest_path,'w') as f: json.dump(manifest,f,indent=2)
print('Engineered equipment exported to '+OUT)
