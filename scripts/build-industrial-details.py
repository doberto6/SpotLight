"""Metric, original low-poly details; run in Blender, preserving the active scene."""
import bpy, os, json, math
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public/models/details')
os.makedirs(OUT,exist_ok=True)
previous=bpy.context.window.scene
scene=bpy.data.scenes.new('SPOT_Industrial_Details')
bpy.context.window.scene=scene
materials={}
for name,color,metal,rough in [('galvanized',(.4,.48,.5),.8,.48),('paint',(.11,.27,.29),.45,.57),('rubber',(.035,.043,.048),0,.88),('cargo',(.38,.29,.16),0,.85)]:
    m=bpy.data.materials.new('SPOT_detail_'+name);m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*color,1)
    n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
    materials[name]=m
parts=[]
def box(name,p,size,material='galvanized'):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.name=name;o.data.materials.append(materials[material]);parts.append(o)
def rod(name,a,b,r,material='galvanized',vertices=12):
    a,b=Vector(a),Vector(b);v=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=v.length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=v.to_track_quat('Z','Y')
    o.name=name;o.data.materials.append(materials[material]);parts.append(o)
def export(name):
    groups=[(m,[o for o in parts if o.data.materials[0]==m]) for m in materials.values()];joined=[]
    for material,objects in groups:
        if not objects:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name=name+'_'+material.name
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);joined.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined:o.select_set(True)
    bpy.context.view_layer.objects.active=joined[0]
    import io_scene_gltf2
    glb=next(e[0] for e in io_scene_gltf2.get_format_items(None,bpy.context) if 'GLB' in e[0])
    path=os.path.join(OUT,name+'.glb')
    bpy.ops.export_scene.gltf(filepath=path,export_format=glb,use_selection=True,use_active_scene=True,export_yup=True,export_animations=False)
    return dict(name=name,bytes=os.path.getsize(path),triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in joined),meshes=len(joined),license='Project license',author='SPOTlight original geometry')
try:
    for y in [-.52,.52]:
        box('Bolted foot',(0,y,.03),(.24,.22,.06))
        box('Rack upright',(0,y,.78),(.08,.08,1.44))
        for x in [-.075,.075]:rod('Anchor bolt',(x,y,.04),(x,y,.08),.014,vertices=6)
    for z in [.17,.62,1.07]:box('Open crossbeam',(0,0,z),(.12,1.04,.1))
    entries=[export('pipe_rack')];parts=[]
    for x in [-.47,.47]:
        for y in [-.235,.235]:
            rod('Caster wheel',(x,y-.035,.09),(x,y+.035,.09),.09,'rubber',16)
            box('Caster fork',(x,y,.17),(.08,.075,.08))
            box('Cart upright',(x,y,.49),(.045,.045,.62),'paint')
    for z in [.23,.82]:
        box('Cart tray',(0,0,z),(1.2,.65,.05),'paint')
        for y in [-.31,.31]:box('Tray rim',(0,y,z+.05),(1.2,.03,.1),'paint')
        for x in [-.585,.585]:box('Tray rim',(x,0,z+.05),(.03,.65,.1),'paint')
    for y in [-.24,.24]:rod('Handle upright',(.52,y,.82),(.52,y,1.15),.022)
    rod('Push handle',(.52,-.24,1.15),(.52,.24,1.15),.023)
    box('Maintenance case',(-.22,0,.995),(.5,.4,.3),'cargo')
    entries.append(export('maintenance_cart'))
    bpy.data.libraries.write(os.path.join(ROOT,'art/spot-industrial-details.blend'),{scene},fake_user=True)
    with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(entries,f,indent=2)
    print(json.dumps(entries))
finally:
    bpy.context.window.scene=previous
