import * as THREE from 'three';

/* ---------- Supabase (public, read-only, publishable key only) ---------- */
const SB={url:'https://etjlhaohtdyzhcftqmzb.supabase.co',key:'sb_publishable_RpQWqQrMEqd_YFqC3Q3CrQ_Y64nITot',table:'photos',bucket:'photos'};
const MAX=24; // photos placed in the 3D room (the List shows the same set)
const H={apikey:SB.key,Authorization:'Bearer '+SB.key};
const str=v=>typeof v==='string'&&v.trim()?v.trim():'';
const num=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:0};
const pub=p=>/^https?:\/\//i.test(p)?p:`${SB.url}/storage/v1/object/public/${SB.bucket}/${String(p).split('/').map(encodeURIComponent).join('/')}`;
async function get(url,o={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);
  try{return await fetch(url,{...o,headers:{...H,...(o.headers||{})},signal:c.signal})}finally{clearTimeout(t)}}
function norm(r,i){
  const src=str(r.image_url)||str(r.url)||str(r.src)||str(r.path)||str(r.image);if(!src)return null;
  const cat=str(r.category)||'';const date=str(r.date);
  return{title:str(r.title)||'Untitled',cap:cat,desc:str(r.description),year:date.slice(0,4),src:pub(src),
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
  // featured photos first, then curated order
  return list.sort((a,b)=>(b.featured-a.featured)||(a.order-b.order)||(a.idx-b.idx));
}
function loadImg(p){return new Promise(res=>{const im=new Image();im.crossOrigin='anonymous';
  im.onload=()=>{const s=Math.min(1,1600/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);res({...p,canvas:c,ar:c.width/c.height})};
  im.onerror=()=>res(null);im.src=p.src})}
function placeholders(){const cols=[['#FBE46D','#F7D2D1'],['#F7D2D1','#C9D8F0'],['#C9D8F0','#FFF1C2'],['#FCEB93','#F5C6A5'],['#F6EAD8','#F7D2D1'],['#D9E8C8','#FBE46D'],['#F5C6A5','#C9D8F0'],['#FFF1C2','#F7D2D1'],['#C9D8F0','#F6EAD8']];
  return cols.map((c,i)=>{const cv=document.createElement('canvas');cv.width=900;cv.height=i%2?1200:600;const x=cv.getContext('2d'),g=x.createLinearGradient(0,0,cv.width,cv.height);g.addColorStop(0,c[0]);g.addColorStop(1,c[1]);x.fillStyle=g;x.fillRect(0,0,cv.width,cv.height);
    x.fillStyle='rgba(58,53,80,.55)';x.font='500 34px "DM Mono",monospace';x.textAlign='center';x.fillText('PHOTOS COULDN’T LOAD',cv.width/2,cv.height/2);
    return{canvas:cv,ar:cv.width/cv.height,title:'Photo '+(i+1),cap:'',desc:'',year:'',src:cv.toDataURL('image/jpeg',.8)}})}

/* ---------- setup ---------- */
const small=matchMedia('(max-width:819px),(orientation:portrait) and (max-width:1100px),(orientation:landscape) and (max-height:500px)');
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const $=s=>document.querySelector(s);
const TAU=Math.PI*2,STEP=TAU/36,R=18,RIN=12.2,H_=6.2,PY=1.95,FW=1.5,FH=1.9;
const D=small.matches?0.14+0.9*STEP:0.14;
const host=$('#gallery');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
host.prepend(renderer.domElement);renderer.domElement.style.transition='opacity .3s';
const scene=new THREE.Scene();scene.background=new THREE.Color(0xFFF9EC);scene.fog=new THREE.Fog(0xFFF9EC,10,46);
const cam=new THREE.PerspectiveCamera(56,1,.05,100);
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);cam.aspect=w/h;cam.fov=w>=h?56:70;cam.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
const aniso=renderer.capabilities.getMaxAnisotropy();
const tex=c=>{const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=aniso;return t};
const grad=stops=>{const c=document.createElement('canvas');c.width=4;c.height=256;const x=c.getContext('2d'),g=x.createLinearGradient(0,256,0,0);stops.forEach(s=>g.addColorStop(s[0],s[1]));x.fillStyle=g;x.fillRect(0,0,4,256);return tex(c)};
const radial=(col,a,stop)=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),g=x.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,col.replace('A',a));g.addColorStop(stop,col.replace('A',a));g.addColorStop(1,col.replace('A',0));x.fillStyle=g;x.fillRect(0,0,256,256);return tex(c)};
const B=o=>new THREE.MeshBasicMaterial(o);

