import * as THREE from 'three';

/* ---------- Supabase: public, read-only photography source ---------- */
const SB = {
  url: 'https://etjlhaohtdyzhcftqmzb.supabase.co',
  key: 'sb_publishable_RpQWqQrMEqd_YFqC3Q3CrQ_Y64nITot',
  table: 'photos',
  bucket: 'photos'
};
const HD = { apikey: SB.key, Authorization: `Bearer ${SB.key}` };
const str = value => typeof value === 'string' && value.trim() ? value.trim() : '';
const pub = path => /^https?:\/\//i.test(path)
  ? path
  : `${SB.url}/storage/v1/object/public/${SB.bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}`;

async function get(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(url, {
      ...options,
      headers: { ...HD, ...(options.headers || {}) },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalisePhoto(row, index) {
  const source = str(row.image_url) || str(row.url) || str(row.src) || str(row.path) || str(row.image);
  if (!source) return null;
  const date = str(row.date);
  return {
    title: str(row.title) || `Photograph ${index + 1}`,
    cap: str(row.category),
    desc: str(row.description),
    year: date.slice(0, 4),
    src: pub(source),
    thumb: str(row.thumb_url) ? pub(str(row.thumb_url)) : '',
    featured: row.featured === true,
    order: row.sort_order == null || row.sort_order === '' ? Infinity : Number(row.sort_order),
    idx: index
  };
}

async function getPhotos() {
  // Paginate instead of silently stopping at the first REST response page.
  const rows = [];
  let offset = 0;
  let restAvailable = false;
  try {
    while (true) {
      let response = await get(
        `${SB.url}/rest/v1/${SB.table}?select=*&order=sort_order.asc.nullslast,id.asc&limit=1000&offset=${offset}`
      );
      if (response.status === 400 && offset === 0) {
        response = await get(`${SB.url}/rest/v1/${SB.table}?select=*&limit=1000&offset=0`);
      }
      if (!response.ok) break;
      restAvailable = true;
      const page = await response.json();
      if (!Array.isArray(page) || !page.length) break;
      rows.push(...page);
      if (page.length < 1000) break;
      offset += page.length;
    }
  } catch (error) {
    console.warn('Could not read the photography table; trying the public storage bucket.', error);
  }

  let list = rows.map(normalisePhoto).filter(Boolean);
  if (!list.length) {
    // Public Storage fallback, also paginated so large collections are retained.
    try {
      const files = [];
      const visitedFolders = new Set();
      async function listStorageFolder(prefix = '') {
        if (visitedFolders.has(prefix)) return;
        visitedFolders.add(prefix);
        let storageOffset = 0;
        while (true) {
          const response = await get(`${SB.url}/storage/v1/object/list/${SB.bucket}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prefix, limit: 1000, offset: storageOffset,
              sortBy: { column: 'name', order: 'asc' }
            })
          });
          if (!response.ok) return;
          const page = await response.json();
          if (!Array.isArray(page) || !page.length) return;
          for (const item of page) {
            if (item.id && /\.(jpe?g|png|webp|avif)$/i.test(item.name)) {
              files.push({ ...item, path: prefix ? `${prefix}/${item.name}` : item.name });
            } else if (!item.id && item.name && item.name !== '.emptyFolderPlaceholder') {
              await listStorageFolder(prefix ? `${prefix}/${item.name}` : item.name);
            }
          }
          if (page.length < 1000) return;
          storageOffset += page.length;
        }
      }
      await listStorageFolder('');
      list = files
        .map((file, index) => normalisePhoto({ path: file.path, category: 'Photography' }, index))
        .filter(Boolean);
    } catch (error) {
      console.warn('The photo storage listing could not be loaded.', error);
    }
  }

  return list.sort((a, b) => (Number(b.featured) - Number(a.featured)) || (a.order - b.order) || (a.idx - b.idx));
}

function makeFallbackArtwork(photo) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 850;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#d9cbb5');
  gradient.addColorStop(.55, '#a7a6a0');
  gradient.addColorStop(1, '#55596a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(22,25,38,.25)';
  context.fillRect(0, 590, canvas.width, 260);
  context.strokeStyle = 'rgba(255,255,255,.58)';
  context.lineWidth = 8;
  context.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);
  context.fillStyle = '#fffaf0';
  context.textAlign = 'center';
  context.font = '500 48px Georgia,serif';
  context.fillText(photo.title || 'NL Visuals', canvas.width / 2, 390, 1000);
  context.font = '22px monospace';
  context.fillText('IMAGE COULD NOT LOAD', canvas.width / 2, 455);
  return canvas;
}

function makePlaceholders() {
  return Array.from({ length: 12 }, (_, index) => ({
    title: `Museum study ${String(index + 1).padStart(2, '0')}`,
    cap: 'Collection preview', desc: 'The live photography collection could not be reached.',
    year: '', src: '', thumb: '', featured: false, order: index, idx: index
  }));
}

function loadImg(photo) {
  return new Promise(resolve => {
    if (!photo.src) {
      const canvas = makeFallbackArtwork(photo);
      resolve({ ...photo, canvas, ar: canvas.width / canvas.height, failed: true, displaySrc: canvas.toDataURL('image/jpeg', .86) });
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({ ...photo, canvas, ar: canvas.width / canvas.height, failed: false, displaySrc: photo.thumb || photo.src });
    };
    image.onerror = () => {
      const canvas = makeFallbackArtwork(photo);
      resolve({ ...photo, canvas, ar: canvas.width / canvas.height, failed: true, displaySrc: canvas.toDataURL('image/jpeg', .86) });
    };
    image.src = photo.src;
  });
}

/* ---------- Renderer and camera ---------- */
const $ = selector => document.querySelector(selector);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = matchMedia('(pointer: coarse)').matches;
const CAFE_HEIGHT = 4.2;
const EYE_HEIGHT = 1.65;
const host = $('#gallery');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Walk-through 3D photography museum');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e1d4);
scene.fog = new THREE.Fog(0xe9e1d4, 32, 100);
const camera = new THREE.PerspectiveCamera(72, 1, .05, 260);
camera.rotation.order = 'YXZ';
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerWidth < innerHeight ? 82 : 72;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

scene.add(new THREE.HemisphereLight(0xfff5e7, 0x8c8172, 2.1));
const daylight = new THREE.DirectionalLight(0xffe9cd, 2.0);
daylight.position.set(7, 12, 5);
scene.add(daylight);

/* ---------- Materials, textures and geometry helpers ---------- */
const canvasTexture = (width, height, draw) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
};

const wallTexture = canvasTexture(512, 512, (ctx, width, height) => {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#e9dfcf');
  gradient.addColorStop(.48, '#f4eddf');
  gradient.addColorStop(1, '#ded1bf');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 4200; i++) {
    const shade = Math.random() > .5 ? 255 : 65;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * .035})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
});
const timberTexture = canvasTexture(512, 512, (ctx, width, height) => {
  const tones = ['#77563d', '#8a674a', '#987452', '#806044'];
  for (let row = 0; row < 16; row++) {
    ctx.fillStyle = tones[row % tones.length];
    ctx.fillRect(0, row * 32, width, 32);
    ctx.fillStyle = 'rgba(35,21,12,.23)';
    ctx.fillRect(0, row * 32, width, 2);
    for (let line = 0; line < 5; line++) {
      const y = row * 32 + Math.random() * 30;
      ctx.strokeStyle = 'rgba(35,21,12,.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(width * .3, y - 7, width * .7, y + 6, width, y - 2);
      ctx.stroke();
    }
  }
});
timberTexture.wrapS = timberTexture.wrapT = THREE.RepeatWrapping;

const glowTexture = canvasTexture(128, 128, ctx => {
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,239,204,1)');
  gradient.addColorStop(.3, 'rgba(255,213,154,.55)');
  gradient.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
});
const beamTexture = canvasTexture(8, 128, (ctx, width, height) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(255,255,255,.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
});

const basic = options => new THREE.MeshBasicMaterial(options);
const standard = (colour, roughness = .78, metalness = 0) => new THREE.MeshStandardMaterial({ color: colour, roughness, metalness });
const lambert = colour => new THREE.MeshLambertMaterial({ color: colour });
const additive = (map, opacity = .5, colour = 0xffffff) => new THREE.MeshBasicMaterial({
  map, color: colour, transparent: true, opacity,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
});
const put = (mesh, x, y, z, parent = scene) => {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
};
const box = (width, height, depth, colour, x, y, z, parent = scene, material = null) =>
  put(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material || standard(colour)), x, y, z, parent);
const cylinder = (top, bottom, height, colour, x, y, z, parent = scene, segments = 24) =>
  put(new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), standard(colour)), x, y, z, parent);
const glowSprite = (x, y, z, size, opacity = .5, colour = 0xffffff, parent = scene) => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: colour, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sprite.scale.set(size, size, 1);
  return put(sprite, x, y, z, parent);
};

function wall(x1, z1, x2, z2, y0 = 0, y1 = CAFE_HEIGHT, material = null) {
  const length = Math.hypot(x2 - x1, z2 - z1);
  const angle = -Math.atan2(z2 - z1, x2 - x1);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const panel = put(new THREE.Mesh(new THREE.PlaneGeometry(length, y1 - y0), material || basic({ map: wallTexture, side: THREE.DoubleSide })), cx, (y0 + y1) / 2, cz);
  panel.rotation.y = angle;
  return panel;
}

function cafeFloor(x, z, width, depth) {
  const texture = timberTexture.clone();
  texture.needsUpdate = true;
  texture.repeat.set(width / 2.5, depth / 2.5);
  const ground = put(new THREE.Mesh(new THREE.PlaneGeometry(width, depth), standard(0xffffff, .7, .03)), x, 0, z);
  ground.rotation.x = -Math.PI / 2;
  ground.material.map = texture;
  ground.material.needsUpdate = true;
  const ceiling = put(new THREE.Mesh(new THREE.PlaneGeometry(width, depth), standard(0xf3eadb)), x, CAFE_HEIGHT, z);
  ceiling.rotation.x = Math.PI / 2;
}

function makeSign(text, subtext, width, height, options = {}) {
  const texture = canvasTexture(1024, Math.round(1024 * height / width), (ctx, w, h) => {
    ctx.fillStyle = options.background || '#332f37';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = options.border || '#d5b782';
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.textAlign = 'center';
    ctx.fillStyle = options.foreground || '#fff7e9';
    ctx.font = `600 ${Math.round(h * .4)}px Georgia,serif`;
    ctx.fillText(text, w / 2, h * (subtext ? .53 : .64), w - 90);
    if (subtext) {
      ctx.font = `400 ${Math.round(h * .12)}px monospace`;
      ctx.fillStyle = options.subForeground || '#e0d0b9';
      ctx.fillText(subtext, w / 2, h * .79, w - 90);
    }
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), basic({ map: texture, side: THREE.DoubleSide }));
}

function recessedLight(x, z, height = CAFE_HEIGHT) {
  const disk = put(new THREE.Mesh(new THREE.CircleGeometry(.16, 24), basic({ color: 0xffefd0 })), x, height - .014, z);
  disk.rotation.x = Math.PI / 2;
  glowSprite(x, height - .25, z, 1.2, .5);
  glowSprite(x, .02, z, 2.4, .12);
}

/* ---------- Café room ---------- */
const colliders = [];
const interactiveMeshes = [];
const cafeTables = [[3.2, -4.4], [-3.6, -3.4], [-4.2, -8.0], [3.4, -9.0], [-1.1, -9.6]];
let photoCollection = [];
let galleryRooms = [];
let secretRoom = null;
let secretDoorOpen = false;
let secretPanel = null;
let secretPanelStartZ = 0;
let secretPanelTargetZ = 0;
let secretPanelMotion = 0;
let thanksSign = null;
let raveObjects = [];
let raveLightTime = 0;
let museumEndZ = -120;

function buildCafe() {
  cafeFloor(0, -6, 14, 12);
  wall(-7, 0, 7, 0);
  wall(-7, 0, -7, -12);
  wall(7, 0, 7, -12);
  wall(-7, -12, -1.6, -12);
  wall(1.6, -12, 7, -12);
  // Keep the player inside the actual doorway cut-out instead of letting them pass through the café wall.
  colliders.push([-6.7, -1.6, -12.2, -11.8], [1.6, 6.7, -12.2, -11.8]);
  wall(-1.6, -12, 1.6, -12, 2.7, CAFE_HEIGHT, basic({ color: 0xf5ead8 }));
  box(.16, 2.7, .3, 0x8a6a4a, -1.6, 1.35, -12);
  box(.16, 2.7, .3, 0x8a6a4a, 1.6, 1.35, -12);
  box(3.4, .16, .3, 0x8a6a4a, 0, 2.74, -12);
  const doorwaySign = makeSign('THE GALLERIES', 'FOLLOW THE LIGHT', 4.2, 1.25);
  put(doorwaySign, 0, 3.55, -11.78);

  const cafeSign = makeSign('CAFÉ', 'TAKE A BREATHER', 2.8, 1.05);
  put(cafeSign, 6.86, 3.12, -8.5).rotation.y = -Math.PI / 2;

  // A more convincing counter, shelving and small coffee machine.
  box(1.2, 1.05, 5, 0x8c6a4a, 6.1, .525, -8.5);
  box(1.4, .09, 5.2, 0xe8d4b8, 6.0, 1.08, -8.5, scene, standard(0xe8d4b8, .3));
  box(.3, .06, 5, 0x8c6a4a, 6.8, 1.75, -8.5);
  box(.3, .06, 5, 0x8c6a4a, 6.8, 2.3, -8.5);
  box(.55, .48, .72, 0x36343a, 6.0, 1.36, -9.6);
  box(.6, .09, .8, 0xb88e65, 6.0, 1.64, -9.6);
  for (let index = 0; index < 9; index++) {
    cylinder(.06, .05, .1, 0xffffff, 6.8, 1.83, -10.6 + index * .5, scene, 12);
    cylinder(.07, .06, .12, 0xf2d9c0, 6.8, 2.38, -10.6 + index * .5, scene, 12);
  }
  colliders.push([4.9, 7, -11.5, -5.5]);

  cafeTables.forEach(([x, z], index) => {
    cylinder(.62, .62, .06, 0xb88a5e, x, .76, z, scene, 28);
    cylinder(.05, .05, .74, 0x5b4a3a, x, .38, z, scene, 10);
    cylinder(.3, .3, .035, 0x5b4a3a, x, .02, z, scene, 20);
    for (let chair = 0; chair < 3; chair++) {
      const angle = chair * 2.1 + index;
      const chairX = x + Math.sin(angle) * 1.05;
      const chairZ = z + Math.cos(angle) * 1.05;
      cylinder(.23, .23, .06, 0xc9825b, chairX, .46, chairZ, scene, 16);
      cylinder(.03, .03, .44, 0x5b4a3a, chairX, .22, chairZ, scene, 6);
      const chairBack = box(.4, .4, .06, 0xc9825b, chairX + Math.sin(angle) * .2, .7, chairZ + Math.cos(angle) * .2);
      chairBack.rotation.y = angle;
    }
    if (index) cylinder(.06, .05, .08, 0xffffff, x + .2, .82, z + .1, scene, 12);
    colliders.push([x - .95, x + .95, z - .95, z + .95]);
    cylinder(.008, .008, 1.2, 0x6b5a4a, x, CAFE_HEIGHT - .6, z, scene, 6);
    const shade = put(new THREE.Mesh(new THREE.CylinderGeometry(.14, .34, .3, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xe4b77c, side: THREE.DoubleSide, emissive: 0x4a2d10 })), x, CAFE_HEIGHT - 1.35, z);
    shade.castShadow = false;
    glowSprite(x, CAFE_HEIGHT - 1.62, z, 1.8, .45);
    recessedLight(x, z);
  });

  [[-6.2, -.9], [-6.2, -11.1], [6.2, -.9]].forEach(([x, z]) => {
    cylinder(.28, .22, .45, 0xb5683f, x, .22, z, scene, 14);
    for (let leaf = 0; leaf < 5; leaf++) {
      const plant = put(new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 10), lambert(0x68855d)), x + Math.sin(leaf * 1.3) * .2, .75 + leaf * .1, z + Math.cos(leaf * 1.3) * .2);
      plant.scale.set(.65, 1.2, .65);
    }
  });
  [[-3.5, -1.5], [3.5, -1.5], [0, -6.2], [-3.5, -11.2], [3.5, -11.2]].forEach(([x, z]) => recessedLight(x, z));

  const menuTexture = canvasTexture(256, 360, (ctx, width, height) => {
    ctx.fillStyle = '#fff9ef';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#3a3550';
    ctx.lineWidth = 5;
    ctx.strokeRect(14, 14, width - 28, height - 28);
    ctx.fillStyle = '#3a3550';
    ctx.textAlign = 'center';
    ctx.font = '600 72px Georgia,serif';
    ctx.fillText('COLLECTION', width / 2, 145);
    ctx.font = 'italic 24px Georgia,serif';
    ctx.fillText('all photographs', width / 2, 193);
    ctx.font = '16px monospace';
    ctx.fillText('PRESS E TO BROWSE', width / 2, 300);
  });
  const menuGroup = new THREE.Group();
  menuGroup.position.set(3.2, .78, -4.4);
  menuGroup.rotation.y = Math.atan2(-1.2, 1.3);
  scene.add(menuGroup);
  const menuCard = put(new THREE.Mesh(new THREE.BoxGeometry(.34, .42, .025), new THREE.MeshLambertMaterial({ map: menuTexture })), 0, .2, .07, menuGroup);
  menuCard.rotation.x = -.28;
  put(new THREE.Mesh(new THREE.BoxGeometry(.34, .42, .025), lambert(0xf6ead8)), 0, .2, -.07, menuGroup).rotation.x = .28;
  const menuHit = put(new THREE.Mesh(new THREE.BoxGeometry(.9, .8, .8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })), 3.2, 1.0, -4.4);
  menuHit.userData = { menu: true };
  interactiveMeshes.push(menuHit);
  const menuGlow = glowSprite(3.2, 1.0, -4.4, 1.2, .42);
  return { menuGlow };
}

/* ---------- Gallery architecture and photo hanging ---------- */
const ROOM_STYLES = [
  { name: 'THE GRAND ATRIUM', width: 22, height: 7.2, wall: 0xe8dfd0, trim: 0xb79662, floor: 0x9b8064, ceiling: 0xf2eadb, glow: 0xffe7bd, kind: 'atrium' },
  { name: 'THE MODERN WING', width: 19, height: 5.7, wall: 0x45464a, trim: 0x8e8f91, floor: 0x777a7d, ceiling: 0x313338, glow: 0xd4e6ff, kind: 'modern' },
  { name: 'THE SALON GALLERY', width: 21, height: 6.1, wall: 0x593c42, trim: 0xd0ad76, floor: 0x765a52, ceiling: 0x392d32, glow: 0xffdbad, kind: 'salon' },
  { name: 'THE CONSERVATORY', width: 23, height: 6.7, wall: 0x71806e, trim: 0xc5b78f, floor: 0x77795f, ceiling: 0xdde8dd, glow: 0xe5ffdb, kind: 'conservatory' },
  { name: 'THE LIGHT GALLERY', width: 20, height: 5.9, wall: 0xe4e0d8, trim: 0xb1a38e, floor: 0x8f8c86, ceiling: 0xf7f4ee, glow: 0xfff0d5, kind: 'light' },
  { name: 'THE ARCHIVE HALL', width: 24, height: 6.4, wall: 0x343b43, trim: 0xb79b6a, floor: 0x625e59, ceiling: 0x252a30, glow: 0xffd8a5, kind: 'archive' }
];

function galleryFloor(room) {
  const texture = timberTexture.clone();
  texture.needsUpdate = true;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(room.width / 2.2, room.depth / 2.2);
  const material = new THREE.MeshStandardMaterial({ map: texture, color: room.style.floor, roughness: .62, metalness: .04 });
  const floorMesh = put(new THREE.Mesh(new THREE.PlaneGeometry(room.width, room.depth), material), 0, 0, room.centreZ);
  floorMesh.rotation.x = -Math.PI / 2;
  const ceiling = put(new THREE.Mesh(new THREE.PlaneGeometry(room.width, room.depth), standard(room.style.ceiling, .92)), 0, room.height, room.centreZ);
  ceiling.rotation.x = Math.PI / 2;
  // Brass or steel inlay at the perimeter gives the rooms a finished floor edge.
  const inlayColour = room.style.trim;
  [-room.half + .34, room.half - .34].forEach(x => {
    const strip = box(.055, .025, room.depth - .35, inlayColour, x, .018, room.centreZ, scene, standard(inlayColour, .28, .65));
  });
  [room.start - .3, room.end + .3].forEach(z => {
    box(room.width - .4, .025, .055, inlayColour, 0, .018, z, scene, standard(inlayColour, .28, .65));
  });
}

function wallFinish(room, side, start, end, wallMaterial, opening = null) {
  const x = side * room.half;
  if (!opening || side !== -1) {
    wall(x, start, x, end, 0, room.height, wallMaterial);
    return;
  }
  // The left wall in one wing has a concealed doorway behind an oversized framed photograph.
  const gapHalf = 2.05;
  const gapStart = opening.z - gapHalf;
  const gapEnd = opening.z + gapHalf;
  wall(x, start, x, gapStart, 0, room.height, wallMaterial);
  wall(x, gapEnd, x, end, 0, room.height, wallMaterial);
  box(.2, room.height - 3.55, gapHalf * 2, room.style.trim, x, 3.55 + (room.height - 3.55) / 2, opening.z, scene, standard(room.style.wall));
  // Door jambs and a shallow stone lintel sit behind the sliding picture.
  [-1, 1].forEach(direction => box(.28, 3.55, .28, room.style.trim, x + .04, 1.775, opening.z + direction * gapHalf, scene, standard(room.style.trim, .48, .28)));
  box(.28, .28, gapHalf * 2 + .3, room.style.trim, x + .04, 3.55, opening.z, scene, standard(room.style.trim, .48, .28));
}

function addRoomWallDetails(room, side, opening) {
  const half = room.half;
  const x = side * (half - .11);
  const wallColour = room.style.trim;
  // Continuous skirting and upper cornice, with repeated inset wall panels.
  box(.18, .22, room.depth, wallColour, x, .12, room.centreZ, scene, standard(wallColour, .55, .12));
  box(.18, .12, room.depth, wallColour, x, room.height - .15, room.centreZ, scene, standard(wallColour, .55, .12));
  const count = Math.max(2, Math.floor(room.depth / 3.1));
  for (let index = 0; index <= count; index++) {
    const z = room.start - 1.1 - index * (room.depth - 2.2) / count;
    if (opening && side === -1 && Math.abs(z - opening.z) < 2.9) continue;
    const panelMaterial = standard(room.style.trim, .62, room.style.kind === 'modern' ? .18 : .06);
    box(.075, 1.62, .075, wallColour, x, 1.05, z - 1.0, scene, panelMaterial);
    box(.075, 1.62, .075, wallColour, x, 1.05, z + 1.0, scene, panelMaterial);
    box(.075, .075, 2.08, wallColour, x, .28, z, scene, panelMaterial);
    box(.075, .075, 2.08, wallColour, x, 1.82, z, scene, panelMaterial);
  }
  // Sconces are placed between picture groups so each photograph has its own light pool.
  for (let index = 0; index < Math.ceil(room.depth / 7); index++) {
    const z = room.start - 3.0 - index * 7;
    if (opening && side === -1 && Math.abs(z - opening.z) < 3.3) continue;
    const sconce = cylinder(.07, .12, .32, room.style.trim, side * (half - .22), 3.0, z, scene, 12);
    sconce.rotation.z = Math.PI / 2;
    glowSprite(side * (half - .38), 3.12, z, 1.45, .26, room.style.glow);
  }
}

function addRoomColumns(room) {
  const positions = room.style.kind === 'atrium'
    ? [-room.depth / 2 + 4, -room.depth / 2 + 12, room.depth / 2 - 12, room.depth / 2 - 4]
    : room.style.kind === 'salon'
      ? [-room.depth / 2 + 5, 0, room.depth / 2 - 5]
      : [];
  positions.forEach(localZ => {
    [-1, 1].forEach(side => {
      const x = side * (room.half - 1.35);
      const z = room.centreZ + localZ;
      cylinder(.35, .42, room.height - .6, room.style.trim, x, (room.height - .6) / 2, z, scene, 20);
      cylinder(.52, .52, .16, room.style.trim, x, .08, z, scene, 24);
      cylinder(.48, .48, .16, room.style.trim, x, room.height - .38, z, scene, 24);
      colliders.push([x - .55, x + .55, z - .55, z + .55]);
    });
  });
}

function addCeilingArchitecture(room, index) {
  const style = room.style.kind;
  if (style === 'conservatory') {
    // A glazed-looking roof with pale ribs and long skylight panels.
    for (let x = -room.half + 2; x < room.half; x += 4) {
      box(.11, .13, room.depth, 0xc5d4c5, x, room.height - .16, room.centreZ, scene, standard(0xc5d4c5, .32, .18));
    }
    for (let z = room.start - 3; z > room.end; z -= 6) {
      box(room.width, .1, .12, 0xa5b8a7, 0, room.height - .2, z, scene, standard(0xa5b8a7, .36, .12));
    }
  } else if (style === 'modern' || style === 'archive') {
    for (let z = room.start - 3.2; z > room.end; z -= 5.5) {
      box(room.width - 1, .12, .13, style === 'archive' ? 0x9b825a : 0x9da9b7, 0, room.height - .25, z, scene, standard(style === 'archive' ? 0x9b825a : 0x9da9b7, .38, .38));
    }
    box(.12, .06, room.depth - 2, room.style.trim, 0, room.height - .08, room.centreZ, scene, standard(room.style.trim, .38, .45));
  } else {
    for (let z = room.start - 3; z > room.end; z -= 5.5) {
      box(room.width - 1, .12, .22, room.style.trim, 0, room.height - .22, z, scene, standard(room.style.trim, .42, .24));
    }
    // Repeated recessed ceiling coffers.
    for (let z = room.start - 2.7; z > room.end + 1; z -= 5.5) {
      const coffer = put(new THREE.Mesh(new THREE.PlaneGeometry(room.width - 2.5, 3.1), standard(room.style.ceiling, .88)), 0, room.height - .04, z);
      coffer.rotation.x = Math.PI / 2;
    }
  }
  for (let z = room.start - 4; z > room.end + 1; z -= 7.8) {
    const light = put(new THREE.Mesh(new THREE.CircleGeometry(.18, 20), basic({ color: 0xfff1d3 })), 0, room.height - .025, z);
    light.rotation.x = Math.PI / 2;
    glowSprite(0, room.height - .32, z, 2.0, .34, room.style.glow);
  }
}

function addTransitionArch(z, fromRoom, toRoom) {
  const span = 5.3;
  const colour = toRoom.style.trim;
  [-1, 1].forEach(side => {
    box(.38, 3.45, .42, colour, side * span / 2, 1.72, z, scene, standard(colour, .5, .18));
    box(.64, .2, .68, colour, side * span / 2, 3.42, z, scene, standard(colour, .42, .2));
  });
  box(span + .3, .34, .5, colour, 0, 3.62, z, scene, standard(colour, .45, .18));
  const arch = put(new THREE.Mesh(new THREE.TorusGeometry(span / 2, .13, 10, 36, Math.PI), standard(colour, .42, .24)), 0, 2.9, z);
  arch.rotation.z = 0;
  // A thin illuminated reveal marks the threshold between architectural styles.
  box(.045, 3.1, .045, toRoom.style.glow, -span / 2 - .24, 1.55, z, scene, standard(toRoom.style.glow, .3, .1));
  box(.045, 3.1, .045, toRoom.style.glow, span / 2 + .24, 1.55, z, scene, standard(toRoom.style.glow, .3, .1));
}

function photoFrame(photo, side, xWall, z, room) {
  const maxWidth = 2.18;
  const maxHeight = 1.86;
  const width = photo.ar > maxWidth / maxHeight ? maxWidth : maxHeight * photo.ar;
  const height = photo.ar > maxWidth / maxHeight ? maxWidth / photo.ar : maxHeight;
  const centerY = Math.min(room.height - 2.15, 2.55);
  const group = new THREE.Group();
  group.position.set(xWall, 0, z);
  group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(group);

  // Subtle halo, carved frame, mount board, glass-like sheen and a caption plaque.
  put(new THREE.Mesh(new THREE.PlaneGeometry(width + .65, height + .75), additive(glowTexture, .28, room.style.glow)), 0, centerY + .2, .012, group);
  put(new THREE.Mesh(new THREE.BoxGeometry(width + .32, height + .32, .12), standard(room.style.trim, .34, .22)), 0, centerY, .035, group);
  put(new THREE.Mesh(new THREE.BoxGeometry(width + .16, height + .16, .035), standard(0xf2e9db, .72)), 0, centerY, .108, group);
  const texture = new THREE.CanvasTexture(photo.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const imageMesh = put(new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })), 0, centerY, .132, group);
  imageMesh.userData = { photo };
  interactiveMeshes.push(imageMesh);

  const plaqueTexture = canvasTexture(720, 190, ctx => {
    ctx.fillStyle = '#f2eadc';
    ctx.fillRect(0, 0, 720, 190);
    ctx.fillStyle = '#39343a';
    ctx.font = 'italic 42px Georgia,serif';
    let title = photo.title || 'Untitled photograph';
    while (ctx.measureText(title).width > 660 && title.length > 6) title = `${title.slice(0, -2)}…`;
    ctx.fillText(title, 28, 72);
    ctx.font = '24px monospace';
    ctx.fillStyle = '#766c60';
    ctx.fillText(`NATHAN LLOYD  ${[photo.year, photo.cap].filter(Boolean).join(' · ')}`.toUpperCase().slice(0, 47), 28, 132);
  });
  put(new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.65, width), .42), basic({ map: plaqueTexture, side: THREE.DoubleSide })), -width / 2 + Math.min(.9, width / 2), centerY - height / 2 - .42, .14, group);
  glowSprite(side * (room.half - .55), centerY + height / 2 + .85, z, 1.1, .17, room.style.glow);
}

function addRoomGarden(room) {
  if (room.style.kind !== 'conservatory') return;
  const spots = [
    [-room.half + 1.25, room.start - 4], [room.half - 1.25, room.end + 4],
    [-room.half + 1.25, room.end + 5], [room.half - 1.25, room.start - 5]
  ];
  spots.forEach(([x, z]) => {
    cylinder(.42, .34, .52, 0x87745d, x, .26, z, scene, 18);
    for (let leaf = 0; leaf < 7; leaf++) {
      const angle = leaf * Math.PI * 2 / 7;
      const plant = put(new THREE.Mesh(new THREE.SphereGeometry(.38, 12, 10), lambert(0x587b58)), x + Math.cos(angle) * .23, .88 + (leaf % 2) * .17, z + Math.sin(angle) * .23);
      plant.scale.set(.55, 1.5, .42);
    }
  });
}

function addRaveRoom(mainRoom, entranceZ) {
  const wallX = -mainRoom.half;
  const depth = 19;
  const width = 20;
  const outerX = wallX - width;
  const centreX = (wallX + outerX) / 2;
  const halfZ = depth / 2;
  secretRoom = { wallX, outerX, centreX, width, depth, z: entranceZ, minZ: entranceZ - halfZ, maxZ: entranceZ + halfZ };

  const floorMaterial = standard(0x171722, .34, .25);
  const raveFloor = put(new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMaterial), centreX, .01, entranceZ);
  raveFloor.rotation.x = -Math.PI / 2;
  const ceiling = put(new THREE.Mesh(new THREE.PlaneGeometry(width, depth), standard(0x101018, .85)), centreX, 5.4, entranceZ);
  ceiling.rotation.x = Math.PI / 2;
  const raveWall = basic({ color: 0x171722, side: THREE.DoubleSide });
  wall(outerX, entranceZ - halfZ, outerX, entranceZ + halfZ, 0, 5.4, raveWall);
  wall(outerX, entranceZ - halfZ, wallX, entranceZ - halfZ, 0, 5.4, raveWall);
  wall(outerX, entranceZ + halfZ, wallX, entranceZ + halfZ, 0, 5.4, raveWall);

  // LED wall, DJ booth and monitor stacks, all decorative and non-interactive.
  const ledTexture = canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#080812';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 22) {
      for (let x = 0; x < w; x += 22) {
        const hue = (x / w * 300 + y / h * 160) % 360;
        ctx.fillStyle = `hsla(${hue},90%,58%,${.35 + Math.random() * .55})`;
        ctx.fillRect(x + 2, y + 2, 16, 16);
      }
    }
    ctx.fillStyle = 'rgba(4,4,14,.58)';
    ctx.fillRect(0, 180, w, 160);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 90px monospace';
    ctx.fillText('NL / AFTER HOURS', w / 2, 285);
    ctx.font = '28px monospace';
    ctx.fillText('DRUM & BASS // 174 BPM', w / 2, 330);
  });
  const ledPanel = put(new THREE.Mesh(new THREE.PlaneGeometry(12.5, 4.0), new THREE.MeshBasicMaterial({ map: ledTexture, side: THREE.DoubleSide })), outerX + .12, 3.0, entranceZ);
  ledPanel.rotation.y = Math.PI / 2;
  raveObjects.push(ledPanel);
  const blueWash = new THREE.PointLight(0x258cff, 42, 25, 1.6);
  blueWash.position.set(centreX + 5, 3.8, entranceZ - 3.5);
  scene.add(blueWash);
  const pinkWash = new THREE.PointLight(0xe83eac, 36, 24, 1.6);
  pinkWash.position.set(centreX + 5, 3.7, entranceZ + 3.5);
  scene.add(pinkWash);

  // The DJ table is placed against the far wall, facing the entrance.
  box(1.05, 1.0, 6.2, 0x252632, outerX + 2.0, .55, entranceZ, scene, standard(0x252632, .32, .55));
  box(.12, .1, 6.4, 0x8b70ae, outerX + 1.42, 1.08, entranceZ, scene, standard(0x8b70ae, .25, .6));
  for (let deck = 0; deck < 2; deck++) {
    const z = entranceZ + (deck ? 1.15 : -1.15);
    cylinder(.64, .64, .06, 0x11121b, outerX + 1.34, 1.16, z, scene, 36);
    cylinder(.13, .13, .07, 0x9e79d4, outerX + 1.34, 1.2, z, scene, 24);
  }
  box(.45, .14, 1.0, 0x4c5266, outerX + 1.35, 1.28, entranceZ, scene);
  [-1, 1].forEach(side => {
    const speakerZ = entranceZ + side * 7.3;
    box(1.1, 3.2, 1.35, 0x090a11, outerX + 3.9, 1.6, speakerZ, scene, standard(0x090a11, .48, .2));
    [0, 1].forEach(driver => {
      cylinder(.42, .42, .09, 0x34384b, outerX + 3.3, .8 + driver * 1.35, speakerZ, scene, 28).rotation.z = Math.PI / 2;
      glowSprite(outerX + 3.22, .8 + driver * 1.35, speakerZ, .75, .18, side > 0 ? 0x48d8ff : 0xf04dc8);
    });
    box(.08, 4.5, .08, side > 0 ? 0x4acbff : 0xed4cae, outerX + 5.5, 2.25, speakerZ, scene, standard(side > 0 ? 0x4acbff : 0xed4cae, .3, .45));
  });

  // A mirror ball with small reflective facets and soft beams.
  const mirrorBall = put(new THREE.Mesh(new THREE.SphereGeometry(.56, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc4cbd5, metalness: .92, roughness: .16 })), centreX, 4.65, entranceZ);
  raveObjects.push(mirrorBall);
  cylinder(.02, .02, 1.8, 0x7b7388, centreX, 5.5, entranceZ, scene, 8);
  const beamColours = [0x38bfff, 0xf24fc1, 0xa46bff, 0x4cffe0];
  beamColours.forEach((colour, index) => {
    const beamGroup = new THREE.Group();
    beamGroup.position.set(centreX + (index - 1.5) * 2.0, 4.9, entranceZ - 2 + index * 1.35);
    scene.add(beamGroup);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.9, 7.5, 24, 1, true), additive(beamTexture, .22, colour));
    cone.position.y = -3.65;
    cone.rotation.x = Math.PI;
    beamGroup.add(cone);
    raveObjects.push(beamGroup);
  });
  const raveTitle = makeSign('AFTER HOURS', 'A LITTLE SECRET FOR THE CURIOUS', 5.0, 1.2, {
    background: '#11111d', border: '#d15ad5', foreground: '#f4e8ff', subForeground: '#8feaff'
  });
  raveTitle.position.set(centreX, 4.3, entranceZ + halfZ - .16);
  raveTitle.rotation.y = Math.PI;
  scene.add(raveTitle);

  // Doorway frame: the wall opening stays hidden by the large framed picture until it slides aside.
  [-1, 1].forEach(side => {
    box(.3, 3.55, .3, 0x9b7d50, wallX + .08, 1.78, entranceZ + side * 2.05, scene, standard(0x9b7d50, .42, .25));
  });
  box(.28, .26, 4.3, 0x9b7d50, wallX + .08, 3.57, entranceZ, scene, standard(0x9b7d50, .42, .25));

  colliders.push([outerX + 1.3, outerX + 2.8, entranceZ - 3.3, entranceZ + 3.3]);
  return secretRoom;
}

function buildSecretPainting(room, photo) {
  const panel = new THREE.Group();
  const startX = room.wallX + .16;
  secretPanelStartZ = room.z;
  secretPanelTargetZ = room.z + 4.5;
  panel.position.set(startX, 1.92, room.z);
  panel.rotation.y = Math.PI / 2;
  scene.add(panel);
  const frame = put(new THREE.Mesh(new THREE.BoxGeometry(3.9, 3.35, .2), standard(0xb08b58, .32, .3)), 0, 0, 0, panel);
  const mount = put(new THREE.Mesh(new THREE.BoxGeometry(3.65, 3.1, .07), standard(0xf2e8d8, .72)), 0, 0, .13, panel);
  const imageTexture = new THREE.CanvasTexture(photo.canvas);
  imageTexture.colorSpace = THREE.SRGBColorSpace;
  imageTexture.anisotropy = 8;
  const painting = put(new THREE.Mesh(new THREE.PlaneGeometry(3.48, 2.92), new THREE.MeshBasicMaterial({ map: imageTexture, side: THREE.DoubleSide })), 0, 0, .18, panel);
  painting.userData = { secret: true };
  interactiveMeshes.push(painting);
  // A small brass plaque makes it look like an ordinary exhibition piece.
  const plaque = makeSign('UNTITLED', 'LOOK CLOSER', 1.55, .38, { background: '#332d2a', border: '#c7a56b', foreground: '#fff2d6' });
  plaque.position.set(.08, -1.88, .2);
  panel.add(plaque);
  secretPanel = panel;
}

function buildGallery(photos) {
  const photosPerRoom = 8;
  const roomCount = Math.max(4, Math.ceil(photos.length / photosPerRoom));
  let cursorZ = -12;
  let photoIndex = 0;
  galleryRooms = [];

  for (let index = 0; index < roomCount; index++) {
    const style = ROOM_STYLES[index % ROOM_STYLES.length];
    const roomPhotos = photos.slice(photoIndex, photoIndex + photosPerRoom);
    photoIndex += roomPhotos.length;
    const slots = Math.max(1, Math.ceil(roomPhotos.length / 2));
    const depth = Math.max(22, slots * 4.8 + 9.5);
    const room = {
      index, style, photos: roomPhotos,
      width: style.width, half: style.width / 2,
      height: style.height, depth,
      start: cursorZ, end: cursorZ - depth,
      centreZ: cursorZ - depth / 2,
      secretEntrance: false
    };
    galleryRooms.push(room);
    cursorZ = room.end;
  }

  // Hide the entrance in the second architectural room, away from the entrance foyer.
  const secretIndex = Math.min(1, galleryRooms.length - 1);
  const secretGallery = galleryRooms[secretIndex];
  const entranceZ = secretGallery.start - 2.55;
  secretGallery.secretEntrance = true;
  secretGallery.secretZ = entranceZ;

  galleryRooms.forEach((room, roomIndex) => {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: room.style.wall, map: wallTexture, roughness: .88, side: THREE.DoubleSide });
    galleryFloor(room);
    wallFinish(room, -1, room.start, room.end, wallMaterial, room.secretEntrance ? { z: room.secretZ } : null);
    wallFinish(room, 1, room.start, room.end, wallMaterial, null);
    addRoomWallDetails(room, -1, room.secretEntrance ? { z: room.secretZ } : null);
    addRoomWallDetails(room, 1, null);
    addCeilingArchitecture(room, roomIndex);
    addRoomColumns(room);
    addRoomGarden(room);

    // Room names sit proud of the wall and point into the space, not inside the plaster.
    const title = makeSign(room.style.name, `COLLECTION ROOM ${String(roomIndex + 1).padStart(2, '0')}`, Math.min(7.5, room.width - 4), 1.35, {
      background: room.style.kind === 'modern' || room.style.kind === 'archive' ? '#20242a' : '#352f32',
      border: `#${room.style.trim.toString(16).padStart(6, '0')}`
    });
    title.position.set(0, room.height - 1.12, room.start - .32);
    scene.add(title);

    // Each record in the collection gets its own physical frame. No 24-photo cap.
    room.photos.forEach((photo, localIndex) => {
      let side = localIndex % 2 === 0 ? -1 : 1;
      let slot = Math.floor(localIndex / 2);
      let z = room.start - 5.1 - slot * 4.8;
      if (room.secretEntrance && side === -1 && Math.abs(z - room.secretZ) < 3.35) {
        // Move the affected picture one station deeper; it remains in the exhibition.
        z -= 4.8;
      }
      photoFrame(photo, side, side * (room.half - .07), z, room);
    });

    // A room-to-room arch gives the long museum a sequence of distinct spaces.
    if (roomIndex > 0) addTransitionArch(room.start, galleryRooms[roomIndex - 1], room);
  });

  const finalRoom = galleryRooms[galleryRooms.length - 1];
  museumEndZ = finalRoom.end;
  // End portal: a loop back to the beginning means the exhibition can be explored again.
  const endWallMat = new THREE.MeshStandardMaterial({ color: finalRoom.style.wall, side: THREE.DoubleSide });
  wall(finalRoom.half, finalRoom.end, 2.8, finalRoom.end, 0, finalRoom.height, endWallMat);
  wall(-2.8, finalRoom.end, -finalRoom.half, finalRoom.end, 0, finalRoom.height, endWallMat);
  box(5.7, finalRoom.height - 3.7, .18, finalRoom.style.trim, 0, 3.7 + (finalRoom.height - 3.7) / 2, finalRoom.end, scene, standard(finalRoom.style.wall));
  const portal = put(new THREE.Mesh(new THREE.PlaneGeometry(4.7, 3.2), new THREE.MeshBasicMaterial({ color: 0x8b9aaa, transparent: true, opacity: .25, side: THREE.DoubleSide })), 0, 2.0, finalRoom.end + .18);
  portal.userData = { continue: true };
  interactiveMeshes.push(portal);
  const portalSign = makeSign('THE COLLECTION CONTINUES', 'PRESS E TO RETURN TO THE ENTRANCE', 6.5, 1.3);
  portalSign.position.set(0, finalRoom.height - 1.0, finalRoom.end + .2);
  scene.add(portalSign);

  const thankZ = finalRoom.end + 3.1;
  // A freestanding display structure moves the message well clear of the far wall.
  box(7.8, .22, .9, finalRoom.style.trim, 0, .16, thankZ, scene, standard(finalRoom.style.trim, .38, .22));
  [-3.25, 3.25].forEach(x => {
    box(.16, 2.9, .16, finalRoom.style.trim, x, 1.55, thankZ, scene, standard(finalRoom.style.trim, .42, .2));
    box(.48, .18, .42, finalRoom.style.trim, x, 3.05, thankZ, scene, standard(finalRoom.style.trim, .42, .2));
  });
  const endThanks = makeSign('THANKS FOR VISITING', '@NATHANS_PHOTOGRAPHY', 7.2, 1.65, {
    background: '#332f37', border: '#d5b782'
  });
  endThanks.position.set(0, 2.72, thankZ);
  scene.add(endThanks);
  thanksSign = endThanks;

  // The after-hours room branches from a hidden gap in the second room's left wall.
  addRaveRoom(secretGallery, entranceZ);
  buildSecretPainting(secretRoom, photos[0] || loadFallbackPhoto());
}

function loadFallbackPhoto() {
  const photo = { title: 'Hidden collection', cap: 'Secret exhibition', year: '', desc: '' };
  const canvas = makeFallbackArtwork(photo);
  return { ...photo, canvas, ar: canvas.width / canvas.height };
}

/* ---------- Player movement, jumping and mouse look ---------- */
const player = { x: 0, z: -1.4, yaw: 0, pitch: 0, height: 0 };
let velocityX = 0;
let velocityZ = 0;
let verticalVelocity = 0;
let grounded = true;
let glide = null;
let drag = null;
const keys = Object.create(null);
const stick = { x: 0, y: 0 };
const stickElement = $('#stick');
const stickKnob = stickElement.firstElementChild;
let stickPointerId = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pill = $('#pill');
const actionHint = $('#action-hint');
const crosshair = $('#crosshair');
let currentTarget = null;
let lastTargetCheck = 0;

function inRect(x, z, minX, maxX, minZ, maxZ) {
  return x > minX && x < maxX && z > minZ && z < maxZ;
}

function walkable(x, z) {
  if (inRect(x, z, -6.62, 6.62, -11.68, -.32)) return true;
  for (const room of galleryRooms) {
    if (inRect(x, z, -room.half + .1, room.half - .1, room.end - .35, room.start + .35)) return true;
  }
  if (secretDoorOpen && secretRoom) {
    const inDoorLane = inRect(x, z, secretRoom.wallX - 2.7, secretRoom.wallX + .3, secretRoom.minZ + .1, secretRoom.maxZ - .1)
      && Math.abs(z - secretRoom.z) < 2.08;
    const inSecretInterior = inRect(x, z, secretRoom.outerX + .3, secretRoom.wallX - 2.55, secretRoom.minZ + .1, secretRoom.maxZ - .1);
    if (inDoorLane || inSecretInterior) return true;
  }
  return false;
}

function free(x, z) {
  if (!walkable(x, z)) return false;
  return !colliders.some(collider => inRect(x, z, collider[0], collider[1], collider[2], collider[3]));
}

const isOverlayOpen = () => $('#prompt').classList.contains('on') || $('#menu').classList.contains('on') || $('#view').classList.contains('on');
const isPointerLocked = () => document.pointerLockElement === renderer.domElement;

function clampPitch(value) {
  return Math.max(-1.12, Math.min(1.12, value));
}

function requestMouseCapture() {
  if (coarsePointer || !renderer.domElement.requestPointerLock || isOverlayOpen()) return;
  try {
    const result = renderer.domElement.requestPointerLock();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (error) {
    console.warn('Pointer lock was not available; click-and-drag look remains enabled.', error);
  }
}

function updateControlsHint() {
  document.body.classList.toggle('mouse-locked', isPointerLocked());
  if (coarsePointer) {
    $('#hint').textContent = 'Left stick: move · Drag: look · Space button: jump · Tap a photo to view';
    return;
  }
  $('#hint').textContent = isPointerLocked()
    ? 'WASD move · Mouse look · SPACE jump · SHIFT sprint · E interact · ESC release mouse'
    : 'Click the museum to capture your mouse · WASD move · SPACE jump · SHIFT sprint · E interact';
}

document.addEventListener('pointerlockchange', updateControlsHint);
document.addEventListener('pointerlockerror', () => {
  $('#hint').textContent = 'Mouse capture unavailable — click and drag to look · WASD move · SPACE jump';
});

function setTarget(object) {
  currentTarget = object || null;
  if (!currentTarget) {
    actionHint.classList.remove('on');
    return;
  }
  let label = 'PRESS E TO VIEW PHOTOGRAPH';
  if (currentTarget.userData.secret) label = secretDoorOpen ? 'PRESS E TO CLOSE THE SECRET DOOR' : 'PRESS E TO REVEAL THE SECRET ROOM';
  else if (currentTarget.userData.menu) label = 'PRESS E TO OPEN THE PHOTO INDEX';
  else if (currentTarget.userData.continue) label = 'PRESS E TO LOOP BACK TO THE ENTRANCE';
  actionHint.textContent = label;
  actionHint.classList.add('on');
}

function centrePick() {
  pointer.set(0, 0);
  raycaster.setFromCamera(pointer, camera);
  raycaster.far = 8;
  const hits = raycaster.intersectObjects(interactiveMeshes, false);
  return hits.length ? hits[0].object : null;
}

function pointerPick(event) {
  pointer.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  raycaster.far = 8;
  const hits = raycaster.intersectObjects(interactiveMeshes, false);
  return hits.length ? hits[0].object : null;
}

function glideTo(x, z, yaw = player.yaw, pitch = player.pitch, duration = 1300) {
  let deltaYaw = ((yaw - player.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  velocityX = velocityZ = 0;
  glide = {
    start: performance.now(), duration: reduceMotion ? 1 : duration,
    from: { ...player }, to: { x, z, yaw: player.yaw + deltaYaw, pitch }
  };
}

function anglesTo(fx, fy, fz, tx, ty, tz) {
  const dx = tx - fx;
  const dz = tz - fz;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(ty - fy, Math.hypot(dx, dz)) };
}
const ease = value => value < .5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
const toCafe = () => {
  const angle = anglesTo(2, EYE_HEIGHT, -3.1, 3.2, .85, -4.4);
  glideTo(2, -3.1, angle.yaw, angle.pitch);
};
const toGallery = () => {
  const first = galleryRooms[0];
  glideTo(0, first ? first.start + 2.2 : -13.6, 0, 0, 1700);
};

function initialiseAudioFromGesture() {
  try { startRaveAudio(); } catch (error) { console.warn('Audio could not be initialised.', error); }
}

function toggleSecretDoor() {
  if (!secretPanel || !secretRoom) return;
  secretDoorOpen = !secretDoorOpen;
  secretPanelTargetZ = secretPanelStartZ + (secretDoorOpen ? 4.5 : 0);
  secretPanelMotion = performance.now();
  $('#hint').textContent = secretDoorOpen ? 'SECRET ROOM UNLOCKED — THE PAINTING HAS SLID ASIDE' : 'THE SECRET DOOR IS HIDDEN AGAIN';
  setTarget(null);
  initialiseAudioFromGesture();
}

function loopToEntrance() {
  const first = galleryRooms[0];
  if (!first) return;
  secretDoorOpen = false;
  secretPanelMotion = 0;
  if (secretPanel) secretPanel.position.z = secretPanelStartZ;
  glideTo(0, first.start + 3.0, 0, 0, 1800);
}

function activateObject(object) {
  if (!object) return;
  const data = object.userData || {};
  if (data.secret) {
    toggleSecretDoor();
  } else if (data.menu) {
    openMenu();
  } else if (data.continue) {
    loopToEntrance();
  } else if (data.photo) {
    openView(data.photo);
  }
}

function tryInteract() {
  if (isOverlayOpen()) return;
  const target = centrePick();
  if (target) activateObject(target);
}

addEventListener('keydown', event => {
  if (event.code === 'Escape') {
    if ($('#view').classList.contains('on')) closeView();
    else if ($('#menu').classList.contains('on')) closeMenu();
    else if ($('#prompt').classList.contains('on')) closePrompt();
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    if (!isOverlayOpen()) {
      keys.Space = true;
      initialiseAudioFromGesture();
    }
    return;
  }
  if (event.code === 'KeyE' && !isOverlayOpen()) {
    event.preventDefault();
    initialiseAudioFromGesture();
    tryInteract();
    return;
  }
  if (!isOverlayOpen() && /^(KeyW|KeyA|KeyS|KeyD|Arrow\w+|ShiftLeft|ShiftRight)$/.test(event.code)) {
    keys[event.code] = true;
    if (event.code.startsWith('Arrow')) event.preventDefault();
  }
});
addEventListener('keyup', event => { delete keys[event.code]; });
addEventListener('blur', () => { for (const key of Object.keys(keys)) delete keys[key]; });

stickElement.addEventListener('pointerdown', event => {
  stickPointerId = event.pointerId;
  stickElement.setPointerCapture(stickPointerId);
  updateStick(event);
});
function updateStick(event) {
  if (event.pointerId !== stickPointerId) return;
  const rect = stickElement.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const magnitude = Math.min(1, Math.hypot(dx, dy) / 45);
  const angle = Math.atan2(dy, dx);
  stick.x = Math.cos(angle) * magnitude;
  stick.y = Math.sin(angle) * magnitude;
  stickKnob.style.transform = `translate(${stick.x * 40}px,${stick.y * 40}px)`;
}
stickElement.addEventListener('pointermove', updateStick);
function endStick(event) {
  if (event.pointerId !== stickPointerId) return;
  stickPointerId = null;
  stick.x = stick.y = 0;
  stickKnob.style.transform = '';
}
stickElement.addEventListener('pointerup', endStick);
stickElement.addEventListener('pointercancel', endStick);
$('#jump-button').addEventListener('pointerdown', event => {
  event.preventDefault();
  if (!isOverlayOpen()) {
    keys.Space = true;
    initialiseAudioFromGesture();
  }
});

host.addEventListener('pointerdown', event => {
  if (isOverlayOpen() || event.target !== renderer.domElement) return;
  initialiseAudioFromGesture();
  if (!isPointerLocked()) {
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, px: event.clientX, py: event.clientY, moved: false };
    if (coarsePointer) host.setPointerCapture(event.pointerId);
  }
});

host.addEventListener('pointermove', event => {
  if (isPointerLocked()) {
    // Pointer-lock movementX/Y are relative deltas. Both axes use the normal FPS direction.
    player.yaw -= event.movementX * .00225;
    player.pitch = clampPitch(player.pitch - event.movementY * .00205);
    return;
  }
  if (drag && drag.id === event.pointerId) {
    const dx = event.clientX - drag.px;
    const dy = event.clientY - drag.py;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) {
      drag.moved = true;
      host.classList.add('drag');
      pill.style.opacity = 0;
    }
    if (drag.moved && !glide) {
      const sensitivity = event.pointerType === 'touch' ? .0048 : .0032;
      player.yaw -= dx * sensitivity;
      player.pitch = clampPitch(player.pitch - dy * sensitivity);
    }
    drag.px = event.clientX;
    drag.py = event.clientY;
    return;
  }
  if (isOverlayOpen() || coarsePointer) return;
  const target = pointerPick(event);
  host.classList.toggle('over', !!target);
  if (target) {
    pill.textContent = target.userData.secret ? 'HIDDEN ENTRANCE' : target.userData.menu ? 'PHOTO INDEX' : target.userData.continue ? 'CONTINUE' : 'VIEW PHOTOGRAPH';
    pill.style.left = `${event.clientX}px`;
    pill.style.top = `${event.clientY}px`;
    pill.style.opacity = 1;
  } else pill.style.opacity = 0;
});

host.addEventListener('pointerup', event => {
  host.classList.remove('drag');
  const previousDrag = drag;
  drag = null;
  if (isOverlayOpen()) return;
  if (isPointerLocked()) {
    const target = centrePick();
    if (target) activateObject(target);
    return;
  }
  if (previousDrag && previousDrag.id === event.pointerId && !previousDrag.moved) {
    const target = pointerPick(event);
    if (target) {
      activateObject(target);
      return;
    }
    if (!coarsePointer) requestMouseCapture();
  }
});
host.addEventListener('pointercancel', () => { drag = null; host.classList.remove('drag'); });
host.addEventListener('contextmenu', event => event.preventDefault());
host.addEventListener('dragstart', event => event.preventDefault());
document.addEventListener('selectstart', event => event.preventDefault());

/* ---------- Original procedural drum & bass for the hidden room ---------- */
let audioContext = null;
let raveMaster = null;
let sequencerTimer = null;
let nextStepTime = 0;
let stepNumber = 0;
let noiseBuffer = null;

function startRaveAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  if (!audioContext) {
    audioContext = new AudioContextClass();
    raveMaster = audioContext.createGain();
    raveMaster.gain.value = 0;
    raveMaster.connect(audioContext.destination);
    noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let index = 0; index < channel.length; index++) channel[index] = Math.random() * 2 - 1;
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  if (sequencerTimer) return;
  nextStepTime = audioContext.currentTime + .08;
  stepNumber = 0;
  sequencerTimer = setInterval(() => {
    if (!audioContext || !raveMaster) return;
    const bpm = 174;
    const sixteenth = 60 / bpm / 4;
    while (nextStepTime < audioContext.currentTime + .12) {
      scheduleRaveStep(stepNumber % 16, nextStepTime);
      nextStepTime += sixteenth;
      stepNumber++;
    }
  }, 25);
}

function envelope(gain, time, peak, attack, decay) {
  gain.gain.cancelScheduledValues(time);
  gain.gain.setValueAtTime(.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), time + attack);
  gain.gain.exponentialRampToValueAtTime(.0001, time + attack + decay);
}

function scheduleKick(time) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(135, time);
  oscillator.frequency.exponentialRampToValueAtTime(43, time + .13);
  envelope(gain, time, .95, .004, .17);
  oscillator.connect(gain);
  gain.connect(raveMaster);
  oscillator.start(time);
  oscillator.stop(time + .2);
}

function scheduleNoise(time, peak, duration, frequency, type) {
  const source = audioContext.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = audioContext.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  const gain = audioContext.createGain();
  envelope(gain, time, peak, .002, duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(raveMaster);
  source.start(time);
  source.stop(time + duration + .04);
}

function scheduleSnare(time) {
  scheduleNoise(time, .26, .12, 1800, 'highpass');
  const tone = audioContext.createOscillator();
  const gain = audioContext.createGain();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(185, time);
  envelope(gain, time, .17, .003, .1);
  tone.connect(gain);
  gain.connect(raveMaster);
  tone.start(time);
  tone.stop(time + .13);
}

function scheduleBass(time, note) {
  const bass = audioContext.createOscillator();
  const sub = audioContext.createOscillator();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  bass.type = 'sawtooth';
  sub.type = 'sine';
  bass.frequency.value = note;
  sub.frequency.value = note / 2;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(170, time);
  filter.frequency.exponentialRampToValueAtTime(720, time + .07);
  filter.frequency.exponentialRampToValueAtTime(145, time + .23);
  envelope(gain, time, .19, .012, .23);
  bass.connect(filter);
  filter.connect(gain);
  sub.connect(gain);
  gain.connect(raveMaster);
  bass.start(time);
  sub.start(time);
  bass.stop(time + .27);
  sub.stop(time + .27);
}

function scheduleRaveStep(step, time) {
  if ([0, 7, 8, 14].includes(step)) scheduleKick(time);
  if ([4, 12].includes(step)) scheduleSnare(time);
  if (step % 2 === 0) scheduleNoise(time, step % 4 === 0 ? .09 : .055, .035, 7200, 'highpass');
  if ([7, 15].includes(step)) scheduleNoise(time, .12, .14, 5800, 'highpass');
  const notes = { 0: 55, 3: 55, 6: 65.4, 8: 73.4, 11: 65.4, 14: 49 };
  if (notes[step]) scheduleBass(time, notes[step]);
}

/* ---------- Menu, photograph viewer and welcome ---------- */
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function buildMenu() {
  const grid = $('#mgrid');
  if (!photoCollection.length) {
    grid.innerHTML = '<p class="empty">The collection could not be reached just now. Refresh to try again.</p>';
    return;
  }
  $('#msub').textContent = `${photoCollection.length} photographs across ${galleryRooms.length} architectural rooms.`;
  grid.innerHTML = photoCollection.map((photo, index) => `
    <a class="mi" data-index="${index}" tabindex="0" role="button" aria-label="View ${escapeHTML(photo.title)}">
      <div class="im" style="background-image:url('${escapeHTML(photo.displaySrc || photo.src)}')"></div>
      <b>${escapeHTML(photo.title)}</b><i>Nathan Lloyd</i>
      <em>${escapeHTML([photo.year, photo.cap].filter(Boolean).join(' · '))}</em>
    </a>`).join('');
  grid.querySelectorAll('.mi').forEach(card => {
    const openPhoto = () => openView(photoCollection[Number(card.dataset.index)]);
    card.addEventListener('click', openPhoto);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPhoto();
      }
    });
  });
}

