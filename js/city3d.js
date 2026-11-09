import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

/* ═══════════════════════════════════════════════════════════════
   NIGHT CITY — a procedural neon street.
   Buildings, signs, flying cars, rain and a holo-core. No models.
   ═══════════════════════════════════════════════════════════════ */

const NEON = ["#fcee0a", "#00e5ff", "#ff2a3c", "#e9f4ff"];

function facadeTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#05080d";
  ctx.fillRect(0, 0, 128, 256);

  const colors = ["#00e5ff", "#fcee0a", "#e9f4ff", "#ff2a3c"];
  for (let y = 7; y < 250; y += 14) {
    for (let x = 7; x < 122; x += 14) {
      if (Math.random() < 0.27) {
        ctx.globalAlpha = 0.3 + Math.random() * 0.7;
        ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
        ctx.fillRect(x, y, 6, 7);
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0,229,255,0.22)";
  ctx.fillRect(2, 0, 2, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function roadTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#06090e";
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = "rgba(0,229,255,0.32)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(252,238,10,0.7)";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 30);
  return tex;
}

function signTexture(text, color) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = "700 64px Rajdhani, Arial Narrow, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 68);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(5,7,10,0.7)";
  ctx.strokeText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSign(text, color, width, height) {
  const mat = new THREE.MeshBasicMaterial({
    map: signTexture(text, color),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}

function glowDiscTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 124);
  g.addColorStop(0, "rgba(252,238,10,0.95)");
  g.addColorStop(0.35, "rgba(252,238,10,0.45)");
  g.addColorStop(0.75, "rgba(252,238,10,0.08)");
  g.addColorStop(1, "rgba(252,238,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCar(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.24, 1.9),
    new THREE.MeshBasicMaterial({ color: 0x070b10 })
  );
  group.add(body);

  const lightMat = new THREE.MeshBasicMaterial({ color });
  const front = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lightMat);
  front.position.set(0, 0, 1);
  group.add(front);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lightMat);
  back.position.set(0, 0, -1);
  group.add(back);

  const under = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.04, 1.2),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff })
  );
  under.position.y = -0.14;
  group.add(under);

  return group;
}

