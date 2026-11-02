(()=>{
'use strict';
/* ---- Supabase (public, read-only). Publishable key only. ---- */
const SB={url:'https://etjlhaohtdyzhcftqmzb.supabase.co',key:'sb_publishable_RpQWqQrMEqd_YFqC3Q3CrQ_Y64nITot',table:'photos',bucket:'photos'};
const H={apikey:SB.key,Authorization:'Bearer '+SB.key};
const $=(s,r=document)=>r.querySelector(s);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const str=v=>typeof v==='string'&&v.trim()?v.trim():'';
const num=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:0};
const pub=p=>/^https?:\/\//i.test(p)?p:`${SB.url}/storage/v1/object/public/${SB.bucket}/${String(p).split('/').map(encodeURIComponent).join('/')}`;
async function get(url,o={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);
 try{return await fetch(url,{...o,headers:{...H,...(o.headers||{})},signal:c.signal})}finally{clearTimeout(t)}}
function norm(r,i){
 const src=str(r.image_url)||str(r.url)||str(r.src)||str(r.path)||str(r.image);if(!src)return null;
 const title=str(r.title);
 return{id:r.id??i,title,cat:str(r.category)||'Other',desc:str(r.description),date:str(r.date),
  src:pub(src),thumb:str(r.thumb_url)?pub(str(r.thumb_url)):'',w:num(r.width),h:num(r.height),
  alt:str(r.alt_text)||str(r.alt)||title||`Photograph ${i+1}`,featured:r.featured===true,
  order:r.sort_order==null||r.sort_order===''?Infinity:Number(r.sort_order),idx:i};
}
async function loadPhotos(){
 let rows=null;
 try{let r=await get(`${SB.url}/rest/v1/${SB.table}?select=*&order=sort_order.asc.nullslast,id.asc`);
  if(r.status===400)r=await get(`${SB.url}/rest/v1/${SB.table}?select=*`);   /* sort_order column not added yet */
  if(r.ok)rows=await r.json();}catch(e){}
 let list=Array.isArray(rows)?rows.map(norm).filter(Boolean):[];
 if(!list.length){                                                            /* Storage fallback */
  const r=await get(`${SB.url}/storage/v1/object/list/${SB.bucket}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:'',limit:200,offset:0,sortBy:{column:'name',order:'asc'}})});
  if(!r.ok)throw new Error('storage '+r.status);
  const f=await r.json();
  list=f.filter(o=>o.id&&/\.(jpe?g|png|webp|avif)$/i.test(o.name)).map((o,i)=>norm({id:o.id,path:o.name,category:'Gallery'},i)).filter(Boolean);
 }
 return list.sort((a,b)=>(a.order-b.order)||(a.idx-b.idx));
}
const dataP=loadPhotos().then(v=>({ok:true,v}),e=>({ok:false,e}));

document.addEventListener('DOMContentLoaded',async()=>{
const hasGsap=!!(window.gsap&&window.ScrollTrigger)&&!reduce;
if(hasGsap)gsap.registerPlugin(ScrollTrigger);
let PHOTOS=[],view=[],cat='All',ctx=null,showAll=false,rand=[];const SHOW=5;
const grid=$('#grid'),main=$('main'),foot=$('footer'),nav=$('#nav');
$('#yr').textContent='© '+new Date().getFullYear();
const inertOn=(on,...els)=>els.forEach(e=>{if(e)e.inert=on});

/* intro animation (content is visible by default; this only adds motion) */
if(hasGsap){gsap.from('.ln>span',{yPercent:110,duration:.9,stagger:.12,ease:'expo.out'});gsap.from('.tag,.intro p.d',{opacity:0,y:10,duration:.7,delay:.35,stagger:.12})}

/* photograph frame: reserves space from stored width/height, learns it from the image if missing */
const orient=p=>{const r=p.w&&p.h?p.w/p.h:1.5;return r>1.15?'l':r<.9?'p':'s'};
function frame(p,eager){
 const f=document.createElement('span');f.className='ph';f.style.setProperty('--r',(p.w&&p.h?p.w/p.h:1.5).toFixed(4));
 const i=new Image();i.alt=p.alt;i.decoding='async';if(eager)i.fetchPriority='high';else i.loading='lazy';
 if(p.w&&p.h){i.width=p.w;i.height=p.h}
 const ok=()=>{if(!(p.w&&p.h)&&i.naturalWidth){p.w=i.naturalWidth;p.h=i.naturalHeight;f.style.setProperty('--r',(p.w/p.h).toFixed(4))}i.classList.add('ok')};
 i.onload=ok;i.onerror=()=>f.classList.add('bad');
 i.src=p.thumb||p.src;f.appendChild(i);if(i.complete&&i.naturalWidth)ok();return f;
}
function item(p,list,i,cls,eager){
 const b=document.createElement('button');b.type='button';b.className='it '+cls;
 b.setAttribute('aria-label',p.title?`View photograph: ${p.title}`:`View photograph ${i+1} of ${list.length}`);
 b.appendChild(frame(p,eager));b.addEventListener('click',()=>openV(list,i,b));return b;
}
function message(host,text,retry){
 host.replaceChildren();const d=document.createElement('div');d.className='state';d.setAttribute('role',retry?'alert':'status');
 const p=document.createElement('p');p.textContent=text;d.appendChild(p);
 if(retry){const b=document.createElement('button');b.type='button';b.textContent='Try again';b.onclick=()=>location.reload();d.appendChild(b)}
 host.appendChild(d);host.setAttribute('aria-busy','false');
}

/* gallery */
$('#more').onclick=()=>{showAll=!showAll;const go=()=>{renderGrid();if(!showAll)$('#portfolio').scrollIntoView({behavior:reduce?'auto':'smooth'})};if(reduce)go();else{grid.classList.add('swap');setTimeout(go,200)}};
function renderGrid(){
 ctx&&ctx.revert();grid.replaceChildren();
 const all=PHOTOS.filter(p=>cat==='All'||p.cat===cat);
 view=showAll?all:rand.filter(p=>all.includes(p)).slice(0,SHOW);   /* 5 random, or everything in curated order */
 view.forEach((p,i)=>grid.appendChild(item(p,view,i,orient(p),false)));
 const mb=$('#more');mb.hidden=all.length<=SHOW;mb.textContent=showAll?'Show fewer':`Show all ${all.length} photographs`;mb.setAttribute('aria-expanded',showAll);
 $('#cnt').textContent=showAll||all.length<=SHOW?`${all.length} photograph${all.length===1?'':'s'}`:`Showing ${view.length} of ${all.length}`;
 grid.classList.remove('swap');grid.setAttribute('aria-busy','false');
 if(!hasGsap)return;
 ctx=gsap.context(()=>{
  gsap.set('.grid .it',{opacity:0,y:28});
  ScrollTrigger.batch('.grid .it',{start:'top 94%',once:true,onEnter:els=>gsap.to(els,{opacity:1,y:0,duration:.8,stagger:.08,ease:'power3.out',overwrite:true})});
  gsap.utils.toArray('.grid .it.l:nth-child(3n+1) .ph img').forEach(im=>gsap.fromTo(im,{yPercent:-4,scale:1.08},{yPercent:4,ease:'none',scrollTrigger:{trigger:im.parentElement,scrub:true}}));
 },grid);
 requestAnimationFrame(()=>ScrollTrigger.refresh());
}
function buildFilters(){
 const fb=$('#filters');fb.replaceChildren();
 ['All',...new Set(PHOTOS.map(p=>p.cat))].forEach(c=>{
  const b=document.createElement('button');b.type='button';b.textContent=c;b.setAttribute('aria-pressed',c===cat);
  b.onclick=()=>{if(c===cat)return;cat=c;fb.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));
   if(reduce){renderGrid();return}grid.classList.add('swap');setTimeout(renderGrid,200)};
  fb.appendChild(b)});
 fb.hidden=PHOTOS.length<2||new Set(PHOTOS.map(p=>p.cat)).size<2;
}
/* featured (native scroll, no pinning) */
function buildFeatured(){
 const fl=PHOTOS.filter(p=>p.featured),sec=$('#featured'),row=$('#row');
 if(!fl.length){sec.hidden=true;return}
 sec.hidden=false;row.replaceChildren();fl.forEach((p,i)=>row.appendChild(item(p,fl,i,'',false)));
 const bar=$('#fb'),upd=()=>{const m=row.scrollWidth-row.clientWidth;bar.style.transform=`scaleX(${m>0?Math.max(.08,row.scrollLeft/m):1})`};
 row.onscroll=upd;upd();
 const step=d=>row.scrollBy({left:d*Math.max(280,row.clientWidth*.7),behavior:reduce?'auto':'smooth'});
 $('#fp').onclick=()=>step(-1);$('#fn').onclick=()=>step(1);
}
function buildLead(){
 const p=PHOTOS.find(x=>x.featured)||PHOTOS[0],host=$('#lead');if(!p)return;
 const list=PHOTOS,i=list.indexOf(p),b=item(p,list,i,'',true);
 const vf=document.createElement('span');vf.className='vf';vf.setAttribute('aria-hidden','true');
 host.replaceChildren(b,vf);host.style.setProperty('--r',(p.w&&p.h?p.w/p.h:1.5).toFixed(4));
 if(hasGsap)gsap.fromTo(b,{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0 0 0% 0)',duration:1.1,ease:'expo.out'});
}
const res=await dataP;
if(!res.ok){message(grid,'The photographs couldn’t be loaded right now. Check your connection and try again.',true);$('#lead').replaceChildren();$('#lead').style.display='none'}
else if(!res.v.length){message(grid,'Photographs are on their way. Check back soon.');$('#lead').style.display='none'}
else{PHOTOS=res.v;rand=[...PHOTOS];for(let i=rand.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rand[i],rand[j]]=[rand[j],rand[i]]}buildLead();buildFilters();renderGrid();buildFeatured()}
if(hasGsap){gsap.fromTo('#ptr',{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0 0 0% 0)',duration:1.2,ease:'expo.out',scrollTrigger:{trigger:'#ptr',start:'top 80%',once:true}})}

/* viewer */
const vw=$('#vw'),vi=$('#vi'),vl=$('#vl'),ve=$('#ve');
let vlist=[],vidx=0,vtrig=null,tok=0;
const seen=new Set();
function show(i){
 vidx=(i+vlist.length)%vlist.length;const p=vlist[vidx];const t=++tok;
 vi.classList.remove('ok');ve.hidden=true;vl.hidden=false;vi.alt=p.alt;
 $('#vt').textContent=p.title;$('#vt').hidden=!p.title;
 $('#vc').textContent=[p.cat,p.date].filter(Boolean).join(' · ');
 $('#vd').textContent=p.desc;$('#vd').hidden=!p.desc;$('#vn').textContent=`${vidx+1} / ${vlist.length}`;
 vi.onload=()=>{if(t!==tok)return;vi.classList.add('ok');vl.hidden=true};
 vi.onerror=()=>{if(t!==tok)return;vl.hidden=true;ve.hidden=false};
 vi.src=p.src;
 const nx=vlist[(vidx+1)%vlist.length];if(nx&&!seen.has(nx.src)){seen.add(nx.src);setTimeout(()=>{if(t===tok)new Image().src=nx.src},600)}
}
function openV(list,i,trig){vlist=list;vtrig=trig;show(i);vw.classList.add('open');document.body.classList.add('lock');inertOn(true,main,foot,nav);$('#vx').focus()}
function closeV(){vw.classList.remove('open');document.body.classList.remove('lock');inertOn(false,main,foot,nav);tok++;vtrig&&vtrig.focus()}
$('#vx').onclick=closeV;$('#vp').onclick=()=>show(vidx-1);$('#vnx').onclick=()=>show(vidx+1);
$('#stage').addEventListener('click',e=>{if(e.target===$('#stage'))closeV()});
let tx=0,ty=0;
vw.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY},{passive:true});
vw.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)show(vidx+(dx<0?1:-1))});

/* menu */
const burger=$('#burger'),menu=$('#menu'),scrim=$('#scrim');
function setMenu(o){burger.setAttribute('aria-expanded',o);burger.textContent=o?'Close':'Menu';menu.classList.toggle('open',o);scrim.classList.toggle('open',o);document.body.classList.toggle('lock',o);inertOn(o,main,foot);if(o)menu.querySelector('a').focus()}
burger.onclick=()=>setMenu(burger.getAttribute('aria-expanded')!=='true');scrim.onclick=()=>setMenu(false);
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));

document.addEventListener('keydown',e=>{
 if(vw.classList.contains('open')){
  if(e.key==='Escape')closeV();else if(e.key==='ArrowRight')show(vidx+1);else if(e.key==='ArrowLeft')show(vidx-1);
  else if(e.key==='Tab'){const f=[$('#vx'),$('#vp'),$('#vnx')],i=f.indexOf(document.activeElement);e.preventDefault();f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus()}
 }else if(e.key==='Escape'&&burger.getAttribute('aria-expanded')==='true'){setMenu(false);burger.focus()}
});

/* nav state + active section */
const onS=()=>nav.classList.toggle('solid',scrollY>40);onS();addEventListener('scroll',onS,{passive:true});
const links=[...document.querySelectorAll('.links a[href^="#"]')];
if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)links.forEach(a=>a.toggleAttribute('aria-current',a.getAttribute('href')==='#'+e.target.id)&&a.setAttribute('aria-current','true'))}),{rootMargin:'-45% 0px -50% 0px'});
 ['portfolio','about','contact'].forEach(id=>io.observe(document.getElementById(id)))}

/* contact form */
const f=$('#cf'),st=$('#fs'),sb=$('#sb');
const bad=(id,msg)=>{const el=$('#'+id);el.setAttribute('aria-invalid','true');$('#e-'+id.slice(2)).textContent=msg;return el};
f.addEventListener('submit',async e=>{
 e.preventDefault();st.textContent='';
 f.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));f.querySelectorAll('.err').forEach(x=>x.textContent='');
 const bads=[];
 if(!$('#f-n').value.trim())bads.push(bad('f-n','Please add your name.'));
 if(!$('#f-e').value.trim()||!$('#f-e').checkValidity())bads.push(bad('f-e','Please enter a valid email address.'));
 if($('#f-m').value.trim().length<5)bads.push(bad('f-m','Please write a short message.'));
 if(bads.length){bads[0].focus();return}
 sb.disabled=true;st.style.color='var(--tx2)';st.textContent='Sending…';
 try{const r=await fetch(f.action,{method:'POST',body:new FormData(f),headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error('http '+r.status);
  f.reset();st.style.color='var(--tx)';st.textContent='Thanks, your message has been sent.';
 }catch(err){st.style.color='var(--pink)';st.textContent='Your message didn’t send. Please try again, or email nathanjlloyd123@gmail.com.'}
 sb.disabled=false;
});
});
})();
