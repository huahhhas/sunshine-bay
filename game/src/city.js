// Sunshine Bay itself: a procedural coastal city on a street grid, built once from a seed
// so the same seed always grows the same city. Buildings are boxes with canvas-painted
// facades (windows, lit and dark), streets are dark strips with dashed centre lines, and the
// south edge is a beach, a boardwalk, a marina pier and the bay. The city also hands out the
// road graph traffic drives on, the colliders everything bumps into, and the places missions
// point at. Nothing here loads a file: every texture is painted on a canvas at boot.

import { CITY, PALETTE } from './config.js';
import { pick, range, rangeInt } from './random.js';

const HALF = CITY.half;
const PITCH = CITY.pitch;

export function streetCoords() {
  const list = [];
  for (let i = 0; i < CITY.blocks; i += 1) list.push((i - (CITY.blocks - 1) / 2) * PITCH);
  return list;
}

export function isOnRoad(x, z) {
  const halfRoad = CITY.road / 2;
  for (const s of streetCoords()) {
    if (Math.abs(x - s) < halfRoad || Math.abs(z - s) < halfRoad) return true;
  }
  return false;
}

function facadeTexture(rng, base, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, 128, 10);
  const winW = 128 / cols;
  const winH = 256 / floors;
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng() < 0.28;
      g.fillStyle = lit ? '#ffe9a8' : '#2a3542';
      g.fillRect(c * winW + 5, f * winH + 8, winW - 10, winH - 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = fg;
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(rng) {
  const group = new THREE.Group();
  const colliders = [];
  const streets = streetCoords();

  const groundMat = new THREE.MeshLambertMaterial({ color: 0x6a7a5a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 220, HALF * 2 + 220), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const dashMat = new THREE.MeshLambertMaterial({ color: PALETTE.roadLine });
  for (const s of streets) {
    for (const along of [-1, 1]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + CITY.road, CITY.road), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.01, s);
      if (along === 1) {
        road.rotation.z = Math.PI / 2;
        road.position.set(s, 0.01, 0);
      }
      road.receiveShadow = true;
      group.add(road);
    }
    for (let d = -HALF; d < HALF; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.6), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(d, 0.02, s);
      group.add(dash);
      const dash2 = dash.clone();
      dash2.position.set(s, 0.02, d);
      dash2.rotation.z = Math.PI / 2;
      group.add(dash2);
    }
  }

  // Sidewalks: pale frames around each block.
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const blockCenters = [];
  for (let i = 0; i < CITY.blocks - 1; i += 1) blockCenters.push(streets[i] + PITCH / 2);
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block + 4, CITY.block + 4), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(bx, 0.015, bz);
      walk.receiveShadow = true;
      group.add(walk);
    }
  }

  // Buildings: one to four per block, taller toward the middle (downtown), each with a
  // painted facade. The garage and the bank get their own signed buildings.
  const facadeMats = [];
  for (let i = 0; i < 8; i += 1) {
    const base = '#' + PALETTE.building[i % PALETTE.building.length].toString(16).padStart(6, '0');
    facadeMats.push(new THREE.MeshLambertMaterial({ map: facadeTexture(rng, base, rangeInt(rng, 4, 10), rangeInt(rng, 3, 5)) }));
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const special = {
    '58,-58': { w: 26, d: 18, h: 9, sign: "DELGADO'S GARAGE", signBg: '#c23b2e', signFg: '#ffe9a8' },
    '0,58': { w: 24, d: 20, h: 26, sign: 'BAY BANK', signBg: '#2e4a6b', signFg: '#ffe9a8' },
  };

  function addBuilding(x, z, w, d, h, mat, sign) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w + 0.6, 0.5, d + 0.6);
    roof.position.set(x, h + 0.25, z);
    group.add(roof);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    if (sign) {
      const tex = signTexture(sign.text, sign.bg, sign.fg);
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w + 4, 26), 4.6),
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      signMesh.position.set(x, h + 3.4, z + d / 2 + 0.3);
      group.add(signMesh);
    }
    return mesh;
  }

  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const key = `${bx},${bz}`;
      const dist = Math.sqrt(bx * bx + bz * bz);
      if (special[key]) {
        const sp = special[key];
        addBuilding(bx, bz, sp.w, sp.d, sp.h, pick(rng, facadeMats), { text: sp.sign, bg: sp.signBg, fg: sp.signFg });
        continue;
      }
      const count = rangeInt(rng, 1, 3);
      for (let n = 0; n < count; n += 1) {
        const w = range(rng, 12, 20);
        const d = range(rng, 12, 20);
        const h = Math.max(7, range(rng, 8, 46) * (1 - dist / 420) + range(rng, 0, 8));
        const ox = (n % 2 === 0 ? -1 : 1) * range(rng, 2, 9);
        const oz = (n < 2 ? -1 : 1) * range(rng, 2, 9);
        addBuilding(bx + ox, bz + oz, w, d, h, pick(rng, facadeMats), null);
      }
    }
  }

  // Streetlights at every other intersection.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const lampGeo = new THREE.SphereGeometry(0.35, 8, 6);
  for (let i = 0; i < streets.length; i += 2) {
    for (let j = 0; j < streets.length; j += 2) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(streets[i] + 8, 3, streets[j] + 8);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(streets[i] + 8, 6.2, streets[j] + 8);
      group.add(lamp);
    }
  }

  // Beach, boardwalk and the bay to the south.
  const sandMat = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 220, 34), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.beachZ + 8);
  sand.receiveShadow = true;
  group.add(sand);
  const oceanMat = new THREE.MeshLambertMaterial({ color: PALETTE.ocean });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 220, 180), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, CITY.oceanZ + 60);
  group.add(ocean);
  const boardMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 220, 8), boardMat);
  board.rotation.x = -Math.PI / 2;
  board.position.set(0, 0.03, CITY.beachZ - 10);
  board.receiveShadow = true;
  group.add(board);

  // Palms along the boardwalk.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3a });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const crownGeo = new THREE.SphereGeometry(2.2, 8, 6);
  for (let x = -190; x <= 190; x += 24) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x + range(rng, -3, 3), 3.5, CITY.beachZ - 4);
    trunk.castShadow = true;
    group.add(trunk);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.scale.y = 0.55;
    crown.position.set(trunk.position.x, 7.4, CITY.beachZ - 4);
    crown.castShadow = true;
    group.add(crown);
    colliders.push({ minX: trunk.position.x - 0.5, maxX: trunk.position.x + 0.5, minZ: CITY.beachZ - 4.5, maxZ: CITY.beachZ - 3.5 });
  }

  // Marina pier at the west end of the beach, with two little boats.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const pier = new THREE.Mesh(new THREE.PlaneGeometry(10, 46), pierMat);
  pier.rotation.x = -Math.PI / 2;
  pier.position.set(-116, 0.25, CITY.beachZ + 28);
  group.add(pier);
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  for (const bx of [-126, -106]) {
    const hull = new THREE.Mesh(boxGeo, hullMat);
    hull.scale.set(4, 1.6, 10);
    hull.position.set(bx, 0.4, CITY.beachZ + 42);
    group.add(hull);
    const cabin = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2e6fc2 }));
    cabin.scale.set(2.6, 1.4, 4);
    cabin.position.set(bx, 1.8, CITY.beachZ + 42);
    group.add(cabin);
  }

  // The north bridge gate: two pillars and a beam where the last ride ends.
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x8d9299 });
  for (const px of [-9, 9]) {
    const pillar = new THREE.Mesh(boxGeo, pillarMat);
    pillar.scale.set(2.4, 12, 2.4);
    pillar.position.set(px, 6, -203);
    pillar.castShadow = true;
    group.add(pillar);
    colliders.push({ minX: px - 1.2, maxX: px + 1.2, minZ: -204.2, maxZ: -201.8 });
  }
  const beam = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
  beam.scale.set(21, 1.6, 2);
  beam.position.set(0, 12.4, -203);
  group.add(beam);

  // Intersections (the road graph's nodes) and parking / pedestrian spawn points.
  const nodes = [];
  for (const sx of streets) for (const sz of streets) nodes.push({ x: sx, z: sz });
  const parked = [];
  const pedSpawns = [];
  for (let i = 0; i < 26; i += 1) {
    const s = pick(rng, streets);
    const along = range(rng, -HALF + 20, HALF - 20);
    const horizontal = rng() < 0.5;
    const px = horizontal ? along : s + (rng() < 0.5 ? 5.4 : -5.4);
    const pz = horizontal ? s + (rng() < 0.5 ? 5.4 : -5.4) : along;
    parked.push({ x: px, z: pz, angle: horizontal ? 0 : Math.PI / 2 });
  }
  for (let i = 0; i < 30; i += 1) {
    const s = pick(rng, streets);
    const along = range(rng, -HALF + 10, HALF - 10);
    if (rng() < 0.5) pedSpawns.push({ x: along, z: s + 8.5 });
    else pedSpawns.push({ x: s + 8.5, z: along });
  }

  return { group, colliders, streets, nodes, parked, pedSpawns };
}
