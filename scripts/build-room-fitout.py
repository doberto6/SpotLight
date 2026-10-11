"""Original metric workshop and lifting assets; isolate work from the user's scene."""
import bpy, os, json, math
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public/models/fitout')
os.makedirs(OUT,exist_ok=True)
previous=bpy.context.window.scene
scene=bpy.data.scenes.new('SPOT_Room_Fitout')
bpy.context.window.scene=scene
materials={}
for name,color,metal,rough in [('steel',(.3,.38,.4),.8,.45),('paint',(.12,.29,.3),.4,.6),('safety',(.68,.49,.1),.3,.6),('rubber',(.035,.04,.045),0,.9),('wood',(.32,.25,.17),0,.85)]:
    m=bpy.data.materials.new('SPOT_fitout_'+name);m.use_nodes=True
    node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value=(*color,1)
    node.inputs['Metallic'].default_value=metal;node.inputs['Roughness'].default_value=rough
    materials[name]=m
parts=[]
def box(name,p,size,material='steel'):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.name=name;o.data.materials.append(materials[material]);parts.append(o)
def rod(name,a,b,r,material='steel',vertices=12):
    a,b=Vector(a),Vector(b);delta=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=delta.length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=delta.to_track_quat('Z','Y')
    o.name=name;o.data.materials.append(materials[material]);parts.append(o)
def arc(name,p,r,tube,start,end,material='steel'):
    # An open swept hook rather than a closed decorative ring.
    points=[Vector((p[0]+r*math.cos(start+(end-start)*i/16),p[1],p[2]+r*math.sin(start+(end-start)*i/16))) for i in range(17)]
    for a,b in zip(points,points[1:]):rod(name,a,b,tube,material,8)
def export(name):
    joined=[]
    groups=[(material,[o for o in parts if o.data.materials[0]==material]) for material in materials.values()]
    for material,objects in groups:
        if not objects:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name=name+'_'+material.name
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);joined.append(o)
    root=bpy.data.objects.new(name,None);scene.collection.objects.link(root)
    for o in joined:o.parent=root
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root,*joined]:o.select_set(True)
    bpy.context.view_layer.objects.active=joined[0]
    import io_scene_gltf2
    glb=next(e[0] for e in io_scene_gltf2.get_format_items(None,bpy.context) if 'GLB' in e[0])
    path=os.path.join(OUT,name+'.glb')
    bpy.ops.export_scene.gltf(filepath=path,export_format=glb,use_selection=True,use_active_scene=True,export_yup=True,export_animations=False)
    verts=[o.matrix_world@v.co for o in joined for v in o.data.vertices]
    return dict(name=name,bytes=os.path.getsize(path),triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in joined),meshes=len(joined),bounds={'min':[min(v[i] for v in verts) for i in range(3)],'max':[max(v[i] for v in verts) for i in range(3)]},license='CC0-1.0',author='SPOTlight original geometry')
try:
    for x in [-.57,.57]:
        for y in [-.255,.255]:
            box('Bench foot',(x,y,.025),(.14,.13,.05),'rubber')
            box('Bench leg',(x,y,.43),(.06,.06,.81),'paint')
    box('Lower shelf',(0,0,.23),(1.24,.57,.045),'paint')
    box('Steel worktop',(0,0,.86),(1.34,.66,.065))
    for x in [-.4,0,.4]:
        box('Drawer front',(x,.3,.66),(.37,.045,.24),'paint')
        rod('Drawer handle',(x-.1,.34,.68),(x+.1,.34,.68),.012)
    for x in [-.59,.59]:box('Tool-board upright',(x,-.295,1.2),(.035,.035,.83),'paint')
    box('Tool board',(0,-.31,1.27),(1.22,.025,.62),'paint')
    for i,x in enumerate([-.44,-.22,0,.22,.44]):
        rod('Hanging wrench',(x,-.275,1.22),(x,-.275,1.47-i*.025),.016)
        arc('Wrench jaw',(x,-.275,1.48-i*.025),.035,.009,0,math.pi)
    box('Bench vice base',(.37,.08,.92),(.21,.22,.05))
    for x in [.3,.46]:box('Vice jaw',(x,.08,.995),(.05,.18,.12))
    rod('Vice screw',(.22,.08,.97),(.57,.08,.97),.018)
    rod('Vice handle',(.57,.08,.89),(.57,.08,1.05),.011)
    box('Parts case',(-.38,0,.38),(.32,.3,.26),'wood')
    entries=[export('maintenance_workbench')];parts=[]
    # Hook lowest point at Z=0, reeved cable, drum and trolley riding a bridge.
    arc('Forged lifting hook',(0,0,.10),.075,.025,-math.pi/2,math.pi*.95)
    rod('Hook swivel',(0,0,.16),(0,0,.28),.035)
    box('Hook block',(0,0,.32),(.18,.12,.14),'safety')
    for x in [-.06,.06]:rod('Reeved steel cable',(x,0,.39),(x,0,.83),.008)
    box('Hoist casing',(0,0,.9),(.48,.38,.25),'safety')
    rod('Cable drum',(-.22,0,.86),(.22,0,.86),.105)
    rod('Hoist motor',(.22,0,.9),(.39,0,.9),.11,'paint')
    box('Trolley frame',(0,0,1.035),(.68,.52,.07))
    for x in [-.25,.25]:
        for y in [-.27,.27]:
            rod('Flanged trolley wheel',(x,y-.035,1.1),(x,y+.035,1.1),.1,vertices=16)
            rod('Wheel flange',(x,y-.037,1.1),(x,y-.028,1.1),.116,vertices=16)
            box('Wheel bearing',(x,y,1.1),(.12,.09,.09),'paint')
    entries.append(export('bridge_hoist'))
    bpy.data.libraries.write(os.path.join(ROOT,'art/spot-room-fitout.blend'),{scene},fake_user=True)
    with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(entries,f,indent=2)
    print(json.dumps(entries))
finally:
    bpy.context.window.scene=previous