function room(){
  const ow=new THREE.Mesh(new THREE.CylinderGeometry(R,R,H_,160,1,true),B({map:grad([[0,'#F5EBD8'],[.2,'#FBF3E3'],[.6,'#FBF3E3'],[.86,'#F8EDD9'],[1,'#EFDFC4']]),side:THREE.BackSide}));ow.position.y=H_/2;scene.add(ow);
  const ip=new THREE.Mesh(new THREE.CylinderGeometry(RIN,RIN,H_,120,1,true),B({map:grad([[0,'#F7EEDD'],[.3,'#FFFAF0'],[.8,'#FDF5E6'],[1,'#F1E1C6']])}));ip.position.y=H_/2;scene.add(ip);
  const fc=document.createElement('canvas');fc.width=fc.height=1024;const fx=fc.getContext('2d'),fg=fx.createRadialGradient(512,512,512*RIN/R,512,512,512);fg.addColorStop(0,'#EDD6B0');fg.addColorStop(.55,'#F3E1C3');fg.addColorStop(1,'#EFDAB8');fx.fillStyle=fg;fx.fillRect(0,0,1024,1024);
  const fl=new THREE.Mesh(new THREE.CircleGeometry(R,160),B({map:tex(fc)}));fl.rotation.x=-Math.PI/2;scene.add(fl);
  const ce=new THREE.Mesh(new THREE.CircleGeometry(R,160),B({color:0xFAF1E0,side:THREE.BackSide}));ce.rotation.x=-Math.PI/2;ce.position.y=H_;scene.add(ce);
}
function labelTex(p){const c=document.createElement('canvas');c.width=640;c.height=260;const x=c.getContext('2d');x.fillStyle='#3A3550';
  x.font='500 58px Newsreader,Georgia,serif';x.fillText('Nathan Lloyd',30,82);
  x.font='italic 400 54px Newsreader,Georgia,serif';let t=p.title;while(x.measureText(t).width>580&&t.length>4)t=t.slice(0,-2);if(t!==p.title)t+='…';x.fillText(t,30,150);
  x.globalAlpha=.7;x.font='400 30px "DM Mono",monospace';x.fillText(((p.year?p.year+' · ':'')+(p.cap||'PHOTOGRAPH')).toUpperCase().slice(0,28),30,215);return tex(c)}

const pickable=[];let P=[],haloT,shT;
function addPrint(p,tx,lb,ang,rad,outward,idx){
  const g=new THREE.Group();g.position.set(rad*Math.cos(ang),0,rad*Math.sin(ang));
  if(outward)g.lookAt(g.position.x*2,0,g.position.z*2);else g.lookAt(0,0,0);
  const PW=FW,PH=FH;
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(2.1*PW,1.75*PH),B({map:haloT,transparent:true,depthWrite:false}));halo.position.set(0,PY+.05,.005);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(1.25*PW,1.18*PH),B({map:shT,transparent:true,depthWrite:false}));sh.position.set(.05,PY-.06,.01);
  const fr=new THREE.Mesh(new THREE.BoxGeometry(PW+.07,PH+.07,.06),B({color:0xD3AA72}));fr.position.set(0,PY,.045);
  const mat=new THREE.Mesh(new THREE.PlaneGeometry(PW-.08,PH-.08),B({color:0xF6EAD8}));mat.position.set(0,PY,.076);
  const mw=1.28,mh=1.68,w=p.ar>mw/mh?mw:mh*p.ar,h=p.ar>mw/mh?mw/p.ar:mh;
  const pr=new THREE.Mesh(new THREE.PlaneGeometry(w,h),B({map:tx}));pr.position.set(0,PY,.079);pr.userData={idx,ang,out:outward};
  const lab=new THREE.Mesh(new THREE.PlaneGeometry(.92,.92*260/640),B({map:lb,transparent:true,depthWrite:false}));lab.position.set(-PW/2+.46,PY-PH/2-.42,.02);
  g.add(halo,sh,fr,mat,pr,lab);scene.add(g);pickable.push(pr)}
