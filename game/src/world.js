// Sunshine Bay's rules and state, with no drawing in it: the player on foot or in a car,
// traffic, pedestrians, police, the wanted level, four story missions, combat, collisions
// and the save. step() advances one fixed step; the renderer only paints what is here.

import { CAR, CITY, MISSIONS, PLAYER, SAVE_KEY, WANTED } from './config.js';
import { buildCity, isOnRoad } from './city.js';
import { carCircles, createCar, drivePlayer, randomCarColor, updatePolice, updateTraffic } from './vehicles.js';
import { createPed, knockDown, updatePed } from './people.js';
import { pick, range } from './random.js';
import { SHIRT_COLORS } from './config.js';

const TRAFFIC_COUNT = 10;
const PED_COUNT = 14;

function collideCircleBox(x, z, r, box) {
  const cx = Math.max(box.minX, Math.min(x, box.maxX));
  const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: (dx / d) * (r - d), z: (dz / d) * (r - d), depth: r - d };
  }
  // Centre inside the box: push out along the smallest penetration.
  const left = x - box.minX;
  const right = box.maxX - x;
  const top = z - box.minZ;
  const bottom = box.maxZ - z;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { x: -(r + left), z: 0, depth: r + left };
  if (min === right) return { x: r + right, z: 0, depth: r + right };
  if (min === top) return { x: 0, z: -(r + top), depth: r + top };
  return { x: 0, z: r + bottom, depth: r + bottom };
}

function resolveAgainstCity(x, z, r, colliders) {
  let px = x;
  let pz = z;
  let hit = 0;
  for (const box of colliders) {
    const push = collideCircleBox(px, pz, r, box);
    if (push) {
      px += push.x;
      pz += push.z;
      hit = Math.max(hit, push.depth);
    }
  }
  return { x: px, z: pz, hit };
}

