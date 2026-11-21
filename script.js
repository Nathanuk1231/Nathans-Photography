import * as THREE from 'three';

/* ---------- Supabase (public, read-only, publishable key only) ---------- */
const SB={url:'https://etjlhaohtdyzhcftqmzb.supabase.co',key:'sb_publishable_RpQWqQrMEqd_YFqC3Q3CrQ_Y64nITot',table:'photos',bucket:'photos'};
const WALL=24; // photos hung on the museum walls; the café menu lists every photo
const HD={apikey:SB.key,Authorization:'Bearer '+SB.key};
const str=v=>typeof v==='string'&&v.trim()?v.trim():'';
const pub=p=>/^https?:\/\//i.test(p)?p:`${SB.url}/storage/v1/object/public/${SB.bucket}/${String(p).split('/').map(encodeURIComponent).join('/')}`;
async function get(url,o={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);
  try{return await fetch(url,{...o,headers:{...HD,...(o.headers||{})},signal:c.signal})}finally{clearTimeout(t)}}
function norm(r,i){
  const src=str(r.image_url)||str(r.url)||str(r.src)||str(r.path)||str(r.image);if(!src)return null;
  const date=str(r.date);
  return{title:str(r.title)||'Untitled',cap:str(r.category),desc:str(r.description),year:date.slice(0,4),src:pub(src),
    thumb:str(r.thumb_url)?pub(str(r.thumb_url)):'',featured:r.featured===true,
    order:r.sort_order==null||r.sort_order===''?Infinity:Number(r.sort_order),idx:i}}
