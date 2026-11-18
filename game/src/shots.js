// The screenshot scenes behind ?shot=start|play|chase|end. Each one builds a real game
// state from the seed — a title over a living city, a drive with a wanted level and police
// on the tail, a four-star chase through an intersection, the story-complete screen at the
// bridge — then steps the simulation forward a few seconds with a simple autopilot, so the
// frame is what playing the game really looks like and the same seed always gives the same
// frame.

import { STEP } from './config.js';
import { createCar } from './vehicles.js';

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function driveToward(game, dt, tx, tz, waypoints) {
  const p = game.player;
  const car = p.car;
  if (!car) return { fx: 0, fz: 0, run: false, throttle: 0, steer: 0, handbrake: false, enter: false, shoot: false, reload: false };
  let target = waypoints[0];
  while (waypoints.length > 1 && Math.hypot(target[0] - car.x, target[1] - car.z) < 8) {
    waypoints.shift();
    target = waypoints[0];
  }
  const dist = Math.hypot(target[0] - car.x, target[1] - car.z);
  const want = Math.atan2(target[0] - car.x, target[1] - car.z);
  const steer = Math.max(-1, Math.min(1, angleDiff(car.angle, want) * 2.2));
  // Slow for the corner so the turn fits the street, and for a sharp turn.
  let throttle = dist < 20 ? 0.45 : 1;
  if (Math.abs(steer) > 0.7) throttle = Math.min(throttle, 0.5);
  return { fx: 0, fz: 0, run: false, throttle, steer, handbrake: false, enter: false, shoot: false, reload: false };
}

/** Manhattan waypoints to the target: along the street the car is on, then the cross
 * street, so the autopilot drives on roads instead of cutting through blocks. */
function roadWaypoints(game, tx, tz) {
  const p = game.player;
  const streets = game.city.streets;
  const nearest = (v) => streets.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const onZ = Math.abs(nearest(p.z) - p.z) < 7;
  const onX = Math.abs(nearest(p.x) - p.x) < 7;
  if (onZ && !onX) return [[tx, nearest(p.z)], [tx, tz]];
  if (onX) return [[nearest(p.x), tz], [tx, tz]];
  return [[tx, tz]];
}

function idleInput() {
  return { fx: 0, fz: 0, run: false, throttle: 0, steer: 0, handbrake: false, enter: false, shoot: false, reload: false };
}

function putPlayerInCar(game, x, z, angle) {
  // Take the nearest car where it stands (a parked or traffic car on a road) and point
  // it the way the scene needs; never teleport it into a block.
  const car = game.nearestCar(x, z, 400);
  if (!car) return null;
  car.angle = angle;
  car.speed = 0;
  car.kind = 'player';
  const p = game.player;
  p.onFoot = false;
  p.car = car;
  p.x = car.x;
  p.z = car.z;
  p.angle = angle;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = angle;
  return car;
}

function chaseCamera(renderer, game) {
  const p = game.player;
  const fx = Math.sin(p.angle);
  const fz = Math.cos(p.angle);
  renderer.setFixed(
    [p.x - fx * 15, 7.2, p.z - fz * 15],
    [p.x + fx * 10, 1.5, p.z + fz * 10],
  );
}

/** Park police cars where the chase camera can see them: a pair on the player's tail
 * and, for a big chase, a pair coming up the road ahead. Placed after the simulation
 * steps so they hold their marks for the frame. */
function stagePolice(game, offsets) {
  const p = game.player;
  const fx = Math.sin(p.angle);
  const fz = Math.cos(p.angle);
  const rx = Math.cos(p.angle);
  const rz = -Math.sin(p.angle);
  for (const [back, side, flip] of offsets) {
    const car = createCar('police', p.x - fx * back + rx * side, p.z - fz * back + rz * side, flip ? p.angle + Math.PI : p.angle, 0x111114, true);
    car.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    game.cars.push(car);
    game.group.add(car.mesh);
  }
}

/**
 * Set the game to the named scene and return the screen to show over it. Any other name
 * stages the title.
 */
export function stageShot(name, game, renderer) {
  if (name === 'play' || name === 'chase') {
    const isChase = name === 'chase';
    game.newGame();
    game.state.cash = isChase ? 2150 : 1250;
    game.startMission(isChase ? 2 : 1);
    if (isChase) game.state.objectiveIndex = 2;
    const car = putPlayerInCar(game, isChase ? -30 : 0, isChase ? 30 : -116, isChase ? Math.PI / 2 : -Math.PI / 2);
    game.state.wanted = isChase ? 4 : 2;
    game.state.crimeTimer = 0;
    if (car) car.health = isChase ? 55 : 100;
    const obj = game.objectivePos();
    const tx = obj ? obj.x : 0;
    const tz = obj ? obj.z : 0;
    const waypoints = roadWaypoints(game, tx, tz);
    for (let i = 0; i < 3.5 / STEP; i += 1) {
      game.update(STEP, driveToward(game, STEP, tx, tz, waypoints));
      if (game.state.mode !== 'play') break;
    }
    game.state.messageT = 0;
    stagePolice(game, isChase
      ? [[11, -7, false], [13, 7, false], [-16, 5, true], [-24, -5, true]]
      : [[11, -7, false], [13, 7, false]]);
    chaseCamera(renderer, game);
    renderer.showScreen(null);
    return { screen: 'play' };
  }
  if (name === 'end') {
    game.newGame();
    game.state.cash = 3050;
    game.state.stats = { stolen: 6, shots: 24, hits: 17, missionsDone: 4 };
    // The getaway car waits on the bridge road itself, facing north.
    const car = game.nearestCar(6, -192, 400);
    if (car) {
      car.x = 6;
      car.z = -192;
      car.angle = Math.PI;
      car.speed = 0;
      car.health = 62;
      car.kind = 'parked';
      car.mesh.position.set(6, 0, -192);
      car.mesh.rotation.y = Math.PI;
    }
    game.player.onFoot = true;
    game.player.car = null;
    game.player.x = -5;
    game.player.z = -190;
    game.player.angle = Math.PI;
    game.state.mode = 'complete';
    document.getElementById('complete-stats').textContent =
      'Cash: $3050 · Missions done: 4 · Cars stolen: 6 · Shot accuracy: 71%';
    renderer.setFixed([6, 3.6, -180], [0, 2.5, -200]);
    renderer.showScreen('complete');
    return { screen: 'complete' };
  }
  // Title: let the city live for a few seconds, then frame it from above the beach,
  // looking north across the boardwalk into downtown.
  game.newGame();
  game.state.mode = 'play';
  for (let i = 0; i < 3 / STEP; i += 1) game.update(STEP, idleInput());
  game.state.mode = 'title';
  game.player.x = 0;
  game.player.z = -20;
  renderer.setFixed([110, 75, 265], [0, 8, -50]);
  renderer.showScreen('title');
  return { screen: 'title' };
}
