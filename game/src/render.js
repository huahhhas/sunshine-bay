// Drawing only: the three.js scene, the chase camera, and the DOM HUD (cash, wanted stars,
// health, ammo, speed, mission text, minimap, toasts and the screens). The world owns the
// state; this file only paints what is there.

import { CITY, PLAYER } from './config.js';
import { makePersonMesh } from './people.js';

const MINIMAP = 176;

export function createRenderer(game) {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ec9ee);
  scene.fog = new THREE.Fog(0x9fc7e8, 180, 520);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a6a4a, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
  sun.position.set(140, 220, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(game.group);

  // The player on foot, and the mission beacon (a light pillar and a pulsing ring).
  const playerMesh = makePersonMesh(0xe0a92e, 0xc98a5a);
  scene.add(playerMesh);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), beaconMat);
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.2, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.5 });
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), smokeMat);
  smoke.visible = false;
  scene.add(smoke);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  const cam = { yaw: 0.6, pitch: 0.42, dist: 11, tx: 0, tz: 0, fixed: null };

  const hud = {
    cash: document.getElementById('cash'),
    stars: document.getElementById('stars'),
    healthFill: document.getElementById('health-fill'),
    ammo: document.getElementById('ammo'),
    speed: document.getElementById('speed'),
    missionTitle: document.getElementById('mission-title'),
    missionText: document.getElementById('mission-text'),
    objectiveDist: document.getElementById('objective-dist'),
    toast: document.getElementById('toast'),
    prompt: document.getElementById('prompt'),
    crosshair: document.getElementById('crosshair'),
    vignette: document.getElementById('vignette'),
    arrow: document.getElementById('waypoint-arrow'),
  };
  const minimap = document.getElementById('minimap');
  const mctx = minimap.getContext('2d');
  const screens = {
    title: document.getElementById('screen-title'),
    paused: document.getElementById('screen-pause'),
    over: document.getElementById('screen-over'),
    busted: document.getElementById('screen-busted'),
    complete: document.getElementById('screen-complete'),
  };

  let lastHealth = PLAYER.health;
  let flashT = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      screens[key].classList.toggle('hidden', key !== name);
    }
  }

  function drawMinimap() {
    const s = MINIMAP;
    const scale = s / (CITY.half * 2 + 40);
    const ox = s / 2;
    const oz = s / 2;
    const px = (x) => ox + x * scale;
    const pz = (z) => oz + z * scale;
    mctx.fillStyle = '#10141b';
    mctx.fillRect(0, 0, s, s);
    mctx.fillStyle = '#1e6f9e';
    mctx.fillRect(0, pz(CITY.beachZ), s, s - pz(CITY.beachZ));
    mctx.fillStyle = '#e3cf9e';
    mctx.fillRect(0, pz(CITY.beachZ - 8), s, pz(CITY.beachZ) - pz(CITY.beachZ - 8));
    mctx.strokeStyle = '#3a3f46';
    mctx.lineWidth = 5;
    for (const st of game.city.streets) {
      mctx.beginPath();
      mctx.moveTo(px(-CITY.half), pz(st));
      mctx.lineTo(px(CITY.half), pz(st));
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(px(st), pz(-CITY.half));
      mctx.lineTo(px(st), pz(CITY.half));
      mctx.stroke();
    }
    const obj = game.objectivePos();
    if (obj && game.state.mode === 'play') {
      const pulse = 3 + Math.sin(game.state.time * 5) * 1.5;
      mctx.fillStyle = '#ffd23e';
      mctx.beginPath();
      mctx.arc(px(obj.x), pz(obj.z), pulse + 3, 0, Math.PI * 2);
      mctx.fill();
    }
    for (const car of game.cars) {
      if (car.kind === 'police') {
        mctx.fillStyle = '#ff4444';
        mctx.beginPath();
        mctx.arc(px(car.x), pz(car.z), 3, 0, Math.PI * 2);
        mctx.fill();
      } else if (car.kind === 'traffic') {
        mctx.fillStyle = '#9aa3ad';
        mctx.fillRect(px(car.x) - 1.5, pz(car.z) - 1.5, 3, 3);
      }
    }
    const p = game.player;
    mctx.save();
    mctx.translate(px(p.x), pz(p.z));
    mctx.rotate(Math.atan2(Math.sin(p.angle), Math.cos(p.angle)) + Math.PI);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -6);
    mctx.lineTo(4.5, 5);
    mctx.lineTo(-4.5, 5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  function updateHud(dt) {
    const st = game.state;
    const p = game.player;
    document.getElementById('hud').style.visibility = st.mode === 'play' || st.mode === 'paused' ? 'visible' : 'hidden';
    hud.cash.textContent = `$${st.cash}`;
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < st.wanted ? '★' : '☆';
    hud.stars.textContent = stars;
    hud.stars.classList.toggle('hot', st.wanted > 0);
    hud.healthFill.style.width = `${Math.max(0, p.health)}%`;
    hud.healthFill.classList.toggle('low', p.health < 30);
    hud.ammo.textContent = p.onFoot ? `Ammo ${p.mag} / ∞` : '';
    hud.speed.textContent = p.onFoot ? '' : `${Math.round(Math.abs(p.car ? p.car.speed : 0) * 3.2)} mph`;
    const m = game.mission();
    const o = game.objective();
    hud.missionTitle.textContent = m ? `${m.title} — $${m.reward}` : '';
    hud.missionText.textContent = o ? o.text : '';
    const obj = game.objectivePos();
    hud.objectiveDist.textContent = obj && st.mode === 'play' ? `${Math.round(Math.hypot(obj.x - p.x, obj.z - p.z))} m` : '';
    if (st.messageT > 0) {
      hud.toast.textContent = st.message;
      hud.toast.classList.remove('hidden');
    } else {
      hud.toast.classList.add('hidden');
    }
    if (p.health < lastHealth) flashT = 0.45;
    lastHealth = p.health;
    if (flashT > 0) flashT -= dt;
    const lowHp = p.health < 30 && st.mode === 'play' ? 0.25 + Math.sin(st.time * 6) * 0.1 : 0;
    hud.vignette.style.opacity = String(Math.min(0.85, flashT * 1.6 + lowHp));
    hud.crosshair.classList.toggle('hidden', !(p.onFoot && st.mode === 'play'));
    // The E prompt: near a car, or at a pickup marker.
    let prompt = '';
    if (st.mode === 'play' && p.onFoot) {
      const near = game.nearestCar(p.x, p.z, 3.2);
      if (o && o.type === 'pickup' && Math.hypot(o.pos[0] - p.x, o.pos[1] - p.z) < o.radius) prompt = 'Press E — grab it';
      else if (near) prompt = 'Press E — steal car';
    }
    hud.prompt.textContent = prompt;
    hud.prompt.classList.toggle('hidden', prompt === '');
    // Waypoint arrow: rotates toward the objective relative to the camera.
    if (obj && st.mode === 'play') {
      const want = Math.atan2(obj.x - p.x, obj.z - p.z);
      const rel = want - cam.yaw;
      hud.arrow.style.transform = `rotate(${rel}rad)`;
      hud.arrow.classList.remove('hidden');
    } else {
      hud.arrow.classList.add('hidden');
    }
  }

  function draw(dt) {
    const st = game.state;
    const p = game.player;
    // Sync the on-foot player mesh (also shown on the story-complete screen).
    playerMesh.visible = p.onFoot && (st.mode === 'play' || st.mode === 'paused' || st.mode === 'complete');
    if (playerMesh.visible) {
      playerMesh.position.set(p.x, 0, p.z);
      playerMesh.rotation.y = p.angle;
      const swing = p.speed > 0.1 ? Math.sin(st.time * 10) * 0.45 : 0;
      playerMesh.userData.legL.rotation.x = swing;
      playerMesh.userData.legR.rotation.x = -swing;
      playerMesh.userData.armL.rotation.x = -swing * 0.8;
      playerMesh.userData.armR.rotation.x = swing * 0.8;
      playerMesh.visible = !(p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0);
    }
    // Beacon over the objective.
    const obj = game.objectivePos();
    const showBeacon = !!obj && st.mode === 'play';
    beacon.visible = showBeacon;
    ring.visible = showBeacon;
    if (showBeacon) {
      beacon.position.set(obj.x, 30, obj.z);
      beacon.material.opacity = 0.2 + Math.sin(st.time * 3) * 0.08;
      ring.position.set(obj.x, 0.06, obj.z);
      const s = 1 + Math.sin(st.time * 3) * 0.18;
      ring.scale.set(s, s, 1);
    }
    // Smoke from a wrecked player car: a small puff over the front hood.
    const car = p.car;
    if (car && car.health < 40 && car.health > 0) {
      smoke.visible = true;
      const fx = Math.sin(car.angle) * 1.6;
      const fz = Math.cos(car.angle) * 1.6;
      smoke.position.set(car.x + fx, 1.6, car.z + fz);
      const s = 0.7 + Math.sin(st.time * 7) * 0.2;
      smoke.scale.set(s, s, s);
      smoke.material.opacity = 0.3 + Math.sin(st.time * 5) * 0.08;
    } else {
      smoke.visible = false;
    }
    // Camera.
    if (cam.fixed) {
      camera.position.set(cam.fixed.pos[0], cam.fixed.pos[1], cam.fixed.pos[2]);
      camera.lookAt(cam.fixed.look[0], cam.fixed.look[1], cam.fixed.look[2]);
    } else {
      const targetDist = p.onFoot ? 9 : 12.5;
      cam.dist += (targetDist - cam.dist) * Math.min(1, dt * 4);
      const cx = p.x - Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
      const cz = p.z - Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
      const cy = 2 + Math.sin(cam.pitch) * cam.dist;
      camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 6);
      camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 6);
      camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 6);
      camera.lookAt(p.x, 1.6, p.z);
    }
    updateHud(dt);
    drawMinimap();
    renderer.render(scene, camera);
  }

  function screenToGround(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    const vec = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = vec.sub(camera.position).normalize();
    if (Math.abs(dir.y) < 0.0001) return { x: game.player.x, z: game.player.z };
    const t = -camera.position.y / dir.y;
    return { x: camera.position.x + dir.x * t, z: camera.position.z + dir.z * t };
  }

  return {
    draw,
    showScreen,
    screenToGround,
    cameraYaw() {
      return cam.yaw;
    },
    addYaw(d) {
      cam.yaw += d;
    },
    addPitch(d) {
      cam.pitch = Math.max(0.12, Math.min(1.1, cam.pitch + d));
    },
    addZoom(d) {
      cam.dist = Math.max(6, Math.min(20, cam.dist + d));
    },
    setFixed(pos, look) {
      cam.fixed = { pos, look };
    },
    clearFixed() {
      cam.fixed = null;
    },
    snapCamera() {
      const p = game.player;
      camera.position.set(
        p.x - Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
        2 + Math.sin(cam.pitch) * cam.dist,
        p.z - Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
      );
      camera.lookAt(p.x, 1.6, p.z);
    },
  };
}
