import {roomFurniture} from './room-furniture.mjs';

// Modular, metric assemblies share the environment instance batches. Helpers
// transform the depth axis to the room-facing wall normal, so handles and
// working surfaces always face the aisle. The complete mesh fits its collider.
export function buildRoomFurniture({setFloor,box,shape,pipe,m,painted,ceramic,amber}){
 for(const o of roomFurniture){
  setFloor(o.floor);const width=o.axis==='x'?o.d:o.w,depth=o.axis==='x'?o.w:o.d,h=o.h;
  const point=(u,y,v=0)=>o.axis==='x'?[o.x+o.normal*v,y,o.z+u]:[o.x+u,y,o.z+o.normal*v];
  const slab=(w,yh,d,u,y,v,material)=>box(o.axis==='x'?[d,yh,w]:[w,yh,d],point(u,y,v),material);
  const rod=(a,b,r,material)=>pipe(point(...a),point(...b),r,material);
  const light=(u,y,r,material,v)=>shape('cylinder',[r,.012,r],point(u,y,v),material,o.axis==='x'?[0,0,Math.PI/2]:[Math.PI/2,0,0]);
  // Physical furniture plinth sits on the floor, inside its exact rectangle.
  slab(width,.025,depth,0,.0125,0,m.dark);
  if(o.asset==='partsRack'){
   for(const u of [-width/2+.035,width/2-.035])for(const v of [-depth/2+.035,depth/2-.035])slab(.04,h-.025,.04,u,.025+(h-.025)/2,v,m.yellow);
   for(const y of [.07,h*.43,h*.78]){
    slab(width-.06,.035,depth-.06,0,y,0,m.steel);
    const count=Math.max(2,Math.floor(width/.4));
    for(let i=0;i<count;i++){
     const u=-width/2+.10+(i+.5)*(width-.2)/count,bw=(width-.2)/count-.05;
     slab(bw,.20,depth-.15,u,y+.1175,0,i%2?painted:amber);
     slab(bw-.04,.045,.007,u,y+.15,depth/2-.071,ceramic);
    }
   }
   // Braced rear frame and all trays connect to uprights.
   rod([-width/2+.04,.10,-depth/2+.035],[width/2-.04,h-.04,-depth/2+.035],.009,m.silver);
  }else if(o.asset==='worktable'||o.asset==='console'){
   const top=o.asset==='console'?.76:h;
   slab(width-.025,.06,depth-.025,0,top-.03,0,m.steel);
   for(const u of [-width/2+.06,width/2-.06])for(const v of [-depth/2+.06,depth/2-.06])slab(.06,top-.08,.06,u,.025+(top-.08)/2,v,painted);
   slab(width-.12,.035,depth-.12,0,.28,0,m.steel);
   if(o.asset==='console'){
    for(const u of [-width*.25,width*.25]){
     rod([u,.76,-.13],[u,.95,-.13],.023,m.silver);
     slab(.63,.26,.042,u,1.075,-.12,m.dark);slab(.57,.20,.005,u,1.075,-.096,painted);
     // Static wiring diagram only; the existing mission monitor shows data.
     for(const y of [1.025,1.10])slab(.4,.008,.005,u,y,-.092,m.blue);
     slab(.008,.13,.006,u-.12,1.065,-.09,m.silver);
     slab(.47,.015,.15,u,.770,depth/2-.105,m.dark);
     for(let du=-.17;du<.18;du+=.045)slab(.02,.003,.10,u+du,.779,depth/2-.105,m.silver);
    }
   }else{
    // Bins fill the lower shelf; the clear table remains a maintenance surface.
    for(const u of [-.6,0,.6])slab(.42,.25,depth-.18,u,.4225,0,painted);
   }
  }else if(o.asset==='airDryer'){
   slab(width-.07,.95,depth-.07,0,.50,-.01,painted);
   for(const u of [-.25,.25]){
    rod([u,.975,0],[u,1.5,0],.12,ceramic);
    slab(.26,.045,.28,u,1.5225,0,m.silver);
    rod([u,1.545,0],[u,1.615,0],.025,m.blue);
   }
   rod([-.25,1.615,0],[.25,1.615,0],.025,m.blue);
   for(let y=.25;y<.8;y+=.08)slab(width-.16,.03,.025,0,y,depth/2-.025,m.dark);
  }else{
   const columns=o.asset==='lockers'?3:o.asset==='communicationsRack'?1:2,cw=(width-.07)/columns,face=depth/2-.04;
   slab(width-.035,h-.05,depth-.10,0,h/2,0,painted);
   for(let i=0;i<columns;i++){
    const u=(i-(columns-1)/2)*cw;
    slab(cw-.025,h-.17,.016,u,h/2+.02,face,o.asset==='safetyCabinet'?m.red:ceramic);
    slab(.026,.12,.021,u+cw*.31,h*.50,face+.01,m.dark);
    slab(cw*.52,.065,.010,u,h-.19,face+.011,amber);
    if(o.asset==='communicationsRack'){
     slab(cw-.08,h-.40,.016,u,h/2+.02,face+.013,m.dark);
     for(let y=.22;y<h-.29;y+=.14){slab(cw-.11,.09,.011,u,y,face+.023,m.steel);light(u-cw*.3,y,.009,m.blue,face+.03);}
    }else if(o.asset==='cabinet'){
     for(let y=.19;y<h-.22;y+=.18){slab(cw-.05,.010,.015,u,y,face+.013,m.dark);slab(.20,.022,.012,u,y+.05,face+.015,m.silver);}
    }else{
     for(let y=.18;y<.44;y+=.065)slab(cw-.12,.015,.012,u,y,face+.013,m.dark);
     if(o.asset==='switchgear')light(u,h-.34,.025,m.red,face+.02);
    }
   }
  }
  // Paint the service access boundary, keeping the front opening unblocked.
  // It is a flush floor marking, not a raised safety barrier.
  for(const sign of [-1,1])slab(.023,.004,depth+.25,sign*(width/2+.04),.006,.10,m.yellow);
 }
 return roomFurniture.length;
}