async function getPhotos(){
  let rows=null;
  try{let r=await get(`${SB.url}/rest/v1/${SB.table}?select=*&order=sort_order.asc.nullslast,id.asc`);
    if(r.status===400)r=await get(`${SB.url}/rest/v1/${SB.table}?select=*`);
    if(r.ok)rows=await r.json()}catch(e){}
  let list=Array.isArray(rows)?rows.map(norm).filter(Boolean):[];
  if(!list.length){
    try{const r=await get(`${SB.url}/storage/v1/object/list/${SB.bucket}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:'',limit:200,offset:0,sortBy:{column:'name',order:'asc'}})});
      if(r.ok){const f=await r.json();list=f.filter(o=>o.id&&/\.(jpe?g|png|webp|avif)$/i.test(o.name)).map((o,i)=>norm({path:o.name,category:'Gallery'},i)).filter(Boolean)}}catch(e){}}
  return list.sort((a,b)=>(b.featured-a.featured)||(a.order-b.order)||(a.idx-b.idx));
}
function loadImg(p){return new Promise(res=>{const im=new Image();im.crossOrigin='anonymous';
  im.onload=()=>{const s=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);res({...p,canvas:c,ar:c.width/c.height})};
  im.onerror=()=>res(null);im.src=p.src})}
function placeholders(){const cols=[['#FBE46D','#F7D2D1'],['#F7D2D1','#C9D8F0'],['#C9D8F0','#FFF1C2'],['#FCEB93','#F5C6A5'],['#F6EAD8','#F7D2D1'],['#D9E8C8','#FBE46D']];
  return cols.map((c,i)=>{const cv=document.createElement('canvas');cv.width=900;cv.height=i%2?1200:600;const x=cv.getContext('2d'),g=x.createLinearGradient(0,0,cv.width,cv.height);g.addColorStop(0,c[0]);g.addColorStop(1,c[1]);x.fillStyle=g;x.fillRect(0,0,cv.width,cv.height);
    x.fillStyle='rgba(58,53,80,.55)';x.font='500 34px "DM Mono",monospace';x.textAlign='center';x.fillText('PHOTOS COULDN’T LOAD',cv.width/2,cv.height/2);
    return{canvas:cv,ar:cv.width/cv.height,title:'Photo '+(i+1),cap:'',desc:'',year:'',src:cv.toDataURL('image/jpeg',.8)}})}

/* ---------- renderer, camera ---------- */
const $=s=>document.querySelector(s);
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const coarse=matchMedia('(pointer:coarse)').matches;
const HT=4.2,EYE=1.65;
const host=$('#gallery');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
host.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xFFF9EC);scene.fog=new THREE.Fog(0xFFF9EC,16,60);
const cam=new THREE.PerspectiveCamera(68,1,.05,120);cam.rotation.order='YXZ';
function resize(){renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.fov=innerWidth<innerHeight?80:68;cam.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
scene.add(new THREE.HemisphereLight(0xfff4e0,0xd9c3a0,2.6));
const sun=new THREE.DirectionalLight(0xffe8c8,.6);sun.position.set(3,8,4);scene.add(sun);

/* ---------- textures & helpers ---------- */
const ctex=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t};
const wallTex=ctex(4,256,(x,w,h)=>{const g=x.createLinearGradient(0,h,0,0);[[0,'#EAD9BC'],[.12,'#F6EBD6'],[.5,'#FBF3E3'],[.9,'#FBF3E3'],[1,'#F1E4CB']].forEach(s=>g.addColorStop(s[0],s[1]));x.fillStyle=g;x.fillRect(0,0,w,h)});
const woodTex=ctex(512,512,(x,w,h)=>{const tones=['#D9B98B','#D2B081','#DDBF93','#CFAB7B'];for(let i=0;i<8;i++){x.fillStyle=tones[i%4];x.fillRect(0,i*64,w,64);x.fillStyle='rgba(120,85,45,.35)';x.fillRect(0,i*64,w,2);const o=(i*173)%512;x.fillRect(o,i*64,2,64)}});
woodTex.wrapS=woodTex.wrapT=THREE.RepeatWrapping;
const glowT=ctex(128,128,x=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,226,176,1)');g.addColorStop(.35,'rgba(255,205,140,.45)');g.addColorStop(1,'rgba(255,190,120,0)');x.fillStyle=g;x.fillRect(0,0,128,128)});
const beamT=ctex(4,64,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,225,170,.55)');g.addColorStop(1,'rgba(255,225,170,0)');x.fillStyle=g;x.fillRect(0,0,w,h)});
const basic=o=>new THREE.MeshBasicMaterial(o);
const lam=c=>new THREE.MeshLambertMaterial({color:c});
const addM=(map,o)=>new THREE.MeshBasicMaterial({map,transparent:true,opacity:o,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
const put=(m,x,y,z,p=scene)=>{m.position.set(x,y,z);p.add(m);return m};
const bx=(w,h,d,c,x,y,z,p)=>put(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),lam(c)),x,y,z,p);
const cy=(rt,rb,h,c,x,y,z,p,s=20)=>put(new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s),lam(c)),x,y,z,p);
const wallM=basic({map:wallTex,side:THREE.DoubleSide}),plainM=basic({color:0xFBF3E3,side:THREE.DoubleSide});
function wall(x1,z1,x2,z2,y0=0,y1=HT,m=wallM){
  const len=Math.hypot(x2-x1,z2-z1),a=-Math.atan2(z2-z1,x2-x1),cx=(x1+x2)/2,cz=(z1+z2)/2;
  const p=put(new THREE.Mesh(new THREE.PlaneGeometry(len,y1-y0),m),cx,(y0+y1)/2,cz);p.rotation.y=a;
  if(y0===0){const s=put(new THREE.Mesh(new THREE.BoxGeometry(len,.14,.14),lam(0xE3CFAA)),cx,.07,cz);s.rotation.y=a}
  if(y1===HT){const s=put(new THREE.Mesh(new THREE.BoxGeometry(len,.1,.1),lam(0xEFE0C4)),cx,HT-.05,cz);s.rotation.y=a}}
function floor(x,z,w,d){const t=woodTex.clone();t.needsUpdate=true;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(w/2.4,d/2.4);
  const m=put(new THREE.Mesh(new THREE.PlaneGeometry(w,d),basic({map:t})),x,0,z);m.rotation.x=-Math.PI/2;
  const c=put(new THREE.Mesh(new THREE.PlaneGeometry(w,d),basic({color:0xFAF1E0,side:THREE.DoubleSide})),x,HT,z);c.rotation.x=Math.PI/2}
function glow(x,y,z,s,o){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowT,transparent:true,opacity:o,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));sp.scale.set(s,s,1);return put(sp,x,y,z)}
function pool(x,z,r,o){const m=put(new THREE.Mesh(new THREE.CircleGeometry(r,32),addM(glowT,o)),x,.012,z);m.rotation.x=-Math.PI/2}
const sign=(txt,sub,w,h)=>{const t=ctex(1024,Math.round(1024*h/w),(x,cw,ch)=>{x.fillStyle='#3A3550';x.textAlign='center';x.font='600 '+Math.round(ch*.5)+'px Oswald,sans-serif';x.fillText(txt,cw/2,ch*(sub?.56:.68));if(sub){x.font='400 '+Math.round(ch*.17)+'px "DM Mono",monospace';x.fillText(sub,cw/2,ch*.84)}});
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),basic({map:t,transparent:true}))};
function recessed(x,z,r=.17){const m=put(new THREE.Mesh(new THREE.CircleGeometry(r,24),basic({color:0xFFF3D2})),x,HT-.012,z);m.rotation.x=Math.PI/2;glow(x,HT-.25,z,1.1,.5);pool(x,z,1.7,.2)}
function strip(x,z){const m=put(new THREE.Mesh(new THREE.PlaneGeometry(.45,1.8),basic({color:0xFFF0CC})),x,HT-.012,z);m.rotation.x=Math.PI/2;glow(x,HT-.3,z,2.2,.45);pool(x,z,2.4,.16)}
function pendant(x,z){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
  cy(.008,.008,1.2,0x6b5a4a,0,HT-.6,0,g,6);
  const sh=new THREE.Mesh(new THREE.CylinderGeometry(.14,.34,.3,28,1,true),new THREE.MeshLambertMaterial({color:0xE4B77C,side:THREE.DoubleSide,emissive:0x8a5522}));put(sh,0,HT-1.35,0,g);
  const b=put(new THREE.Mesh(new THREE.CircleGeometry(.3,24),basic({color:0xFFE9B8})),0,HT-1.5,0,g);b.rotation.x=Math.PI/2;
  glow(x,HT-1.62,z,1.9,.6);pool(x,z,2.3,.3)}
const Y=new THREE.Vector3(0,-1,0);
function spot(f,t){const d=t.clone().sub(f),len=d.length();d.normalize();const q=new THREE.Quaternion().setFromUnitVectors(Y,d);
  const can=put(new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.24,14),lam(0x3b3430)),f.x,f.y,f.z);can.quaternion.copy(q);
  glow(f.x+d.x*.14,f.y+d.y*.14,f.z+d.z*.14,.55,.9);
  const g=new THREE.ConeGeometry(.9,len,28,1,true);g.translate(0,-len/2,0);
  const c=put(new THREE.Mesh(g,addM(beamT,.55)),f.x,f.y,f.z);c.quaternion.copy(q);c.material.side=THREE.DoubleSide}

/* ---------- layout & collision ---------- */
const colliders=[],interact=[];
const tables=[[3.2,-4.4],[-3.6,-3.4],[-4.2,-8.0],[3.4,-9.0],[-1.1,-9.6]];
let L=30;
const inR=(x,z,a,b,c,d)=>x>a&&x<b&&z>c&&z<d;
const walkable=(x,z)=>inR(x,z,-6.62,6.62,-11.62,-.38)||inR(x,z,-1.22,1.22,-12.45,-11.55)||inR(x,z,-3.62,3.62,-12-L+.38,-12.38);
const free=(x,z)=>walkable(x,z)&&!colliders.some(c=>inR(x,z,c[0],c[1],c[2],c[3]));

function buildCafe(){
  floor(0,-6,14,12);
  wall(-7,0,7,0);wall(-7,0,-7,-12);wall(7,0,7,-12);
  wall(-7,-12,-1.6,-12);wall(1.6,-12,7,-12);wall(-1.6,-12,1.6,-12,2.7,HT,plainM);
  bx(.16,2.7,.3,0x8a6a4a,-1.6,1.35,-12);bx(.16,2.7,.3,0x8a6a4a,1.6,1.35,-12);bx(3.4,.16,.3,0x8a6a4a,0,2.74,-12);
  const ds=sign('THE GALLERY','THIS WAY →',3,.9);put(ds,0,3.5,-11.92);
  const cs=sign('CAFÉ',null,2.6,1);put(cs,6.93,3.15,-8.5);cs.rotation.y=-Math.PI/2;
  // counter, shelves, machine
  bx(1.2,1.05,5,0x8c6a4a,6.1,.525,-8.5);bx(1.4,.08,5.2,0xE9D8BE,6.0,1.08,-8.5);
  bx(.3,.05,5,0x8c6a4a,6.8,1.75,-8.5);bx(.3,.05,5,0x8c6a4a,6.8,2.3,-8.5);
  bx(.5,.45,.7,0x3b3b44,6.0,1.35,-9.6);
  for(let i=0;i<9;i++){cy(.06,.05,.1,0xFFFFFF,6.8,1.83,-10.6+i*.5,scene,12);cy(.07,.06,.12,0xF2D9C0,6.8,2.38,-10.6+i*.5,scene,12)}
  colliders.push([4.95,7,-11.5,-5.5]);
  // tables, chairs, cups
  tables.forEach(([x,z],i)=>{
    cy(.62,.62,.05,0xB88A5E,x,.76,z,scene,28);cy(.05,.05,.74,0x5b4a3a,x,.38,z,scene,10);cy(.3,.3,.03,0x5b4a3a,x,.02,z,scene,20);
    for(let k=0;k<3;k++){const a=k*2.1+i;const cx=x+Math.sin(a)*1.05,cz=z+Math.cos(a)*1.05;
      cy(.23,.23,.05,0xC9825B,cx,.46,cz,scene,16);cy(.03,.03,.44,0x5b4a3a,cx,.22,cz,scene,6);
      const b=bx(.4,.4,.05,0xC9825B,cx+Math.sin(a)*.2,.7,cz+Math.cos(a)*.2);b.rotation.y=a}
    if(i)cy(.06,.05,.08,0xFFFFFF,x+.2,.82,z+.1,scene,12);
    colliders.push([x-.95,x+.95,z-.95,z+.95]);
    pendant(x,z)});
  // plants
  [[-6.2,-.9],[-6.2,-11.1],[6.2,-.9]].forEach(([x,z])=>{cy(.28,.22,.45,0xB5683F,x,.22,z,scene,14);for(let k=0;k<5;k++)put(new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),lam(0x6f8f58)),x+Math.sin(k*1.3)*.2,.75+k*.1,z+Math.cos(k*1.3)*.2)});
  [[-3.5,-1.5],[3.5,-1.5],[0,-6.2]].forEach(([x,z])=>recessed(x,z));recessed(-3.5,-11.2);recessed(3.5,-11.2);
  // menu tent card
  const mt=ctex(256,360,(x,w,h)=>{x.fillStyle='#FFF9EF';x.fillRect(0,0,w,h);x.strokeStyle='#3A3550';x.lineWidth=5;x.strokeRect(14,14,w-28,h-28);x.fillStyle='#3A3550';x.textAlign='center';x.font='600 72px Oswald,sans-serif';x.fillText('MENU',w/2,150);x.font='italic 400 24px Newsreader,serif';x.fillText('every photograph',w/2,196);x.font='400 17px "DM Mono",monospace';x.fillText('CLICK TO OPEN',w/2,300)});
  const mg=new THREE.Group();mg.position.set(3.2,.785,-4.4);mg.rotation.y=Math.atan2(-1.2,1.3);scene.add(mg);
  const a=put(new THREE.Mesh(new THREE.BoxGeometry(.3,.4,.012),new THREE.MeshLambertMaterial({map:mt})),0,.19,.07,mg);a.rotation.x=-.28;
  const b=put(new THREE.Mesh(new THREE.BoxGeometry(.3,.4,.012),lam(0xF6EAD8)),0,.19,-.07,mg);b.rotation.x=.28;
  const hit=put(new THREE.Mesh(new THREE.BoxGeometry(.8,.7,.7),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})),3.2,1.0,-4.4);hit.userData={menu:true};interact.push(hit);
  const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:ctex(256,96,(x,w,h)=>{x.fillStyle='#1e1b2b';x.beginPath();x.roundRect(8,8,w-16,h-30,22);x.fill();x.fillStyle='#fff';x.textAlign='center';x.font='500 30px "DM Mono",monospace';x.fillText('OPEN MENU',w/2,52);x.beginPath();x.moveTo(w/2-12,h-24);x.lineTo(w/2+12,h-24);x.lineTo(w/2,h-6);x.fill()}),depthTest:false,transparent:true}));
  tag.scale.set(.9,.34,1);put(tag,3.2,1.55,-4.4);tag.renderOrder=10;
  const halo=glow(3.2,.9,-4.4,1.2,.5);
  return{tag,halo}}

function buildHall(W){
  const P2=Math.ceil(W.length/2);L=6.4+P2*4.6;
  floor(0,-12-L/2,8,L);
  wall(-4,-12,-4,-12-L);wall(4,-12,4,-12-L);wall(-4,-12-L,4,-12-L);
  const es=sign('THANKS FOR VISITING','@nathans_photography_2010',5.2,1.3);put(es,0,2.2,-12-L+.02);
  for(let s=0;s<=P2;s++)strip(0,-12.9-s*4.6);
  [.33,.66].forEach(f=>{const z=-12-L*f;bx(.5,.08,1.8,0x6b4f38,0,.46,z);bx(.46,.1,1.7,0xC9825B,0,.54,z);[[-.18,-.8],[.18,-.8],[-.18,.8],[.18,.8]].forEach(o=>bx(.05,.42,.05,0x5b4a3a,o[0],.21,z+o[1]));colliders.push([-.75,.75,z-1.2,z+1.2])});
  // rails
  [-3.0,3.0].forEach(x=>bx(.06,.05,L-1,0x4a3f36,x,HT-.06,-12-L/2));
  W.forEach((p,i)=>{const side=i%2?1:-1,slot=Math.floor(i/2),z=-15.2-slot*4.6,wx=side*4;
    const mw=1.9,mh=1.5,w=p.ar>mw/mh?mw:mh*p.ar,h=p.ar>mw/mh?mw/p.ar:mh,cy0=1.7;
    const g=new THREE.Group();g.position.set(wx,0,z);g.rotation.y=side<0?Math.PI/2:-Math.PI/2;scene.add(g);
    const wash=put(new THREE.Mesh(new THREE.PlaneGeometry(w+2.2,h+2.6),addM(glowT,.55)),0,cy0+.35,.004,g);
    put(new THREE.Mesh(new THREE.BoxGeometry(w+.26,h+.26,.05),lam(0xD3AA72)),0,cy0,.025,g);
    put(new THREE.Mesh(new THREE.PlaneGeometry(w+.14,h+.14),basic({color:0xF6EAD8})),0,cy0,.052,g);
    const t=new THREE.CanvasTexture(p.canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
    const pr=put(new THREE.Mesh(new THREE.PlaneGeometry(w,h),basic({map:t})),0,cy0,.056,g);pr.userData={photo:p};interact.push(pr);
    const lt=ctex(640,256,(x)=>{x.fillStyle='#3A3550';x.font='italic 400 52px Newsreader,Georgia,serif';let s=p.title;while(x.measureText(s).width>590&&s.length>4)s=s.slice(0,-2);if(s!==p.title)s+='…';x.fillText(s,24,86);x.globalAlpha=.7;x.font='400 28px "DM Mono",monospace';x.fillText(('Nathan Lloyd'+(p.year?' · '+p.year:'')+(p.cap?' · '+p.cap:'')).toUpperCase().slice(0,34),24,150)});
    put(new THREE.Mesh(new THREE.PlaneGeometry(1.1,.44),basic({map:lt,transparent:true})),-w/2+.55,cy0-h/2-.42,.012,g);
    spot(new THREE.Vector3(side*3.0,HT-.18,z),new THREE.Vector3(wx-side*.05,cy0+.15,z))});
}

/* ---------- camera state & movement ---------- */
const S={x:0,z:-1.4,yaw:0,pitch:0};
let vx=0,vz=0,gl=null;
const keys={};
const open=()=>$('#prompt').classList.contains('on')||$('#menu').classList.contains('on')||$('#view').classList.contains('on');
addEventListener('keydown',e=>{if(e.code==='Escape'){if($('#view').classList.contains('on'))closeView();else if($('#menu').classList.contains('on'))closeMenu();else if($('#prompt').classList.contains('on'))closePrompt();return}
  if(!open()&&/^(KeyW|KeyA|KeyS|KeyD|Arrow\w+|ShiftLeft|ShiftRight)$/.test(e.code)){keys[e.code]=1;if(e.code.startsWith('Arrow'))e.preventDefault()}});
addEventListener('keyup',e=>{delete keys[e.code]});
addEventListener('blur',()=>{for(const k in keys)delete keys[k]});
const stick={x:0,y:0},sEl=$('#stick'),knob=sEl.firstElementChild;let sid=null;
sEl.addEventListener('pointerdown',e=>{sid=e.pointerId;sEl.setPointerCapture(sid);mv(e)});
const mv=e=>{if(e.pointerId!==sid)return;const r=sEl.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),m=Math.min(1,Math.hypot(dx,dy)/45),a=Math.atan2(dy,dx);stick.x=Math.cos(a)*m;stick.y=Math.sin(a)*m;knob.style.transform=`translate(${stick.x*40}px,${stick.y*40}px)`};
sEl.addEventListener('pointermove',mv);
const endS=e=>{if(e.pointerId!==sid)return;sid=null;stick.x=stick.y=0;knob.style.transform=''};
sEl.addEventListener('pointerup',endS);sEl.addEventListener('pointercancel',endS);
function lookAngles(fx,fy,fz,tx,ty,tz){const dx=tx-fx,dz=tz-fz;return{yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(ty-fy,Math.hypot(dx,dz))}}
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function glideTo(x,z,yaw,pitch,dur=1500){let d=((yaw-S.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;vx=vz=0;
  gl={t0:performance.now(),dur:reduce?1:dur,f:{...S},t:{x,z,yaw:S.yaw+d,pitch}}}
const toCafe=()=>{const a=lookAngles(2.0,EYE,-3.1,3.2,.85,-4.4);glideTo(2.0,-3.1,a.yaw,a.pitch)};
const toHall=()=>glideTo(0,-13.6,0,0,1800);

/* look: drag (mouse and touch) */
let drag=null;const ray=new THREE.Raycaster(),pt=new THREE.Vector2(),pill=$('#pill');
const pick=e=>{pt.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(pt,cam);ray.far=9;const h=ray.intersectObjects(interact,false);return h.length?h[0].object:null};
host.addEventListener('pointerdown',e=>{if(open())return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};host.setPointerCapture(e.pointerId)});
host.addEventListener('pointermove',e=>{
  if(drag&&drag.id===e.pointerId){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)>5){drag.moved=true;host.classList.add('drag');pill.style.opacity=0}
    if(drag.moved&&!gl){const k=e.pointerType==='touch'?.0048:.0032;S.yaw+=(e.clientX-(drag.px??drag.x))*k;S.pitch=Math.max(-1.2,Math.min(1.2,S.pitch+(e.clientY-(drag.py??drag.y))*k))}
    drag.px=e.clientX;drag.py=e.clientY;return}
  if(open()||coarse)return;const o=pick(e);host.classList.toggle('over',!!o);
  if(o){pill.textContent=o.userData.menu?'OPEN THE MENU':'VIEW PHOTO';pill.style.left=e.clientX+'px';pill.style.top=e.clientY+'px';pill.style.opacity=1}else pill.style.opacity=0});
host.addEventListener('pointerup',e=>{host.classList.remove('drag');const d=drag;drag=null;if(!d||d.moved||open())return;const o=pick(e);if(!o)return;if(o.userData.menu)openMenu();else openView(o.userData.photo)});
host.addEventListener('pointercancel',()=>{drag=null;host.classList.remove('drag')});

/* ---------- menu, viewer, prompt ---------- */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ALL=[];
function buildMenu(){const g=$('#mgrid');
  if(!ALL.length){g.innerHTML='<p class="empty">The kitchen is quiet right now. Photographs are on their way.</p>';return}
  $('#msub').textContent=`${ALL.length} photograph${ALL.length===1?'':'s'}, served fresh.`;
  g.innerHTML=ALL.map((p,i)=>`<a class="mi" data-i="${i}" tabindex="0" role="button" aria-label="View ${esc(p.title)}"><div class="im" style="background-image:url('${esc(p.thumb||p.src)}')"></div><b>${esc(p.title)}</b><i>Nathan Lloyd</i><em>${esc([p.year,p.cap].filter(Boolean).join(' · '))}</em></a>`).join('');
  g.querySelectorAll('.mi').forEach(c=>{const go=()=>openView(ALL[c.dataset.i]);c.onclick=go;c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}})}
function openMenu(){pill.style.opacity=0;$('#menu').classList.add('on');$('#mx').focus()}
function closeMenu(){$('#menu').classList.remove('on')}
function openView(p){const v=$('#view'),im=v.querySelector('img');im.src=p.src;im.alt=p.title;
  v.querySelector('p').innerHTML=`${esc(p.title)}<i>${esc([p.year,p.cap].filter(Boolean).join(' · '))}</i>${p.desc?`<small>${esc(p.desc)}</small>`:''}`;pill.style.opacity=0;v.classList.add('on');v.querySelector('.x').focus()}
function closeView(){$('#view').classList.remove('on')}
$('#mx').onclick=closeMenu;$('#view .x').onclick=closeView;$('#view').onclick=e=>{if(e.target.tagName!=='IMG'&&!e.target.closest('p'))closeView()};
function closePrompt(){$('#prompt').classList.remove('on')}
$('#goCafe').onclick=()=>{closePrompt();toCafe()};$('#goWander').onclick=closePrompt;
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(!g)return;const k=g.dataset.go;closeView();if(k==='menu')openMenu();else{closeMenu();closePrompt();k==='cafe'?toCafe():toHall()}});
if(coarse)$('#hint').textContent='Left stick to walk · Drag to look · Tap art or the menu';

/* ---------- loop ---------- */
let last=performance.now(),tagObj=null,t0=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;
  if(gl){const t=Math.min(1,(now-gl.t0)/gl.dur),k=ease(t);S.x=gl.f.x+(gl.t.x-gl.f.x)*k;S.z=gl.f.z+(gl.t.z-gl.f.z)*k;S.yaw=gl.f.yaw+(gl.t.yaw-gl.f.yaw)*k;S.pitch=gl.f.pitch+(gl.t.pitch-gl.f.pitch)*k;if(t>=1)gl=null}
  else if(!open()){
    let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-stick.y,r=(keys.KeyD?1:0)-(keys.KeyA?1:0)+stick.x;
    if(keys.ArrowLeft)S.yaw+=1.8*dt;if(keys.ArrowRight)S.yaw-=1.8*dt;
    const m=Math.hypot(f,r);if(m>1){f/=m;r/=m}
    const sp=(keys.ShiftLeft||keys.ShiftRight?5.6:3.2),sn=Math.sin(S.yaw),cs=Math.cos(S.yaw);
    const tx=(-sn*f+cs*r)*sp,tz=(-cs*f-sn*r)*sp,a=Math.min(1,dt*9);vx+=(tx-vx)*a;vz+=(tz-vz)*a;
    const nx=S.x+vx*dt,nz=S.z+vz*dt;if(free(nx,S.z))S.x=nx;else vx=0;if(free(S.x,nz))S.z=nz;else vz=0}
  const bob=Math.sin(now/130)*.012*Math.min(1,Math.hypot(vx,vz)/3);
  cam.position.set(S.x,EYE+bob,S.z);cam.rotation.set(S.pitch,S.yaw,0);
  if(tagObj){const s=Math.sin((now-t0)/450);tagObj.tag.position.y=1.55+s*.04;tagObj.halo.material.opacity=.4+.2*s}
  renderer.render(scene,cam)}
cam.position.set(S.x,EYE,S.z);requestAnimationFrame(frame);

/* ---------- boot ---------- */
(async()=>{
  const fontsP=Promise.all([document.fonts.load('600 60px Oswald'),document.fonts.load('italic 400 52px Newsreader'),document.fonts.load('400 28px "DM Mono"'),document.fonts.ready]).catch(()=>{});
  ALL=await getPhotos();
  let W=(await Promise.all(ALL.slice(0,WALL).map(loadImg))).filter(Boolean);
  if(!W.length)W=placeholders();
  await fontsP;
  // order matters: the hall length is needed by collision, so build the hall first
  buildHall(W);tagObj=buildCafe();buildMenu();
  $('#veil').style.opacity=0;setTimeout(()=>$('#veil').remove(),1000);
  setTimeout(()=>{$('#prompt').classList.add('on');$('#goCafe').focus()},reduce?0:1100);
})();