function openMenu() {
  pill.style.opacity = 0;
  if (isPointerLocked()) document.exitPointerLock();
  $('#menu').classList.add('on');
  $('#mx').focus();
}
function closeMenu() {
  $('#menu').classList.remove('on');
}
function openView(photo) {
  if (!photo) return;
  if (isPointerLocked()) document.exitPointerLock();
  const viewer = $('#view');
  const image = viewer.querySelector('img');
  image.src = photo.displaySrc || photo.src;
  image.alt = photo.title;
  viewer.querySelector('p').innerHTML = `${escapeHTML(photo.title)}<i>${escapeHTML([photo.year, photo.cap].filter(Boolean).join(' · '))}</i>${photo.desc ? `<small>${escapeHTML(photo.desc)}</small>` : ''}`;
  pill.style.opacity = 0;
  viewer.classList.add('on');
  viewer.querySelector('.x').focus();
}
function closeView() { $('#view').classList.remove('on'); }
function closePrompt() { $('#prompt').classList.remove('on'); }

$('#mx').addEventListener('click', closeMenu);
$('#view .x').addEventListener('click', closeView);
$('#view').addEventListener('click', event => {
  if (event.target.tagName !== 'IMG' && !event.target.closest('p')) closeView();
});
$('#goCafe').addEventListener('click', () => {
  closePrompt();
  initialiseAudioFromGesture();
  toCafe();
  requestMouseCapture();
});
$('#goWander').addEventListener('click', () => {
  closePrompt();
  initialiseAudioFromGesture();
  toGallery();
  requestMouseCapture();
});

