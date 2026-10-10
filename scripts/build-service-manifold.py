"""Original metric piping assembly. Run with Blender MCP; restores active scene."""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public/models/services')
os.makedirs(OUT,exist_ok=True)
previous=bpy.context.window.scene
scene=bpy.data.scenes.new('SPOT_Service_Manifold')
bpy.context.window.scene=scene
materials={}
for name,color,metal,rough in [('enamel',(.085,.26,.28),.4,.52),('steel',(.5,.56,.58),.85,.38),('valve',(.47,.075,.045),.4,.55),('dial',(.84,.86,.78),.02,.68)]:
    m=bpy.data.materials.new('SPOT_service_'+name);m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*color,1)
    n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
    materials[name]=m
parts=[]
def finish(o,name,material):
    o.name=name;o.data.materials.append(materials[material]);parts.append(o)
def rod(name,a,b,r,material='steel',vertices=12):
    a,b=Vector(a),Vector(b);delta=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=delta.length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=delta.to_track_quat('Z','Y')
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    finish(o,name,material)
def box(name,p,size):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,name,'steel')
def bend(name,center,start,end):
    verts=[];faces=[];cx,cy,cz=center
    for i in range(9):
        a=start+(end-start)*i/8
        for j in range(12):
            b=j*math.tau/12;r=.3+.085*math.cos(b)
            verts.append((cx+r*math.cos(a),cy+.085*math.sin(b),cz+r*math.sin(a)))
    for i in range(8):
        for j in range(12):faces.append((i*12+j,i*12+(j+1)%12,(i+1)*12+(j+1)%12,(i+1)*12+j))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o)
    for p in mesh.polygons:p.use_smooth=True
    finish(o,name,'enamel')
def flange(x,z):
    rod('Mating flange',(x,0,z-.025),(x,0,z+.025),.145)
    for i in range(6):
        a=i*math.tau/6;dx,dy=.116*math.cos(a),.116*math.sin(a)
        rod('Hex bolt',(x+dx,dy,z-.045),(x+dx,dy,z+.045),.016,vertices=6)
try:
    for x in [-.65,.65]:
        rod('Port downleg',(x,0,.3),(x,0,.9),.085,'enamel',16);flange(x,.46)
        box('Stanchion foot',(x,0,.035),(.28,.28,.07))
        rod('Stanchion',(x,.1,.07),(x,.1,.65),.025)
        box('Pipe saddle',(x,0,.65),(.22,.035,.06))
    bend('Swept left elbow',(-.35,0,.9),math.pi,math.pi/2)
    bend('Swept right elbow',(.35,0,.9),math.pi/2,0)
    rod('Header',(-.35,0,1.2),(.35,0,1.2),.085,'enamel',16)
    rod('Valve body',(0,0,1.2),(0,0,1.38),.12,'enamel',16)
    rod('Bonnet',(0,0,1.38),(0,0,1.43),.145)
    rod('Valve stem',(0,0,1.43),(0,0,1.62),.026)
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,major_radius=.18,minor_radius=.022,location=(0,0,1.62))
    finish(bpy.context.object,'Isolation handwheel','valve')
    for a in [0,math.pi/2]:rod('Handwheel spoke',(-.17*math.cos(a),-.17*math.sin(a),1.62),(.17*math.cos(a),.17*math.sin(a),1.62),.014,'valve')
    rod('Gauge takeoff',(-.27,0,1.2),(-.27,-.17,1.39),.018)
    rod('Gauge bezel',(-.27,-.16,1.39),(-.27,-.22,1.39),.1)
    rod('Blank mechanical dial',(-.27,-.223,1.39),(-.27,-.23,1.39),.088,'dial',24)
    # Scale marks only: no simulated or invented sensor value.
    for i in range(9):
        a=math.pi*.2+i*math.pi*1.6/8
        rod('Dial tick',(-.27+.069*math.cos(a),-.233,1.39+.069*math.sin(a)),(-.27+.08*math.cos(a),-.233,1.39+.08*math.sin(a)),.003,'steel',6)
    joined=[];groups=[(m,[o for o in parts if o.data.materials[0]==m]) for m in materials.values()]
    for material,group in groups:
        if not group:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        if len(group)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name='service_manifold_'+material.name
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);joined.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined:o.select_set(True)
    bpy.context.view_layer.objects.active=joined[0]
    import io_scene_gltf2
    glb=next(e[0] for e in io_scene_gltf2.get_format_items(None,bpy.context) if 'GLB' in e[0])
    output=os.path.join(OUT,'service_manifold.glb')
    bpy.ops.export_scene.gltf(filepath=output,export_format=glb,use_selection=True,use_active_scene=True,export_yup=True,export_animations=False)
    bpy.data.libraries.write(os.path.join(ROOT,'art/spot-service-manifold.blend'),{scene},fake_user=True)
    entry=dict(name='service_manifold',bytes=os.path.getsize(output),triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in joined),meshes=len(joined),portsYUp=[[-.65,.3,0],[.65,.3,0]],author='SPOTlight original geometry',license='Project license')
    with open(os.path.join(OUT,'manifest.json'),'w') as file:json.dump([entry],file,indent=2)
    print(json.dumps(entry))
finally:
    bpy.context.window.scene=previous