export function createGame(rng) {
  const city = buildCity(rng);
  const group = new THREE.Group();
  group.add(city.group);

  const player = {
    x: 40, z: -40, angle: 0, onFoot: true, car: null, health: PLAYER.health,
    mag: PLAYER.magSize, reloading: 0, shootT: 0, speed: 0, invuln: 0,
  };
  const state = {
    mode: 'title',
    time: 0,
    cash: 0,
    wanted: 0,
    wantedTimer: 0,
    crimeTimer: 0,
    missionIndex: 0,
    objectiveIndex: 0,
    missionStart: { x: 40, z: -40 },
    bustTimer: 0,
    stats: { stolen: 0, shots: 0, hits: 0, missionsDone: 0 },
    message: '',
    messageT: 0,
  };
  const cars = [];
  const peds = [];
  const cops = [];
  let events = [];
  let saveData = null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw) saveData = JSON.parse(raw);
  } catch {
    saveData = null;
  }

  function emit(kind, text) {
    events.push({ kind, text });
  }

  function toast(text) {
    state.message = text;
    state.messageT = 4;
  }

  function mission() {
    return MISSIONS[state.missionIndex] || null;
  }

  function objective() {
    const m = mission();
    if (!m) return null;
    return m.objectives[state.objectiveIndex] || null;
  }

  function objectivePos() {
    const o = objective();
    if (!o) return null;
    if (o.type === 'steal') {
      const near = nearestCar(player.x, player.z, 60);
      return near ? { x: near.x, z: near.z, text: o.text } : { x: player.x, z: player.z, text: o.text };
    }
    return { x: o.pos[0], z: o.pos[1], text: o.text };
  }

  function nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.kind === 'police') continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function addWanted(n, reason) {
    if (state.wanted >= WANTED.max) return;
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    state.wantedTimer = 0;
    state.crimeTimer = 0;
    emit('wanted', reason);
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i += 1) {
      const node = pick(rng, city.nodes);
      const car = createCar('traffic', node.x + range(rng, -4, 4), node.z + range(rng, -4, 4), range(rng, 0, Math.PI * 2), randomCarColor(rng), false);
      cars.push(car);
      group.add(car.mesh);
    }
  }

  function spawnParked() {
    for (const spot of city.parked) {
      const car = createCar('parked', spot.x, spot.z, spot.angle, randomCarColor(rng), false);
      cars.push(car);
      group.add(car.mesh);
    }
  }

  function spawnPeds(count) {
    for (let i = 0; i < count; i += 1) {
      const spot = pick(rng, city.pedSpawns);
      const ped = createPed(spot.x, spot.z, pick(rng, SHIRT_COLORS));
      peds.push(ped);
      group.add(ped.mesh);
    }
  }

  function spawnPolice() {
    const want = WANTED.policePerStar[state.wanted] || 0;
    const have = cars.filter((c) => c.kind === 'police').length;
    for (let i = have; i < want; i += 1) {
      const spots = city.nodes.filter((n) => {
        const d = Math.hypot(n.x - player.x, n.z - player.z);
        return d > 55 && d < 95;
      });
      const node = spots.length > 0 ? pick(rng, spots) : pick(rng, city.nodes);
      const car = createCar('police', node.x, node.z, 0, 0x111114, true);
      car.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
      cars.push(car);
      group.add(car.mesh);
      emit('siren', '');
    }
  }

  function clearPolice() {
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      if (cars[i].kind === 'police') {
        group.remove(cars[i].mesh);
        cars.splice(i, 1);
      }
    }
    for (let i = cops.length - 1; i >= 0; i -= 1) {
      group.remove(cops[i].mesh);
      cops.splice(i, 1);
    }
  }

  function spawnCopPed() {
    const spot = pick(rng, city.nodes);
    const ped = createPed(spot.x, spot.z, 0x2244aa);
    ped.cop = true;
    ped.shootT = 1;
    cops.push(ped);
    group.add(ped.mesh);
  }

  function startMission(index) {
    state.missionIndex = index;
    state.objectiveIndex = 0;
    state.missionStart = { x: player.x, z: player.z };
    const m = mission();
    if (!m) return;
    toast(`${m.title}: ${m.briefing}`);
    emit('mission', m.title);
    if (m.id === 'the-last-ride') {
      const getaway = createCar('parked', 58, -52, Math.PI / 2, 0xc23b2e, false);
      getaway.getaway = true;
      cars.push(getaway);
      group.add(getaway.mesh);
    }
  }

  function completeObjective() {
    state.objectiveIndex += 1;
    const m = mission();
    if (state.objectiveIndex >= m.objectives.length) {
      state.cash += m.reward;
      state.stats.missionsDone += 1;
      emit('jingle', '');
      toast(`Mission complete: ${m.title} — +$${m.reward}`);
      if (state.missionIndex + 1 >= MISSIONS.length) {
        state.mode = 'complete';
        saveGame();
        return;
      }
      startMission(state.missionIndex + 1);
      saveGame();
    } else {
      emit('pickup', '');
      toast(objective().text);
    }
  }

  function enterCar(car) {
    player.onFoot = false;
    player.car = car;
    car.kind = 'player';
    car.speed = 0;
    state.stats.stolen += 1;
    addWanted(WANTED.steal, 'Grand theft auto');
    emit('engine', '');
    toast('Car stolen — the cops noticed.');
  }

  function exitCar() {
    if (!player.car) return;
    const car = player.car;
    car.kind = car.police ? 'police' : 'parked';
    car.speed = 0;
    const bx = car.x - Math.sin(car.angle) * 2.6;
    const bz = car.z - Math.cos(car.angle) * 2.6;
    const spot = resolveAgainstCity(bx, bz, PLAYER.radius, city.colliders);
    player.x = spot.x;
    player.z = spot.z;
    player.angle = car.angle;
    player.onFoot = true;
    player.car = null;
  }

  function shoot(aimX, aimZ) {
    if (!player.onFoot || player.reloading > 0 || player.shootT > 0 || state.mode !== 'play') return;
    if (player.mag <= 0) {
      player.reloading = PLAYER.reloadTime;
      emit('reload', '');
      return;
    }
    player.mag -= 1;
    player.shootT = PLAYER.shootCooldown;
    state.stats.shots += 1;
    emit('shot', '');
    const dx = aimX - player.x;
    const dz = aimZ - player.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len;
    const nz = dz / len;
    const rangeMax = 42;
    let bestD = rangeMax;
    let bestHit = null;
    function consider(x, z, radius, ref) {
      const rx = x - player.x;
      const rz = z - player.z;
      const along = rx * nx + rz * nz;
      if (along < 0 || along > bestD) return;
      const perp = Math.abs(rx * nz - rz * nx);
      if (perp < radius + 0.9) {
        bestD = along;
        bestHit = ref;
      }
    }
    for (const ped of peds) if (ped.down <= 0) consider(ped.x, ped.z, 0.7, { type: 'ped', ped });
    for (const cop of cops) if (cop.down <= 0) consider(cop.x, cop.z, 0.7, { type: 'cop', cop });
    for (const car of cars) {
      if (car === player.car) continue;
      for (const c of carCircles(car)) consider(c.x, c.z, 1.3, { type: 'car', car });
    }
    if (bestHit) {
      state.stats.hits += 1;
      if (bestHit.type === 'ped') {
        knockDown(bestHit.ped);
        addWanted(WANTED.hitPed, 'Assault');
      } else if (bestHit.type === 'cop') {
        knockDown(bestHit.cop);
        addWanted(WANTED.killCop, 'Cop down');
      } else {
        bestHit.car.health -= 25;
        emit('crash', '');
        if (bestHit.car.health <= 0 && bestHit.car.kind !== 'player') {
          bestHit.car.speed = 0;
        }
      }
    }
    if (state.wanted === 0) addWanted(WANTED.shoot, 'Shots fired');
  }

  function resetToMissionStart() {
    clearPolice();
    if (player.car) {
      player.car.kind = 'parked';
      player.car.speed = 0;
      player.car = null;
    }
    player.onFoot = true;
    player.x = state.missionStart.x;
    player.z = state.missionStart.z;
    player.health = PLAYER.health;
    player.mag = PLAYER.magSize;
    player.reloading = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.bustTimer = 0;
    state.objectiveIndex = 0;
    state.mode = 'play';
    toast(`Back to ${mission().title} — try again.`);
  }

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash,
        missionIndex: state.missionIndex,
        health: player.health,
        x: player.x,
        z: player.z,
      }));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }

  function newGame() {
    state.cash = 0;
    state.wanted = 0;
    state.missionIndex = 0;
    state.objectiveIndex = 0;
    state.stats = { stolen: 0, shots: 0, hits: 0, missionsDone: 0 };
    player.x = 40;
    player.z = -40;
    player.angle = 0;
    player.health = PLAYER.health;
    player.mag = PLAYER.magSize;
    player.onFoot = true;
    player.car = null;
    clearPolice();
    state.mode = 'play';
    startMission(0);
  }

  function continueGame() {
    if (!saveData) {
      newGame();
      return;
    }
    state.cash = saveData.cash || 0;
    player.health = saveData.health || PLAYER.health;
    player.x = saveData.x ?? 40;
    player.z = saveData.z ?? -40;
    player.onFoot = true;
    player.car = null;
    clearPolice();
    state.mode = 'play';
    startMission(Math.min(saveData.missionIndex || 0, MISSIONS.length - 1));
  }

  function update(dt, input) {
    if (state.mode !== 'play') return;
    state.time += dt;
    state.crimeTimer += dt;
    if (state.messageT > 0) state.messageT -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (player.shootT > 0) player.shootT -= dt;
    if (player.reloading > 0) {
      player.reloading -= dt;
      if (player.reloading <= 0) player.mag = PLAYER.magSize;
    }

    // Wanted: decays after 26 quiet seconds with no police close by.
    if (state.wanted > 0) {
      const nearest = nearestPoliceDist();
      if (state.crimeTimer > 8 && nearest > 45) {
        state.wantedTimer += dt;
        if (state.wantedTimer >= WANTED.decaySeconds) {
          state.wanted -= 1;
          state.wantedTimer = 0;
          if (state.wanted === 0) {
            clearPolice();
            toast('You lost the cops.');
          }
        }
      } else {
        state.wantedTimer = 0;
      }
    }
    if (state.wanted >= 3 && cops.length < 2 && Math.random() < dt * 0.25) spawnCopPed();

    // Player movement.
    if (player.onFoot) {
      const speed = input.run ? PLAYER.run : PLAYER.walk;
      const mx = input.fx;
      const mz = input.fz;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        const nx = mx / len;
        const nz = mz / len;
        const nx2 = player.x + nx * speed * dt;
        const nz2 = player.z + nz * speed * dt;
        const spot = resolveAgainstCity(nx2, nz2, PLAYER.radius, city.colliders);
        player.x = spot.x;
        player.z = spot.z;
        player.angle = Math.atan2(nx, nz);
        player.speed = speed;
      } else {
        player.speed = 0;
      }
      if (input.enter) {
        const car = nearestCar(player.x, player.z, 3.2);
        const obj = objective();
        if (obj && obj.type === 'pickup') {
          const d = Math.hypot(obj.pos[0] - player.x, obj.pos[1] - player.z);
          if (d < obj.radius) {
            completeObjective();
            if (mission() && mission().id === 'the-pickup') addWanted(2, 'Package grabbed');
            if (mission() && mission().id === 'bay-heist') addWanted(3, 'Bank robbery');
            return;
          }
        }
        if (car) enterCar(car);
      }
      if (input.shoot) shoot(input.aimX, input.aimZ);
      if (input.reload && player.mag < PLAYER.magSize && player.reloading <= 0) player.reloading = PLAYER.reloadTime;
    } else if (player.car) {
      const car = player.car;
      const ratio = drivePlayer(car, dt, input.throttle, input.steer, input.handbrake);
      player.x = car.x;
      player.z = car.z;
      player.angle = car.angle;
      player.speed = Math.abs(car.speed);
      if (input.enter) exitCar();
      if (input.shoot) emit('horn', '');
      // Car vs buildings.
      for (const c of carCircles(car)) {
        const spot = resolveAgainstCity(c.x, c.z, 1.25, city.colliders);
        if (spot.hit > 0.01) {
          const impact = Math.abs(car.speed);
          car.x += spot.x - c.x;
          car.z += spot.z - c.z;
          car.speed *= 0.35;
          if (impact > 12) {
            car.health -= 8;
            emit('crash', '');
          }
        }
      }
      if (car.health <= 0) {
        car.health = 0;
        emit('crash', '');
        toast('Your car is wrecked — get out!');
        exitCar();
      }
    }

    // Traffic.
    for (const car of cars) {
      if (car.kind === 'traffic') {
        const ahead = carAheadBlocked(car);
        updateTraffic(car, dt, city, ahead, rng);
        if (Math.hypot(car.x - player.x, car.z - player.z) > 280) {
          const node = pick(rng, city.nodes);
          car.x = node.x;
          car.z = node.z;
          car.target = null;
        }
      } else if (car.kind === 'police') {
        updatePolice(car, dt, player.x, player.z, state.wanted);
        // Ram the player.
        for (const c of carCircles(car)) {
          if (player.car) {
            for (const pc of carCircles(player.car)) {
              if (Math.hypot(c.x - pc.x, c.z - pc.z) < 2.2) {
                player.car.health -= 12 * dt;
                player.car.speed *= 1 - 0.6 * dt;
              }
            }
          } else if (Math.hypot(c.x - player.x, c.z - player.z) < 1.9 && player.invuln <= 0) {
            player.health -= 10;
            player.invuln = 1;
            emit('crash', '');
          }
        }
        // Busted: slow on foot next to a cop car, or boxed in while driving.
        if (!player.onFoot && Math.abs(player.car.speed) < 2) {
          const d = Math.hypot(car.x - player.x, car.z - player.z);
          if (d < 4) state.bustTimer += dt;
          else state.bustTimer = 0;
          if (state.bustTimer > 3) {
            state.mode = 'busted';
            emit('busted', '');
            return;
          }
        }
        if (player.onFoot && Math.hypot(car.x - player.x, car.z - player.z) < 2.6) {
          state.mode = 'busted';
          emit('busted', '');
          return;
        }
      }
    }

    // Car vs car shoves (traffic and police only; the player's car is handled above).
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        if (a.kind === 'player' || b.kind === 'player') continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d < 3.4 && d > 0.01) {
          const push = (3.4 - d) / 2;
          const nx = (a.x - b.x) / d;
          const nz = (a.z - b.z) / d;
          a.x += nx * push;
          a.z += nz * push;
          b.x -= nx * push;
          b.z -= nz * push;
        }
      }
    }

    // Pedestrians, and cars running them over.
    for (const ped of peds) {
      const danger = player.speed > 8 && Math.hypot(ped.x - player.x, ped.z - player.z) < 12;
      updatePed(ped, dt, city, rng, danger);
      if (ped.down > 0) continue;
      for (const car of cars) {
        if (car.kind === 'parked') continue;
        if (Math.abs(car.speed) < 3) continue;
        for (const c of carCircles(car)) {
          if (Math.hypot(c.x - ped.x, c.z - ped.z) < 1.5) {
            knockDown(ped);
            if (car.kind === 'player' || car.kind === 'police') addWanted(WANTED.hitPed, 'Pedestrian down');
            emit('crash', '');
            car.speed *= 0.7;
          }
        }
      }
      if (player.onFoot && player.speed >= PLAYER.run - 0.1 && Math.hypot(ped.x - player.x, ped.z - player.z) < 1.2) {
        knockDown(ped);
        addWanted(WANTED.hitPed, 'Pedestrian down');
      }
    }

    // Cop pedestrians chase and shoot.
    for (const cop of cops) {
      if (cop.down > 0) continue;
      const dx = player.x - cop.x;
      const dz = player.z - cop.z;
      const d = Math.hypot(dx, dz);
      cop.angle = Math.atan2(dx, dz);
      if (d > 3) {
        cop.x += (dx / d) * 5 * dt;
        cop.z += (dz / d) * 5 * dt;
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.angle;
      cop.shootT -= dt;
      if (d < 20 && cop.shootT <= 0) {
        cop.shootT = 1.4;
        player.health -= 6;
        emit('shot', '');
        if (player.health <= 0) {
          state.mode = 'over';
          emit('busted', '');
          return;
        }
      }
    }

    // Player health.
    if (player.health <= 0) {
      player.health = 0;
      state.mode = 'over';
      emit('busted', '');
      return;
    }
    if (player.health < PLAYER.health && state.wanted === 0) {
      player.health = Math.min(PLAYER.health, player.health + 2 * dt);
    }

    // Mission objectives.
    const obj = objective();
    if (obj) {
      if (obj.type === 'steal' && !player.onFoot) completeObjective();
      else if (obj.type === 'goto') {
        const d = Math.hypot(obj.pos[0] - player.x, obj.pos[1] - player.z);
        if (d < obj.radius) completeObjective();
      } else if (obj.type === 'escape') {
        const d = Math.hypot(obj.pos[0] - player.x, obj.pos[1] - player.z);
        const needClear = obj.wanted !== 4;
        if (d < obj.radius && (!needClear || state.wanted === 0)) completeObjective();
      }
    }

    spawnPolice();
    if (state.wanted === 0) clearPolice();
  }

  function nearestPoliceDist() {
    let best = Infinity;
    for (const car of cars) {
      if (car.kind !== 'police') continue;
      best = Math.min(best, Math.hypot(car.x - player.x, car.z - player.z));
    }
    for (const cop of cops) {
      if (cop.down > 0) continue;
      best = Math.min(best, Math.hypot(cop.x - player.x, cop.z - player.z));
    }
    return best;
  }

  function carAheadBlocked(car) {
    const fx = Math.sin(car.angle);
    const fz = Math.cos(car.angle);
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const along = dx * fx + dz * fz;
      const perp = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 9 && perp < 2.4) return true;
    }
    return false;
  }

  function takeEvents() {
    const out = events;
    events = [];
    return out;
  }

  // Build the living city once: parked cars, traffic and pedestrians.
  spawnParked();
  spawnTraffic(TRAFFIC_COUNT);
  spawnPeds(PED_COUNT);

  return {
    group,
    city,
    player,
    state,
    cars,
    peds,
    cops,
    mission,
    objective,
    objectivePos,
    startMission,
    update,
    newGame,
    continueGame,
    resetToMissionStart,
    saveGame,
    takeEvents,
    saveData,
    nearestCar,
  };
}