document.addEventListener('click', event => {
  const button = event.target.closest('[data-go]');
  if (!button) return;
  const destination = button.dataset.go;
  closeView();
  if (destination === 'menu') {
    openMenu();
    return;
  }
  closeMenu();
  closePrompt();
  if (destination === 'cafe') toCafe();
  else toGallery();
  requestMouseCapture();
});

/* ---------- Main update loop ---------- */
let lastFrame = performance.now();
let lastNow = performance.now();
let audioGainTarget = 0;

function isInsideRaveRoom() {
  return !!(secretDoorOpen && secretRoom &&
    inRect(player.x, player.z, secretRoom.outerX + .5, secretRoom.wallX - .2, secretRoom.minZ + .4, secretRoom.maxZ - .4));
}

function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min(.06, (now - lastFrame) / 1000);
  lastFrame = now;

  if (glide) {
    const progress = Math.min(1, (now - glide.start) / glide.duration);
    const amount = ease(progress);
    player.x = glide.from.x + (glide.to.x - glide.from.x) * amount;
    player.z = glide.from.z + (glide.to.z - glide.from.z) * amount;
    player.yaw = glide.from.yaw + (glide.to.yaw - glide.from.yaw) * amount;
    player.pitch = glide.from.pitch + (glide.to.pitch - glide.from.pitch) * amount;
    if (progress >= 1) glide = null;
  } else if (!isOverlayOpen()) {
    let forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - stick.y;
    let right = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + stick.x;
    if (keys.ArrowLeft) player.yaw += 1.85 * delta;
    if (keys.ArrowRight) player.yaw -= 1.85 * delta;
    const magnitude = Math.hypot(forward, right);
    if (magnitude > 1) { forward /= magnitude; right /= magnitude; }
    const speed = keys.ShiftLeft || keys.ShiftRight ? 6.0 : 3.55;
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    const targetX = (-sin * forward + cos * right) * speed;
    const targetZ = (-cos * forward - sin * right) * speed;
    const smoothing = Math.min(1, delta * 10);
    velocityX += (targetX - velocityX) * smoothing;
    velocityZ += (targetZ - velocityZ) * smoothing;
    const nextX = player.x + velocityX * delta;
    const nextZ = player.z + velocityZ * delta;
    if (free(nextX, player.z)) player.x = nextX; else velocityX = 0;
    if (free(player.x, nextZ)) player.z = nextZ; else velocityZ = 0;

    if (keys.Space && grounded) {
      verticalVelocity = 5.35;
      grounded = false;
      keys.Space = false;
    }
    if (!grounded) {
      verticalVelocity -= 15.5 * delta;
      player.height += verticalVelocity * delta;
      if (player.height <= 0) {
        player.height = 0;
        verticalVelocity = 0;
        grounded = true;
      }
    }
  }

  if (secretPanel && secretPanelMotion) {
    const progress = Math.min(1, (now - secretPanelMotion) / 680);
    const smooth = 1 - Math.pow(1 - progress, 3);
    const destination = secretDoorOpen ? secretPanelTargetZ : secretPanelStartZ;
    const origin = secretDoorOpen ? secretPanelStartZ : secretPanelStartZ + 4.5;
    secretPanel.position.z = origin + (destination - origin) * smooth;
    if (progress >= 1) secretPanelMotion = 0;
  }

  const moving = Math.min(1, Math.hypot(velocityX, velocityZ) / 3);
  const bob = grounded ? Math.sin(now / 115) * .014 * moving : 0;
  camera.position.set(player.x, EYE_HEIGHT + player.height + bob, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);

  // The original procedural D&B loop fades in only after the hidden-room entrance is opened and entered.
  if (raveMaster && audioContext && audioContext.state === 'running') {
    const target = isInsideRaveRoom() ? .42 : 0;
    if (Math.abs(target - audioGainTarget) > .015) {
      audioGainTarget = target;
      raveMaster.gain.setTargetAtTime(target, audioContext.currentTime, .32);
    }
  }

  if (raveObjects.length) {
    raveLightTime = now * .00045;
    raveObjects.forEach((object, index) => {
      if (object.isGroup) {
        object.rotation.y = Math.sin(raveLightTime + index) * .48;
        object.rotation.x = Math.cos(raveLightTime * .8 + index) * .18;
      } else if (object.isMesh && object.geometry.type === 'SphereGeometry') {
        object.rotation.y += delta * .38;
      }
    });
  }

  if (isPointerLocked() && now - lastTargetCheck > 90 && !isOverlayOpen()) {
    lastTargetCheck = now;
    setTarget(centrePick());
  } else if (!isPointerLocked() && !coarsePointer && !isOverlayOpen()) {
    // Hide the centre interaction label when the player is using the free cursor.
    actionHint.classList.remove('on');
  }

  renderer.render(scene, camera);
}

/* ---------- Boot ---------- */
(async () => {
  const fonts = Promise.all([
    document.fonts.load('600 60px Georgia'),
    document.fonts.load('italic 400 52px Georgia'),
    document.fonts.ready
  ]).catch(() => {});

  photoCollection = await getPhotos();
  if (!photoCollection.length) photoCollection = makePlaceholders();

  // Load every collection image; failures become labelled artwork placeholders instead of disappearing.
  const loadedPhotos = new Array(photoCollection.length);
  let nextPhoto = 0;
  async function photoWorker() {
    while (nextPhoto < photoCollection.length) {
      const index = nextPhoto++;
      loadedPhotos[index] = await loadImg(photoCollection[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, photoCollection.length) }, () => photoWorker()));
  photoCollection = loadedPhotos;
  await fonts;

  buildCafe();
  buildGallery(photoCollection);
  buildMenu();

  $('#veil').style.opacity = 0;
  setTimeout(() => $('#veil')?.remove(), 1000);
  updateControlsHint();
  requestAnimationFrame(frame);
  setTimeout(() => {
    $('#prompt').classList.add('on');
    $('#goWander').focus();
  }, reduceMotion ? 0 : 850);
})();
