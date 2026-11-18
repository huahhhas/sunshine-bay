// Pedestrians: small box-built people who stroll the sidewalks, cross at intersections
// and run away from gunfire or a speeding car. Hitting one is a crime — the wanted system
// notices — so the player learns to mind the crosswalks.

import { CITY } from './config.js';
import { pick, range } from './random.js';

export function makePersonMesh(shirtColor, skinColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor || 0xd8a077 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3040 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.24);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.16, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.16, 0.36, 0);
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.18);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.42, 1.1, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.42, 1.1, 0);
  group.add(armR);
  group.userData = { legL, legR, armL, armR, walkPhase: Math.random() * 6 };
  return group;
}

export function createPed(x, z, shirtColor) {
  const mesh = makePersonMesh(shirtColor);
  mesh.position.set(x, 0, z);
  return {
    mesh,
    x,
    z,
    angle: Math.random() * Math.PI * 2,
    speed: range(Math.random, 1.1, 1.8),
    target: null,
    fleeing: 0,
    down: 0,
    walkPhase: Math.random() * 6,
  };
}

function pickTarget(ped, city, rng) {
  const spot = pick(rng, city.pedSpawns);
  return { x: spot.x, z: spot.z };
}

export function updatePed(ped, dt, city, rng, danger) {
  if (ped.down > 0) {
    ped.down -= dt;
    ped.mesh.rotation.x = Math.min(Math.PI / 2, ped.mesh.rotation.x + dt * 4);
    if (ped.down <= 0) {
      ped.mesh.rotation.x = 0;
      ped.x = pick(rng, city.pedSpawns).x;
      ped.z = pick(rng, city.pedSpawns).z;
    }
    return;
  }
  if (danger) ped.fleeing = 2.5;
  if (!ped.target) ped.target = pickTarget(ped, city, rng);
  const dx = ped.target.x - ped.x;
  const dz = ped.target.z - ped.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1.2) {
    ped.target = null;
    return;
  }
  const speed = ped.fleeing > 0 ? 4.2 : ped.speed;
  if (ped.fleeing > 0) ped.fleeing -= dt;
  ped.angle = Math.atan2(dx, dz);
  ped.x += (dx / dist) * speed * dt;
  ped.z += (dz / dist) * speed * dt;
  ped.walkPhase += dt * speed * 3.2;
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = ped.angle;
  const swing = Math.sin(ped.walkPhase) * 0.5;
  ped.mesh.userData.legL.rotation.x = swing;
  ped.mesh.userData.legR.rotation.x = -swing;
  ped.mesh.userData.armL.rotation.x = -swing * 0.8;
  ped.mesh.userData.armR.rotation.x = swing * 0.8;
}

export function knockDown(ped) {
  ped.down = 4;
  ped.fleeing = 0;
}
