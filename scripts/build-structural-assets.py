"""Run through Blender MCP. Creates a separate scene; restores the user's scene.
Original metric geometry; X is span, Z is height. GLB converts to Y up.
"""
import bpy, os, math, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public/models/structural')
os.makedirs(OUT,exist_ok=True)
previous=bpy.context.window.scene
scene=bpy.data.scenes.new('SPOT_Structural_Library')
bpy.context.window.scene=scene
mats={}
for name,color,metal,rough in [('coated_steel',(.22,.29,.31),.7,.47),('galvanized',(.55,.61,.62),.85,.36),('diffuser',(.8,.88,.86),.05,.4)]:
    m=bpy.data.materials.new('SPOT_structure_'+name);m.use_nodes=True
    node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value=(*color,1);node.inputs['Metallic'].default_value=metal;node.inputs['Roughness'].default_value=rough
    if name=='diffuser':node.inputs['Emission Color'].default_value=(*color,1);node.inputs['Emission Strength'].default_value=2
    mats[name]=m
parts=[]
def box(name,p,size,mat='coated_steel'):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=name;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mats[mat]);parts.append(o);return o
def rod(name,a,b,r,mat='galvanized',vertices=8):
    a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(a+b)/2)
    o=bpy.context.object;o.name=name;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');o.data.materials.append(mats[mat]);parts.append(o)
def truss():
    for z in [0,.65]:
        box('Chord web',(0,0,z),(6,.025,.13))
        for dz in [-.075,.075]:box('Chord flange',(0,0,z+dz),(6,.18,.025))
    for i in range(7):
        x=-3+i;box('Gusset plate',(x,0,.325),(.18,.035,.68),'galvanized')
        for z in [.05,.6]:
            for dx in [-.05,.05]:rod('Gusset hex bolt',(x+dx,-.04,z),(x+dx,.04,z),.018,vertices=6)
        if i<6:rod('Diagonal brace',(x,0,.08),(x+1,0,.57),.042,'coated_steel')
    for x in [-2.92,2.92]:box('Column bearing shoe',(x,0,-.13),(.25,.22,.14),'galvanized')
def fixture():
    box('Luminaire enclosure',(0,0,0),(1.6,.32,.12),'galvanized')
    box('Sealed opal diffuser',(0,0,-.072),(1.5,.27,.028),'diffuser')
    for x in [-.58,.58]:
        rod('Suspension rod',(x,0,.06),(x,0,.5),.012)
        box('Beam mounting cleat',(x,0,.51),(.12,.11,.025))
    for x in [-.7,.7]:box('Cover retaining clip',(x,0,-.015),(.025,.34,.035),'coated_steel')
def hanger():
    for x in [-.22,.22]:rod('Threaded hanger',(x,0,0),(x,0,.7),.014)
    box('Trapeze channel',(0,0,0),(.55,.12,.06),'galvanized')
    for x in [-.22,.22]:box('Beam anchor',(x,0,.72),(.1,.13,.03),'coated_steel')
manifest=[]
try:
    formats=bpy.ops.export_scene.gltf.get_rna_type().properties['export_format'].enum_items
    if len(formats):glb=next(e.identifier for e in formats if 'GLB' in e.identifier)
    else:
        import io_scene_gltf2
        glb=next(e[0] for e in io_scene_gltf2.get_format_items(None,bpy.context) if 'GLB' in e[0])
    for name,builder in [('roof_truss',truss),('industrial_luminaire',fixture),('pipe_hanger',hanger)]:
        parts=[];builder();joined=[]
        material_groups=[(material,[o for o in parts if o.data.materials[0]==material]) for material in mats.values()]
        for material,group in material_groups:
            if not group:continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in group:o.select_set(True)
            bpy.context.view_layer.objects.active=group[0]
            if len(group)>1:bpy.ops.object.join()
            o=bpy.context.object;o.name=name+'_'+material.name;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);joined.append(o)
        bpy.ops.object.select_all(action='DESELECT')
        for o in joined:o.select_set(True)
        bpy.context.view_layer.objects.active=joined[0];output=os.path.join(OUT,name+'.glb')
        bpy.ops.export_scene.gltf(filepath=output,export_format=glb,use_selection=True,use_active_scene=True,export_yup=True,export_animations=False)
        manifest.append(dict(name=name,bytes=os.path.getsize(output),triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in joined),meshes=len(joined),author='SPOTlight original geometry',license='Project license'))
        for o in joined:o.location.x=len(manifest)*7
    bpy.data.libraries.write(os.path.join(ROOT,'art/spot-structure.blend'),{scene},fake_user=True)
    with open(os.path.join(OUT,'manifest.json'),'w') as file:json.dump(manifest,file,indent=2)
    print(json.dumps(manifest))
finally:
    bpy.context.window.scene=previous