function build(){
  haloT=radial('rgba(255,255,255,A)',.95,.35);shT=radial('rgba(120,90,50,A)',.28,.25);
  const T=P.map(p=>tex(p.canvas)),L=P.map(labelTex),n=P.length;
  for(let s=0;s<36;s++){const i=s%n;addPrint(P[i],T[i],L[i],s*STEP,17.98,false,i)}
  for(let k=0;k<24;k++){const i=(k+4)%n;addPrint(P[i],T[i],L[i],(k+.5)*TAU/24,12.22,true,i)}
}

/* ---------- camera ---------- */
const portrait=()=>small.matches&&innerHeight>innerWidth;
const walkPose=th=>portrait()?{th,r:15.4,yaw:-.42,y:1.9,pitch:-.1}:{th,r:15.6,yaw:-.3,y:1.92,pitch:-.12};
const focusPose=(th,out)=>{const sm=portrait(),o=sm?5.2:4.26,y=PY-(sm?1.05:.52);return out?{th,r:R-o,yaw:Math.PI/2,y,pitch:0}:{th,r:RIN+o,yaw:-Math.PI/2,y,pitch:0}};
function setCam(p){const T=[Math.sin(p.th),-Math.cos(p.th)],N=[Math.cos(p.th),Math.sin(p.th)],c=Math.cos(p.yaw),s=Math.sin(p.yaw);
  const x=p.r*Math.cos(p.th),z=p.r*Math.sin(p.th);cam.position.set(x,p.y,z);cam.lookAt(x+c*T[0]+s*N[0],p.y+p.pitch,z+c*T[1]+s*N[1])}
let th=D,target=D,focus=null,glide=null,intro=null,cur=walkPose(D);
const e4=t=>1-Math.pow(1-t,4),e3=t=>1-Math.pow(1-t,3),e2=t=>1-(1-t)*(1-t);
const pill=$('#pill');
function startGlide(to){glide={t0:performance.now(),from:{...cur},to,dur:reduce?1:950}}
function focusOn(m){const a=m.userData.ang,t=a+TAU*Math.round((th-a)/TAU);focus=m;startGlide(focusPose(t,m.userData.out===false));$('#h1').textContent='Click the photo to open it';$('#h2').textContent='Esc or click away to step back'}
function stepBack(){if(!focus)return;focus=null;const t=cur.th+D;target=t;startGlide(walkPose(t));$('#h1').textContent='Scroll or drag to walk round';$('#h2').textContent='Click a photo to look closer';pill.style.opacity=0}
function snap(d){if(focus){stepBack();return}target=(Math.round((target-D)/STEP)-d)*STEP+D}

/* ---------- input ---------- */
let drag=null;const ray=new THREE.Raycaster(),pt=new THREE.Vector2();
const pageOpen=()=>$('#list').classList.contains('on')||$('#view').classList.contains('on');
const hit=e=>{pt.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(pt,cam);const h=ray.intersectObjects(pickable,false);return h.length?h[0].object:null};
host.addEventListener('wheel',e=>{e.preventDefault();if(pageOpen())return;if(focus){stepBack();return}target+=-(e.deltaY*(e.deltaMode===1?33:1))*.0016},{passive:false});
host.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,t:target,moved:false};host.setPointerCapture(e.pointerId)});
host.addEventListener('pointermove',e=>{
  if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)>6){drag.moved=true;host.classList.add('drag');if(focus)stepBack()}
    if(drag.moved&&!focus)target=drag.t+(Math.abs(dx)>Math.abs(dy)?dx:dy)*(small.matches?.0042:.0022);return}
  const m=hit(e);host.classList.toggle('over',!!m);
  if(focus&&m===focus&&!small.matches){pill.style.left=e.clientX+'px';pill.style.top=e.clientY+'px';pill.style.opacity=1}else if(!small.matches)pill.style.opacity=0});
host.addEventListener('pointerup',e=>{host.classList.remove('drag');const d=drag;drag=null;if(!d||d.moved)return;
  const m=hit(e);if(!m){stepBack();return}
  if(focus===m){openView(P[m.userData.idx]);return}focusOn(m)});
addEventListener('keydown',e=>{
  if(e.key==='Escape'){if($('#view').classList.contains('on'))closeView();else if($('#list').classList.contains('on'))toGallery();else stepBack()}
  else if(pageOpen())return;else if(e.key==='ArrowRight'||e.key==='ArrowDown')snap(1);else if(e.key==='ArrowLeft'||e.key==='ArrowUp')snap(-1)});
$('#next').onclick=()=>snap(1);$('#prev').onclick=()=>snap(-1);

