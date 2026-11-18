// Cars: a box-built body with a cabin, four wheels, headlights and taillights, plus the
// arcade driving and the two AIs that use it — traffic that follows the road graph, and
// police that chase the player and ram. A car is two circles (front and back) for collisions,
// which keeps it from clipping through building corners.

import { CAR, CITY } from './config.js';
import { pick, range } from './random.js';

const WHEEL_R = 0.42;

export function makeCarMesh(color, police) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc7e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.18, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111214 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, WHEEL_R, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const lx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    light.position.set(lx, 0.66, 2.21);
    group.add(light);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xe53b2e });
  for (const lx of [-0.6, 0.6]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1), tailMat);
    tail.position.set(lx, 0.66, -2.21);
    group.add(tail);
  }
  let lightbar = null;
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.5), darkMat);
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.28, 1.55, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.52), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(0.28, 1.55, -0.2);
    group.add(blue);
    lightbar = { red, blue };
  }
  group.userData.wheels = wheels;
  group.userData.lightbar = lightbar;
  return group;
}

export function createCar(kind, x, z, angle, color, police) {
  const mesh = makeCarMesh(color, police);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  return {
    kind,
    mesh,
    x,
    z,
    angle,
    speed: 0,
    health: CAR.health,
    police: !!police,
    target: null,
    stuck: 0,
    sirenPhase: Math.random() * 10,
    flash: 0,
    smoke: 0,
  };
}

function angleTo(x, z, tx, tz) {
  return Math.atan2(tx - x, tz - z);
}

function turnToward(angle, target, maxTurn) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxTurn) return target;
  return angle + Math.sign(diff) * maxTurn;
}

function moveCar(car, dt, speed) {
  car.x += Math.sin(car.angle) * speed * dt;
  car.z += Math.cos(car.angle) * speed * dt;
  car.speed = speed;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  const spin = speed * dt / WHEEL_R;
  for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += spin;
}

/** Traffic: pick a random neighbouring intersection, drive to it down the street, repeat. */
export function updateTraffic(car, dt, city, aheadBlocked, rng) {
  if (!car.target) {
    const options = city.nodes.filter((n) => {
      const dx = Math.abs(n.x - car.x);
      const dz = Math.abs(n.z - car.z);
      return (dx < 2 && dz > 20) || (dz < 2 && dx > 20);
    });
    car.target = options.length > 0 ? pick(rng, options) : { x: 0, z: 0 };
  }
  const targetAngle = angleTo(car.x, car.z, car.target.x, car.target.z);
  car.angle = turnToward(car.angle, targetAngle, 2.4 * dt);
  const dist = Math.hypot(car.target.x - car.x, car.target.z - car.z);
  let speed = CAR.trafficSpeed;
  if (aheadBlocked) speed = Math.max(0, speed - 14 * dt * 60 * 0.016);
  if (dist < 4) {
    car.target = null;
    speed = CAR.trafficSpeed * 0.4;
  }
  // Stay in the right-hand lane: nudge toward the lane offset of the current street.
  moveCar(car, dt, speed);
}

/** Police: steer hard at the player and ram; faster than traffic, slower at high wanted. */
export function updatePolice(car, dt, px, pz, wanted) {
  const targetAngle = angleTo(car.x, car.z, px, pz);
  car.angle = turnToward(car.angle, targetAngle, 3.2 * dt);
  const dist = Math.hypot(px - car.x, pz - car.z);
  const top = Math.min(CAR.policeSpeed, 30 + wanted * 2.4);
  const speed = dist < 6 ? top * 0.55 : top;
  moveCar(car, dt, speed);
  car.flash += dt;
  const bar = car.mesh.userData.lightbar;
  if (bar) {
    const on = Math.floor(car.flash * 4) % 2 === 0;
    bar.red.material.color.setHex(on ? 0xff2222 : 0x550000);
    bar.blue.material.color.setHex(on ? 0x111155 : 0x2244ff);
  }
  car.sirenPhase += dt;
}

/** The player's arcade driving: throttle, brake/reverse, steering that bites with speed. */
export function drivePlayer(car, dt, throttle, steer, handbrake) {
  const forward = throttle > 0 ? 1 : throttle < 0 ? -1 : 0;
  if (forward !== 0) {
    car.speed += forward * (throttle > 0 ? CAR.accel * throttle : CAR.brake) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 10 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  const max = car.speed >= 0 ? CAR.maxSpeed : CAR.maxReverse;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (Math.abs(car.speed) > 0.5) {
    const grip = handbrake ? 0.45 : 1;
    car.angle += steer * CAR.steer * grip * dt * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed);
  }
  moveCar(car, dt, car.speed);
  return Math.abs(car.speed) / CAR.maxSpeed;
}

export function carCircles(car) {
  const fx = Math.sin(car.angle) * 1.1;
  const fz = Math.cos(car.angle) * 1.1;
  return [
    { x: car.x + fx, z: car.z + fz, r: 1.25 },
    { x: car.x - fx, z: car.z - fz, r: 1.25 },
  ];
}

export function randomCarColor(rng) {
  return pick(rng, [0xc23b2e, 0x2e6fc2, 0x3fae5a, 0xe0a92e, 0x8a5ac2, 0xd8d8d8, 0x222226, 0xe07a2e, 0x2ea8a0]);
}
