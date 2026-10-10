"""Run with Blender MCP. Reuses the original library's material and export helpers.
Adds two original assets in a separate scene; restores the user's active scene.
"""
import bpy, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
helper_path=os.path.join(ROOT,'scripts/build-blender-equipment.py')
source=open(helper_path).read()
previous_scene=bpy.context.window.scene
previous_active=bpy.context.view_layer.objects.active
previous_selected=list(bpy.context.selected_objects)
exec(compile(source.split('BUILDERS=')[0],helper_path,'exec'))
scene=bpy.data.scenes.get('SPOT_Facility_Expansion') or bpy.data.scenes.new('SPOT_Facility_Expansion')
bpy.context.window.scene=scene

def compressor():
    base(3.8,2.3)
    # Horizontal receiver, bolted end covers and two reciprocating compressor heads.
    cyl('Receiver barrel',(-1.5,0,.78),(1.5,0,.78),.52,'petrol_enamel',32)
    for x in [-1.5,1.5]:
        flange((x,0,.78),.55,'X',12)
        sphere('Dished receiver head',(x,0,.78),(.16,.51,.51),'petrol_enamel')
    for x in [-1,1]:box('Receiver saddle',(x,0,.36),(.24,1.05,.45),'cast_iron')
    for x in [-.68,.68]:
        box('Compressor crankcase',(x,0,1.55),(.7,.6,.5),'sage_enamel')
        cyl('Finned cylinder head',(x,0,1.72),(x,0,2.2),.21,'machined_steel')
        for z in [1.8,1.88,1.96,2.04,2.12]:cyl('Cylinder cooling fin',(x,0,z),(x,0,z+.035),.28,'machined_steel')
        cyl('Discharge tube',(x,.12,2.12),(x,.72,2.12),.06)
        cyl('Tube downleg',(x,.72,2.12),(x,.72,.8),.06)
        flange((x,.72,1.05),.12)
    cyl('Motor stator',(-.45,-.69,1.5),(.45,-.69,1.5),.28,'petrol_enamel')
    for x in [-.35,-.24,-.13,-.02,.09,.2,.31]:ring('Motor cooling ring',(x,-.69,1.5),.285,.016,'petrol_enamel','X')
    box('Drive guard',(0,-.52,1.83),(1.7,.08,.25),'safety_yellow')
    gauge((1,-.4,1.45))
    cyl('Relief stem',(1.3,0,1.2),(1.3,0,1.75),.05)
    ring('Isolation handwheel',(1.3,0,1.75),.17,.024,'valve_red')

def exchanger():
    base(5,2.2)
    cyl('Shell tube bundle',(-2,0,1.15),(2,0,1.15),.7,'machined_steel',32)
    for x in [-2,2]:
        flange((x,0,1.15),.76,'X',16)
        sphere('Channel bonnet',(x,0,1.15),(.25,.69,.69),'petrol_enamel')
    for x in [-1.4,1.4]:
        box('Saddle foot',(x,0,.36),(.4,1.3,.4),'cast_iron')
        box('Saddle support',(x,0,.65),(.3,.75,.3),'sage_enamel')
        cyl('Cooling inlet',(x,0,1.5),(x,0,2.5),.14,'petrol_enamel')
        flange((x,0,2.3),.24)
        ring('Valve wheel',(x,0,2.58),.22,.024,'valve_red')
    cyl('Return manifold',(-1.4,.72,2.3),(1.4,.72,2.3),.13,'petrol_enamel')
    for x in [-1.4,1.4]:cyl('Manifold elbow',(x,.72,2.3),(x,0,2.3),.13,'petrol_enamel')
    for x in [-1.1,-.4,.4,1.1]:ring('Shell seam',(x,0,1.15),.705,.013,'cast_iron','X')
    gauge((-.8,-.58,1.86));gauge((.8,-.58,1.86))

BUILDERS={'compressor':compressor,'heat_exchanger':exchanger}
SPOT_BUILD_NAMES=list(BUILDERS)
exec(compile('manifest_path='+source.split('manifest_path=',1)[1],helper_path,'exec'))
# Save a separate review artifact containing the original library plus the expansion.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art/spot-facility-expansion.blend'),copy=True)
bpy.context.window.scene=previous_scene
bpy.ops.object.select_all(action='DESELECT')
for obj in previous_selected:
    if obj.name in bpy.context.view_layer.objects:obj.select_set(True)
if previous_active and previous_active.name in bpy.context.view_layer.objects:bpy.context.view_layer.objects.active=previous_active
print('Restored original scene; new assets exported and expansion blend saved.')