/* ---------- list, viewer, nav ---------- */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fillList(){$('#grid').innerHTML=P.map((p,i)=>`<div class="card" data-i="${i}"><div class="im" style="background-image:url('${esc(p.thumb||p.src)}')"></div><b>${esc(p.title)}</b><i>Nathan Lloyd</i><em>${esc([p.year,p.cap].filter(Boolean).join(' · '))}</em></div>`).join('');
  document.querySelectorAll('.card').forEach(c=>c.onclick=()=>openView(P[c.dataset.i]))}
function openView(p){const v=$('#view');v.querySelector('img').src=p.src;v.querySelector('img').alt=p.title;
  v.querySelector('p').innerHTML=`${esc(p.title)}<i>${esc([p.year,p.cap].filter(Boolean).join(' · '))}</i>${p.desc?`<small>${esc(p.desc)}</small>`:''}`;v.classList.add('on')}
function closeView(){$('#view').classList.remove('on')}
$('#view').onclick=e=>{if(e.target.tagName!=='IMG')closeView()};
function setToggle(l){document.querySelectorAll('.toggle button').forEach(b=>b.classList.toggle('on',(b.dataset.go==='list')===l))}
function toList(){closeView();stepBack();$('#list').classList.add('on');$('#gui').classList.add('off');$('.nav').classList.add('solid');renderer.domElement.style.opacity=0;setToggle(true)}
function toGallery(){closeView();const was=$('#list').classList.contains('on');$('#list').classList.remove('on');$('#gui').classList.remove('off');$('.nav').classList.remove('solid');renderer.domElement.style.opacity=1;setToggle(false);
  if(was&&pickable.length){let best=null,bd=1e9;pickable.forEach(m=>{if(m.userData.out)return;const d=Math.abs(m.userData.ang-th-TAU*Math.round((m.userData.ang-th)/TAU));if(d<bd){bd=d;best=m}});if(best)focusOn(best)}else stepBack()}
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(!g)return;e.preventDefault();g.dataset.go==='list'?toList():toGallery()});

/* ---------- loop ---------- */
let last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;
  if(glide){const t=Math.min(1,(now-glide.t0)/glide.dur),a=glide.from,b=glide.to;
    cur={th:a.th+(b.th-a.th)*e4(t),yaw:a.yaw+(b.yaw-a.yaw)*e2(t),r:a.r+(b.r-a.r)*e3(t),y:a.y+(b.y-a.y)*e3(t),pitch:a.pitch+(b.pitch-a.pitch)*e3(t)};
    if(t>=1){glide=null;th=cur.th}}
  else if(!focus){th+=(target-th)*(reduce?1:1-Math.exp(-dt/.36));cur=walkPose(th)}
  let p=cur;if(intro){const t=Math.min(1,(now-intro)/1400),k=t>=1?1:1-Math.pow(2,-10*t);p={...cur,th:cur.th+.16*(1-k),r:cur.r-.35*(1-k)};if(t>=1)intro=null}
  setCam(p);renderer.render(scene,cam)}
setCam(cur);requestAnimationFrame(frame);

/* ---------- boot ---------- */
(async()=>{
  const fontsP=Promise.all([document.fonts.load('500 58px Newsreader'),document.fonts.load('italic 400 54px Newsreader'),document.fonts.load('400 30px "DM Mono"'),document.fonts.ready]).catch(()=>{});
  const list=(await getPhotos()).slice(0,MAX);
  let loaded=(await Promise.all(list.map(loadImg))).filter(Boolean);
  if(!loaded.length)loaded=placeholders();
  P=loaded;await fontsP;room();build();fillList();
  const o=(el,kf,d,dur,ease)=>el.animate(kf,{delay:d,duration:reduce?0:dur,easing:ease,fill:'backwards'});
  o($('#veil'),[{opacity:1},{opacity:0}],0,900,'ease-out').onfinish=()=>$('#veil').remove();
  intro=performance.now();
  const rise=[...document.querySelectorAll('.m>span')];
  rise.forEach((el,i)=>o(el,[{transform:'translateY(105%)'},{transform:'none'}],250+i*60,1000,'cubic-bezier(.2,.7,.2,1)'));
  [...$('.nav').children].forEach((el,i)=>o(el,[{opacity:0},{opacity:1}],250+(rise.length+i)*60,1000,'cubic-bezier(.2,.7,.2,1)'));
})();