export function initCity(canvas, { reduced = false } = {}) {
  const mobile = window.innerWidth < 760;
  const maxDpr = 1;
  const targetFps = mobile ? 45 : 60;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setClearColor(0x05070a, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.fog = new THREE.FogExp2(0x05070a, 0.016);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 340);
  camera.position.set(0, 2.5, 18);
  scene.add(camera);

  /* ── road ────────────────────────────────────────────────── */
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 340),
    new THREE.MeshBasicMaterial({ map: roadTexture(), fog: true })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -100);
  scene.add(road);

  [-8.6, 8.6].forEach((x) => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.05, 340),
      new THREE.MeshBasicMaterial({ color: x < 0 ? 0x00e5ff : 0x00e5ff })
    );
    strip.position.set(x, 0.06, -100);
    scene.add(strip);
  });

  /* ── buildings ───────────────────────────────────────────── */
  const facades = [facadeTexture(), facadeTexture(), facadeTexture()];
  const buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  for (let z = 12; z > -250; z -= mobile ? 16 : 11) {
    [-1, 1].forEach((side) => {
      const count = mobile ? 1 : 1 + ((Math.random() * 2) | 0);
      for (let i = 0; i < count; i++) {
        const w = 5 + Math.random() * 8;
        const d = 8 + Math.random() * 12;
        const h = 8 + Math.random() * 40;
        const x = side * (9.5 + Math.random() * 12 + i * 4);
        const zz = z - Math.random() * 5;

        const tex = facades[(Math.random() * facades.length) | 0].clone();
        tex.needsUpdate = true;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 5)));

        const mat = new THREE.MeshBasicMaterial({ map: tex, fog: true });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        building.position.set(x, h / 2, zz);
        buildingGroup.add(building);

        if (Math.random() < 0.55) {
          const neonColor = new THREE.Color(NEON[(Math.random() * NEON.length) | 0]);
          const edge = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, h * 0.94, 0.12),
            new THREE.MeshBasicMaterial({ color: neonColor })
          );
          edge.position.set(x - side * (w / 2), h / 2, zz + d / 2);
          buildingGroup.add(edge);
        }
      }
    });
  }

  /* ── signs ───────────────────────────────────────────────── */
  const signWords = ["NIGHT SHIFT", "BD-2077", "SYNAPSE", "247", "CHROME", "GHOST", "NETRUNNER", "RELIC", "ZERO DAY"];
  const signs = [];
  signWords.forEach((word, i) => {
    const color = NEON[i % NEON.length];
    const sign = makeSign(word, color, 8 + Math.random() * 4, 2.4);
    const side = i % 2 === 0 ? -1 : 1;
    sign.position.set(side * 9.1, 9 + Math.random() * 15, 4 - i * 13);
    sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    sign.userData.phase = Math.random() * 10;
    signs.push(sign);
    scene.add(sign);
  });

  /* ── sky / 2077 ──────────────────────────────────────────── */
  const moon = new THREE.Mesh(
    new THREE.PlaneGeometry(58, 58),
    new THREE.MeshBasicMaterial({
      map: glowDiscTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
  );
  moon.position.set(-12, 34, -185);
  scene.add(moon);

  const skySign = makeSign("2077", "#fcee0a", 34, 8.5);
  skySign.position.set(18, 26, -160);
  skySign.material.opacity = 0.9;
  scene.add(skySign);

  /* ── holo-core ──────────────────────────────────────────── */
  const holo = new THREE.Group();
  holo.position.set(13, 24, -64);
  holo.scale.setScalar(1.15);
  scene.add(holo);

  const holoWire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(7.2, 1)),
    new THREE.LineBasicMaterial({ color: 0xfcee0a, transparent: true, opacity: 0.6 })
  );
  holo.add(holoWire);

  const holoInner = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(4, 0)),
    new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.65 })
  );
  holo.add(holoInner);

  [10.8, 12.8].forEach((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.055, 4, 140),
      new THREE.MeshBasicMaterial({
        color: i === 0 ? 0x00e5ff : 0xfcee0a,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ring.rotation.x = i === 0 ? Math.PI / 2.2 : Math.PI / 1.7;
    holo.add(ring);
  });

  /* ── flying cars ─────────────────────────────────────────── */
  const cars = [];
  const carCount = mobile ? 5 : 7;
  for (let i = 0; i < carCount; i++) {
    const car = makeCar(NEON[i % NEON.length]);
    car.position.set(-30 + Math.random() * 60, 8 + Math.random() * 18, -5 - Math.random() * 120);
    car.userData.speed = 0.08 + Math.random() * 0.18;
    car.userData.dir = Math.random() < 0.5 ? -1 : 1;
    car.userData.baseY = car.position.y;
    car.userData.phase = Math.random() * 10;
    cars.push(car);
    scene.add(car);
  }

  /* ── rain ────────────────────────────────────────────────── */
  const rainCount = mobile ? 450 : 800;
  const rainPositions = new Float32Array(rainCount * 3);
  const rainSpeeds = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 60;
    rainPositions[i * 3 + 1] = Math.random() * 42;
    rainPositions[i * 3 + 2] = 20 - Math.random() * 220;
    rainSpeeds[i] = 0.25 + Math.random() * 0.5;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.075,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    })
  );
  scene.add(rain);

  /* ── composer ────────────────────────────────────────────── */
  let composer = null;
  let bloom = null;
  if (!mobile) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.55, 0.22);
      composer.addPass(bloom);
    } catch (error) {
      composer = null;
      console.warn("Bloom unavailable, rendering direct:", error);
    }
  }

  /* ── state ───────────────────────────────────────────────── */
  let progress = 0;
  let eased = 0;
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;
  let raf = null;
  let running = false;
  let lastFrame = 0;
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(1);
      composer.setSize(Math.max(1, Math.floor(w * 0.72)), Math.max(1, Math.floor(h * 0.72)));
    }
    if (reduced) render(clock.getElapsedTime());
  }

  function render(t) {
    const p = eased;

    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    camera.position.x = mouseX * 1.1;
    camera.position.y = 2.5 + Math.sin(p * 2.3) * 0.55 + mouseY * 0.4;
    camera.position.z = 18 - p * 82;
    camera.lookAt(mouseX * 0.5, 2.8 + p * 0.4, camera.position.z - 40);

    holo.rotation.y = t * 0.13 + p * 1.6;
    holo.rotation.x = Math.sin(t * 0.22) * 0.2;
    holoInner.rotation.y = -t * 0.22;
    holoInner.rotation.z = t * 0.1;

    signs.forEach((sign, i) => {
      sign.material.opacity = 0.65 + Math.sin(t * 1.6 + sign.userData.phase + i) * 0.25;
    });

    cars.forEach((car) => {
      car.position.x += car.userData.speed * car.userData.dir;
      if (car.position.x > 32) car.position.x = -32;
      if (car.position.x < -32) car.position.x = 32;
      car.position.y = car.userData.baseY + Math.sin(t * 0.8 + car.userData.phase) * 0.35;
    });

    const positions = rain.geometry.attributes.position.array;
    for (let i = 0; i < rainCount; i++) {
      positions[i * 3 + 1] -= rainSpeeds[i];
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 42;
        positions[i * 3] = (Math.random() - 0.5) * 60;
      }
    }
    rain.geometry.attributes.position.needsUpdate = true;

    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  function loop(now) {
    raf = null;
    if (!running) return;
    raf = requestAnimationFrame(loop);

    // Cap the 3D to 45fps desktop / 30fps mobile. The HTML/CSS motion
    // still runs at the display refresh rate.
    if (now - lastFrame < 1000 / targetFps) return;
    lastFrame = now;

    eased += (progress - eased) * 0.06;
    render(clock.getElapsedTime());
  }

  function start() {
    if (reduced || running) return;
    running = true;
    clock.start();
    lastFrame = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function setActive(active) {
    if (active) start();
    else stop();
  }

  function setProgress(value) {
    progress = Math.min(1, Math.max(0, value));
    if (reduced) {
      eased = progress;
      render(clock.getElapsedTime());
    }
  }

  function onPointer(event) {
    if (event.pointerType === "touch") return;
    targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
    targetMouseY = (event.clientY / window.innerHeight) * 2 - 1;
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  resize();
  eased = reduced ? 0.1 : 0;
  render(0);
  if (!reduced) start();

  return {
    setProgress,
    setActive,
    destroy() {
      stop();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      if (composer) composer.dispose();
    },
  };
}
