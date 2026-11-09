import { setEnabled as enableAudio, beep, glitch, opticsSwitch } from "./audio.js";

/* ═══════════════════════════════════════════════════════════════
   NIGHT SHIFT — interaction layer
   ═══════════════════════════════════════════════════════════════ */

const doc = document;
const root = doc.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;
const hasGsap = typeof window.gsap !== "undefined";
const hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";
const gsap = hasGsap ? window.gsap : null;

if (hasGsap && hasScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `00:${mm}:${ss}`;
}

/* ── Day / night ────────────────────────────────────────────── */
const modeBtn = doc.getElementById("modeBtn");
const modeLabel = doc.getElementById("modeLabel");
const menuMode = doc.getElementById("menuMode");
let dayMode = root.dataset.mode === "day";

function syncModeUI() {
  if (modeLabel) modeLabel.textContent = dayMode ? "DAY" : "NIGHT";
  if (modeBtn) {
    modeBtn.setAttribute("aria-pressed", String(dayMode));
    modeBtn.setAttribute("aria-label", dayMode ? "Switch to night mode" : "Switch to day mode");
  }
  if (menuMode) menuMode.textContent = `MODE: ${dayMode ? "DAY" : "NIGHT"}`;
}

function setDayMode(value, announce = true) {
  dayMode = !!value;
  root.dataset.mode = dayMode ? "day" : "night";
  try { localStorage.setItem("bd-mode", dayMode ? "day" : "night"); } catch (e) {}
  syncModeUI();
  if (announce) beep({ freq: dayMode ? 780 : 520, dur: 0.08, type: "square", slide: dayMode ? 280 : -180 });
}

modeBtn?.addEventListener("click", () => setDayMode(!dayMode));
menuMode?.addEventListener("click", () => setDayMode(!dayMode));
syncModeUI();

/* ── Audio ──────────────────────────────────────────────────── */
const audioBtn = doc.getElementById("audioBtn");
const audioLabel = doc.getElementById("audioLabel");
const menuAudio = doc.getElementById("menuAudio");
let audioOn = false;
try { audioOn = localStorage.getItem("bd-audio") === "on"; } catch (e) {}

function syncAudioUI() {
  if (audioLabel) audioLabel.textContent = audioOn ? "ON" : "OFF";
  if (audioBtn) {
    audioBtn.setAttribute("aria-pressed", String(audioOn));
    audioBtn.setAttribute("aria-label", audioOn ? "Turn audio off" : "Turn audio on");
  }
  if (menuAudio) menuAudio.textContent = `AUDIO: ${audioOn ? "ON" : "OFF"}`;
}

function toggleAudio() {
  audioOn = !audioOn;
  enableAudio(audioOn);
  try { localStorage.setItem("bd-audio", audioOn ? "on" : "off"); } catch (e) {}
  syncAudioUI();
}

audioBtn?.addEventListener("click", toggleAudio);
menuAudio?.addEventListener("click", toggleAudio);

if (audioOn) {
  const arm = () => {
    enableAudio(true);
    syncAudioUI();
    doc.removeEventListener("pointerdown", arm);
  };
  doc.addEventListener("pointerdown", arm, { once: true });
}
syncAudioUI();

/* ── Optics ─────────────────────────────────────────────────── */
const OPTICS = [
  { id: "kiroshi", label: "KIROSHI" },
  { id: "thermal", label: "THERMAL" },
  { id: "night", label: "NV" },
];
const opticsBtn = doc.getElementById("opticsBtn");
const opticsLabel = doc.getElementById("opticsLabel");
const menuOptics = doc.getElementById("menuOptics");
let opticsIndex = OPTICS.findIndex((o) => o.id === root.dataset.optics);
if (opticsIndex < 0) opticsIndex = 0;

function applyOptics(index, announce = true) {
  opticsIndex = (index + OPTICS.length) % OPTICS.length;
  const optics = OPTICS[opticsIndex];
  root.dataset.optics = optics.id;
  try { localStorage.setItem("bd-optics", optics.id); } catch (e) {}
  if (opticsLabel) opticsLabel.textContent = optics.label;
  if (menuOptics) menuOptics.textContent = `OPTICS: ${optics.label}`;
  if (announce) opticsSwitch();
}

function cycleOptics() {
  applyOptics(opticsIndex + 1);
}

opticsBtn?.addEventListener("click", cycleOptics);
menuOptics?.addEventListener("click", cycleOptics);
applyOptics(opticsIndex, false);

/* ── Smooth scroll ──────────────────────────────────────────── */
let lenis = null;

if (!reducedMotion && typeof window.Lenis !== "undefined") {
  lenis = new window.Lenis({
    duration: 1.1,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.3,
  });

  if (hasGsap && hasScrollTrigger) {
    lenis.on("scroll", window.ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }
}

/* ── 3D city ────────────────────────────────────────────────── */
const hero = doc.getElementById("top");
const cityCanvas = doc.getElementById("city");
let city = null;

import("./city3d.js")
  .then(({ initCity }) => {
    city = initCity(cityCanvas, { reduced: reducedMotion });
    hero?.classList.add("city-ready");

    // Stop the city renderer once the hero is off screen. The rest of the
    // page uses the static CSS skyline, so there is nothing to render.
    if (hero && "IntersectionObserver" in window) {
      const cityObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => city?.setActive(entry.isIntersecting));
        },
        { threshold: 0.01 }
      );
      cityObserver.observe(hero);
    }
  })
  .catch((error) => {
    console.warn("Night City unavailable:", error);
    doc.body.classList.add("no-city");
  });

/* ── Boot sequence + hero intro ─────────────────────────────── */
const boot = doc.getElementById("boot");
const bootSkip = doc.getElementById("bootSkip");
let booted = false;
try { booted = sessionStorage.getItem("bd-booted") === "1"; } catch (e) {}
let heroPrepared = false;
let heroStarted = false;

function prepareHero() {
  if (!hasGsap || reducedMotion || heroPrepared) return;
  heroPrepared = true;
  gsap.set(".hero-title .glitch", { opacity: 0, y: 50 });
  gsap.set([".hero-copy .hud-label", ".hero-role", ".hero-tagline", ".hero-sub", ".hero-actions"], {
    opacity: 0,
    y: 22,
  });
  gsap.set(".hero-panel", { opacity: 0, x: 30 });
  gsap.set(".hero-foot", { opacity: 0 });
}

function startHero() {
  if (!hasGsap || reducedMotion || heroStarted) return;
  heroStarted = true;
  gsap.timeline({ defaults: { ease: "power3.out" } })
    .to(".hero-title .glitch", { opacity: 1, y: 0, duration: 1, stagger: 0.12 }, 0)
    .to(".hero-copy .hud-label", { opacity: 1, y: 0, duration: 0.5 }, 0.1)
    .to(".hero-role", { opacity: 1, y: 0, duration: 0.55 }, 0.42)
    .to(".hero-tagline", { opacity: 1, y: 0, duration: 0.6 }, 0.52)
    .to(".hero-sub", { opacity: 1, y: 0, duration: 0.6 }, 0.62)
    .to(".hero-actions", { opacity: 1, y: 0, duration: 0.6 }, 0.72)
    .to(".hero-panel", { opacity: 1, x: 0, duration: 0.8 }, 0.55)
    .to(".hero-foot", { opacity: 1, duration: 0.6 }, 0.85);
}

function finishBoot() {
  if (!boot || boot.hidden) {
    startHero();
    return;
  }
  boot.classList.add("is-done");
  try { sessionStorage.setItem("bd-booted", "1"); } catch (e) {}
  doc.body.classList.remove("boot-open");
  if (lenis) lenis.start();
  window.setTimeout(() => {
    boot.hidden = true;
    boot.classList.remove("is-done");
  }, 380);
  startHero();
}

if (!reducedMotion && !booted && boot) {
  boot.hidden = false;
  doc.body.classList.add("boot-open");
  if (lenis) lenis.stop();
  prepareHero();

  const timer = window.setTimeout(finishBoot, 1900);
  const skip = () => {
    window.clearTimeout(timer);
    finishBoot();
  };

  bootSkip?.addEventListener("click", skip);
  boot.addEventListener("click", (event) => {
    if (event.target === boot) skip();
  });
  const onBootKey = (event) => {
    if (event.key === "Escape" || event.key === "Enter") {
      doc.removeEventListener("keydown", onBootKey);
      skip();
    }
  };
  doc.addEventListener("keydown", onBootKey);
} else {
  if (boot) boot.hidden = true;
  prepareHero();
  startHero();
}

/* ── Hero pin / braindance scrub ────────────────────────────── */
const heroScrub = doc.getElementById("heroScrub");
const heroTime = doc.getElementById("heroTime");
const heroSignal = doc.getElementById("heroSignal");

function updateHeroHud(progress) {
  if (heroScrub) heroScrub.style.width = `${Math.round(progress * 100)}%`;
  if (heroTime) heroTime.textContent = formatTime(progress * 90);
  if (heroSignal) heroSignal.textContent = progress > 0.82 ? "UNSTABLE" : "STABLE";
  if (city) city.setProgress(progress);
}

if (hasGsap && hasScrollTrigger && !reducedMotion) {
  const mm = gsap.matchMedia();

  mm.add("(min-width: 901px)", () => {
    const trigger = window.ScrollTrigger.create({
      trigger: ".hero",
      start: "top top",
      end: "+=120%",
      pin: true,
      scrub: 0.7,
      anticipatePin: 1,
      onUpdate: (self) => updateHeroHud(self.progress),
    });
    return () => trigger.kill();
  });

  mm.add("(max-width: 900px)", () => {
    const trigger = window.ScrollTrigger.create({
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: true,
      onUpdate: (self) => updateHeroHud(self.progress),
    });
    return () => trigger.kill();
  });
}

/* ── Topbar / progress / HUD ────────────────────────────────── */
const topbar = doc.getElementById("topbar");
const bdTime = doc.getElementById("bdTime");
const bdBar = doc.getElementById("bdBar");
const bdState = doc.getElementById("bdState");
const signalBars = Array.from(doc.querySelectorAll("#signalBars i"));
const signalValue = doc.getElementById("signalValue");
const bdHud = doc.querySelector(".bd-hud");
const pageFooter = doc.querySelector(".foot");
let lastScrollY = window.scrollY || 0;
let fastTimer = null;
let scrollQueued = false;

function updateScrollState() {
  scrollQueued = false;
  const scrollY = window.scrollY || window.pageYOffset;
  const max = doc.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
  const velocity = Math.abs(scrollY - lastScrollY);
  lastScrollY = scrollY;

  if (bdTime) bdTime.textContent = formatTime(p * 90);
  if (bdBar) bdBar.style.width = `${p * 100}%`;
  if (bdState) bdState.textContent = p > 0.995 ? "END" : "REC";
  if (topbar) topbar.classList.toggle("is-scrolled", scrollY > 20);
  if (bdHud) {
    const footerVisible = pageFooter
      ? pageFooter.getBoundingClientRect().top < window.innerHeight - 6
      : false;
    bdHud.classList.toggle("is-hidden", footerVisible);
  }

  const energy = clamp(velocity / 55, 0, 1);
  signalBars.forEach((bar, i) => {
    const base = 4 + Math.abs(Math.sin(i * 1.7 + scrollY * 0.004)) * 26;
    bar.style.height = `${Math.max(3, Math.round(base + energy * 16 * (i % 2 ? 1 : -1)))}px`;
    bar.style.opacity = String(0.45 + (1 - energy) * 0.4);
  });
  if (signalValue) signalValue.textContent = `${Math.round(96 - energy * 34)}%`;

  if (velocity > 42) {
    doc.body.classList.add("is-fast");
    window.clearTimeout(fastTimer);
    fastTimer = window.setTimeout(() => doc.body.classList.remove("is-fast"), 220);
  }
}

function queueScrollState() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(updateScrollState);
}

window.addEventListener("scroll", queueScrollState, { passive: true });
window.addEventListener("resize", queueScrollState);
if (lenis) lenis.on("scroll", queueScrollState);
updateScrollState();

/* ── Menu ───────────────────────────────────────────────────── */
const menuBtn = doc.getElementById("menuBtn");
const menu = doc.getElementById("menu");
let lastFocused = null;

function openMenu() {
  if (!menu) return;
  lastFocused = doc.activeElement;
  menu.classList.add("is-open");
  menu.removeAttribute("inert");
  menu.setAttribute("aria-hidden", "false");
  menuBtn.setAttribute("aria-expanded", "true");
  doc.body.classList.add("menu-open");
  if (lenis) lenis.stop();
  beep({ freq: 700, dur: 0.06, type: "square" });
  const first = menu.querySelector("a");
  if (first) window.setTimeout(() => first.focus(), 120);
}

function closeMenu({ restoreFocus = true } = {}) {
  if (!menu || !menu.classList.contains("is-open")) return;
  menu.classList.remove("is-open");
  menu.setAttribute("inert", "");
  menu.setAttribute("aria-hidden", "true");
  menuBtn.setAttribute("aria-expanded", "false");
  doc.body.classList.remove("menu-open");
  if (lenis) lenis.start();
  if (restoreFocus && lastFocused instanceof HTMLElement) lastFocused.focus();
}

menuBtn?.addEventListener("click", () => {
  if (menu.classList.contains("is-open")) closeMenu();
  else openMenu();
});

doc.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
  if (event.matches) closeMenu({ restoreFocus: false });
});

/* ── Anchors ────────────────────────────────────────────────── */
doc.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const hash = link.getAttribute("href");
    if (!hash || hash.length < 2) return;
    const target = doc.querySelector(hash);
    if (!target) return;

    event.preventDefault();
    closeMenu({ restoreFocus: false });
    beep({ freq: 1250, dur: 0.05, type: "square" });

    if (lenis) lenis.scrollTo(target, { offset: hash === "#top" ? 0 : -64, duration: 1.15 });
    else target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });

    if (hash === "#top") history.replaceState(null, "", location.pathname + location.search);
  });
});

/* ── Nav active state ──────────────────────────────────────── */
const navLinks = Array.from(doc.querySelectorAll(".rail-nav a[data-nav], .menu-links a[data-nav]"));
const navSections = Array.from(doc.querySelectorAll("section[id]"));
const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.dataset.nav === entry.target.id);
      });
    });
  },
  { rootMargin: "-42% 0px -50% 0px" }
);
navSections.forEach((section) => navObserver.observe(section));

/* ── Custom cursor, glow, magnetic buttons, tilt ───────────── */
const reticle = doc.getElementById("reticle");
const reticleLabel = doc.getElementById("reticleLabel");
const cursorGlow = doc.getElementById("cursorGlow");

if (finePointer && !reducedMotion && reticle) {
  doc.body.classList.add("has-cursor");

  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;

  function placeCursor(x, y) {
    reticle.style.transform = `translate3d(${x - 15}px, ${y - 15}px, 0)`;
    if (cursorGlow) cursorGlow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
  placeCursor(pointerX, pointerY);

  doc.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    placeCursor(pointerX, pointerY);
    root.style.setProperty("--mx", ((pointerX / window.innerWidth) * 2 - 1).toFixed(3));
    root.style.setProperty("--my", ((pointerY / window.innerHeight) * 2 - 1).toFixed(3));
  }, { passive: true });

  function cursorLabelFor(target) {
    if (!(target instanceof Element)) return "SCAN";
    if (target.closest(".gig-open")) return "OPEN";
    if (target.closest(".gig")) return "TRACE";
    if (target.closest(".module")) return "SWAP";
    if (target.closest(".decrypt")) return "DECRYPT";
    if (target.closest(".memory")) return "READ";
    if (target.closest(".build-btn, .filter-btn")) return "SWAP";
    if (target.closest("a")) return "LINK";
    if (target.closest("button")) return "ACT";
    return "SCAN";
  }

  doc.addEventListener("pointerover", (event) => {
    const label = cursorLabelFor(event.target);
    const hot = label !== "SCAN";
    reticle.classList.toggle("is-hot", hot);
    if (reticleLabel) reticleLabel.textContent = label;
  });

  doc.addEventListener("pointerdown", () => reticle.classList.add("is-down"));
  doc.addEventListener("pointerup", () => reticle.classList.remove("is-down"));

  /* magnetic buttons */
  doc.querySelectorAll(".btn, .filter-btn, .build-btn").forEach((el) => {
    el.addEventListener("pointermove", (event) => {
      const rect = el.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      el.style.setProperty("--mag-x", `${clamp(dx, -1, 1) * 4}px`);
      el.style.setProperty("--mag-y", `${clamp(dy, -1, 1) * 3}px`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--mag-x", "0px");
      el.style.setProperty("--mag-y", "0px");
    });
  });

  /* 3D tilt on cards and panels */
  doc.querySelectorAll(".gig, .dossier-card, .hero-panel, .loadout").forEach((el) => {
    el.addEventListener("pointermove", (event) => {
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      el.style.setProperty("--rx", `${((0.5 - py) * 6).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((px - 0.5) * 8).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    });
  });
}

/* ── Dossier decrypt ────────────────────────────────────────── */
const decrypt = doc.getElementById("decrypt");
const decryptText = doc.getElementById("decryptText");
const DECRYPT_FINAL = "PERSONAL LOG // FOOTBALL, BAD FIVE-A-SIDE, AND TAKING APART A DJ TRANSITION I HEARD ONCE.";
let decrypting = false;

function scrambleTo(el, finalText, duration = 1200) {
  if (!el) return;
  if (reducedMotion) {
    el.textContent = finalText;
    return;
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@";
  const start = performance.now();

  function tick(now) {
    const p = clamp((now - start) / duration, 0, 1);
    const reveal = Math.floor(finalText.length * p);
    let out = "";
    for (let i = 0; i < finalText.length; i++) {
      if (i < reveal) out += finalText[i];
      else if (finalText[i] === " ") out += " ";
      else out += chars[(Math.random() * chars.length) | 0];
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = finalText;
  }
  requestAnimationFrame(tick);
}

decrypt?.addEventListener("click", () => {
  if (decrypting) return;
  decrypting = true;
  glitch();
  scrambleTo(decryptText, DECRYPT_FINAL);
  window.setTimeout(() => { decrypting = false; }, 1300);
});

/* ── Gig data + datashard dialog ────────────────────────────── */
const GIGS = {
  matchcall: {
    code: "GIG-01",
    kicker: "SPORT // COMPUTER VISION",
    title: "MATCHCALL",
    claim: "Commentary that can only say what it can prove.",
    desc: "Drop in a broadcast clip. It spots the action, tracks players, builds a deterministic fact sheet, then writes and voices commentary grounded in those facts — or cuts a 10-second highlights reel per moment.",
    evidence: "Score-bug OCR → YOLO26n + ByteTrack → deterministic fact sheet → GPT-2 LoRA → Fish Audio. Six event types, every line grounded.",
    stack: ["Python", "YOLO26n", "ByteTrack", "GPT-2 LoRA", "Fish Audio"],
    media: '<img src="assets/img/matchcall.webp" alt="Matchcall stadium board showing the commentary pipeline over a football pitch" loading="lazy">',
    links: [["REPOSITORY ↗", "https://github.com/Aryamanironman/matchcall"]],
  },
  lastword: {
    code: "GIG-02",
    kicker: "AI // INFRASTRUCTURE",
    title: "LASTWORD",
    claim: "The newest fact gets the last word.",
    desc: "RAG keeps returning the old version of a fact even after re-indexing, because the model follows document order, not time. lastword sits between retriever and LLM and resolves the conflict.",
    evidence: "Retriever → conflict detector → timestamp-aware resolver → grounded prompt. Zero runtime dependencies, framework-agnostic, CI green.",
    stack: ["Python", "RAG", "LLM middleware", "pytest"],
    media: '<div class="gig-visual" role="img" aria-label="Diagram: the same fact appears twice with different dates; lastword resolves to the newest"><span class="mono">SAME FACT // TWO DATES</span><span class="gv-row gv-old"><em class="mono">2024-03-12 // CHUNK 18</em><b>The store opens at 9am.</b></span><span class="gv-row gv-new"><em class="mono">2026-09-20 // CHUNK 04</em><b>The store opens at 7am.</b></span><span class="gv-res mono">LASTWORD → NEWEST WINS</span></div>',
    links: [["REPOSITORY ↗", "https://github.com/Aryamanironman/lastword"]],
  },
  overturn: {
    code: "GIG-03",
    kicker: "AI // AGENTS · HEALTH",
    title: "OVERTURN",
    claim: "The denial, answered with evidence.",
    desc: "An agent reads a health-insurance denial, the policy, the clinical record and the code tables. It finds the contradictions and drafts an appeal packet a human can send — including the one document it refuses to invent.",
    evidence: "Planner → reconciler → critic → advocate → reporter. Five agents, one ledger, capped re-query loops and a hard refusal to invent missing documents.",
    stack: ["Python", "LLM agents", "Zetaris JDBC", "Nemotron"],
    media: '<img src="assets/img/overturn.webp" alt="OVERTURN evidence packet scoring an insurance appeal at 84 out of 100" loading="lazy">',
    links: [["REPOSITORY ↗", "https://github.com/Aryamanironman/overturn"]],
  },
  moodmix: {
    code: "GIG-04",
    kicker: "AI // RL · AUDIO",
    title: "MOODMIX",
    claim: "An RL agent that actually DJs.",
    desc: "A Gymnasium environment where the agent works a crossfader, three-band EQ, tempo sync and drum pads one beat at a time — scored on beat alignment, harmonic compatibility, transition shape and mood.",
    evidence: "41-observation vocal-aware control surface · PPO training loop · human-baseline eval harness · beat-aligned reward shaping.",
    stack: ["Python", "Gymnasium", "PPO", "Audio DSP"],
    media: '<img src="assets/img/moodmix.webp" alt="MoodMix Silver Booth DJ interface with two decks, a mixer and a transition graph" loading="lazy">',
    links: [["REPOSITORY ↗", "https://github.com/Aryamanironman/moodmix-env"]],
  },
  steadi: {
    code: "GIG-05",
    kicker: "PRODUCT // ACCESSIBILITY",
    title: "STEADI",
    claim: "Independence, served daily.",
    desc: "An anti-tremor cutlery handle for people living with essential tremor and Parkinson's. I built the scroll-driven 3D product site, the SwiftUI companion demo, and a financial model where every figure is sourced.",
    evidence: "Single-file Three.js product film · procedural handle, dock, PCB and sensors · SwiftUI companion demo · sourced five-year financial model.",
    stack: ["Three.js", "SwiftUI", "Financial modelling"],
    media: '<img src="assets/img/steadi.webp" alt="STEADI product site showing the anti-tremor cutlery handle and dock" loading="lazy">',
    links: [
      ["LIVE SITE ↗", "https://aryamanironman.github.io/steadi-site/"],
      ["REPOSITORY ↗", "https://github.com/Aryamanironman/steadi-site"],
    ],
  },
  marginplate: {
    code: "GIG-06",
    kicker: "PRODUCT // FULL-STACK",
    title: "MARGINPLATE",
    claim: "A food-cost watchdog for independent restaurants.",
    desc: "Photograph a supplier invoice. MarginPlate extracts line items, normalizes units, recomputes cost-per-plate across the menu, and flags suppliers whose prices have quietly crept up.",
    evidence: "Next.js App Router → invoice parsing → normalization and costing algorithms → 11 Postgres tables with org-scoped RLS. No hardcoded metrics.",
    stack: ["Next.js 15", "Supabase", "Postgres", "Vercel"],
    media: '<img src="assets/img/marginplate.webp" alt="MarginPlate landing page showing a food-cost dashboard" loading="lazy">',
    links: [
      ["LIVE DEMO ↗", "https://marginplate-two.vercel.app"],
      ["REPOSITORY ↗", "https://github.com/Aryamanironman/marginplate"],
    ],
  },
};

const shardDialog = doc.getElementById("shardDialog");
const shardContent = doc.getElementById("shardContent");
const shardClose = doc.getElementById("shardClose");
let shardTrigger = null;

function openGig(id, trigger) {
  const gig = GIGS[id];
  if (!gig || !shardDialog || !shardContent) return;
  shardTrigger = trigger || null;

  shardContent.innerHTML = `
    <div class="shard-media">${gig.media}</div>
    <div class="shard-body">
      <p class="shard-kicker mono">${gig.code} // ${gig.kicker}</p>
      <h2>${gig.title}</h2>
      <p class="shard-claim">${gig.claim}</p>
      <p class="shard-desc">${gig.desc}</p>
      <div class="shard-evidence"><span>THE MACHINERY</span>${gig.evidence}</div>
      <ul class="shard-stack">${gig.stack.map((item) => `<li>${item}</li>`).join("")}</ul>
      <div class="shard-links">${gig.links.map(([label, href]) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`).join("")}</div>
    </div>`;

  shardDialog.setAttribute("aria-label", `${gig.title} — gig details`);
  if (typeof shardDialog.showModal === "function") {
    if (!shardDialog.open) shardDialog.showModal();
  } else {
    shardDialog.setAttribute("open", "");
  }
  doc.body.classList.add("dialog-open");
  if (lenis) lenis.stop();
  shardClose?.focus();
  glitch();
}

function closeShard() {
  if (!shardDialog || !shardDialog.open) return;
  shardDialog.close();
}

shardClose?.addEventListener("click", closeShard);
shardDialog?.addEventListener("click", (event) => {
  if (event.target === shardDialog) closeShard();
});
shardDialog?.addEventListener("close", () => {
  doc.body.classList.remove("dialog-open");
  if (lenis) lenis.start();
  const trigger = shardTrigger;
  shardTrigger = null;
  if (trigger && doc.contains(trigger) && trigger.offsetParent !== null) {
    window.setTimeout(() => trigger.focus(), 30);
  }
});

doc.querySelectorAll(".gig-open").forEach((button) => {
  button.addEventListener("click", () => openGig(button.dataset.open, button));
});

/* ── Gig filter ─────────────────────────────────────────────── */
const gigCards = Array.from(doc.querySelectorAll(".gig"));
gigCards.forEach((card) => {
  const title = card.querySelector("h3")?.textContent.trim() || "Gig";
  const open = card.querySelector(".gig-open");
  if (open) open.setAttribute("aria-label", `Open ${title} gig file`);
  const link = card.querySelector(".gig-link");
  if (link) {
    const label = link.textContent.replace("↗", "").trim();
    link.setAttribute("aria-label", `${title} — ${label.toLowerCase()}`);
  }
});

const filterButtons = Array.from(doc.querySelectorAll(".filter-btn"));
const gigCount = doc.getElementById("gigCount");
const filterNote = doc.querySelector(".filter-note");
let activeFilter = "all";

function applyFilter(filter) {
  activeFilter = filter;
  filterButtons.forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  let visible = 0;
  gigCards.forEach((card, index) => {
    const match = filter === "all" || card.dataset.cat === filter;
    if (match) visible++;
    card.classList.toggle("is-hidden", !match);
    if (match && hasGsap && !reducedMotion) {
      gsap.fromTo(
        card,
        { opacity: 0, y: 12, scale: 0.98 },
        {
          opacity: 1, y: 0, scale: 1, duration: 0.32, delay: (index % 3) * 0.04,
          ease: "power2.out", clearProps: "transform,opacity",
        }
      );
    }
  });

  if (gigCount) gigCount.textContent = `${String(visible).padStart(2, "0")} / 06`;
  if (filterNote) filterNote.textContent = `TRACE: ${filter === "all" ? "NONE" : filter.toUpperCase()}`;
  beep({ freq: 1100, dur: 0.05, type: "square" });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => applyFilter(button.dataset.filter));
});

/* ── Cyberware loadout ──────────────────────────────────────── */
const BUILDS = {
  netrunner: {
    id: "NR-01",
    core: "PYTHON",
    caption: "Models, evaluation, data. The part that has to be true.",
    sync: "98.4%",
    modules: [
      { name: "PYTORCH", tier: 5 },
      { name: "NLP", tier: 4 },
      { name: "RL", tier: 5 },
      { name: "RAG", tier: 4 },
      { name: "LLM AGENTS", tier: 4 },
    ],
  },
  solo: {
    id: "SL-02",
    core: "DOCKER",
    caption: "Interfaces, infrastructure, shipping. The part that has to leave the building.",
    sync: "96.1%",
    modules: [
      { name: "REACT", tier: 5 },
      { name: "NEXT.JS", tier: 4 },
      { name: "SWIFT", tier: 4 },
      { name: "POSTGRES", tier: 5 },
      { name: "FASTAPI", tier: 4 },
    ],
  },
};

const buildButtons = Array.from(doc.querySelectorAll(".build-btn"));
const loadout = doc.getElementById("loadout");
const loadoutStage = doc.getElementById("loadoutStage");
const loadoutLines = doc.getElementById("loadoutLines");
const loadoutId = doc.getElementById("loadoutId");
const coreName = doc.getElementById("coreName");
const buildCaption = doc.getElementById("buildCaption");
const syncBar = doc.getElementById("syncBar");
const syncValue = doc.getElementById("syncValue");
const modules = Array.from(doc.querySelectorAll(".module"));

function drawLoadoutLines() {
  if (!loadoutStage || !loadoutLines) return;
  const rect = loadoutStage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  loadoutLines.innerHTML = modules
    .map((module) => {
      const r = module.getBoundingClientRect();
      const x = ((r.left + r.width / 2 - rect.left) / rect.width) * 100;
      const y = ((r.top + r.height / 2 - rect.top) / rect.height) * 100;
      return `<line x1="50" y1="50" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" />`;
    })
    .join("");
}

function setBuild(name, animate = true) {
  const build = BUILDS[name];
  if (!build) return;

  buildButtons.forEach((button) => {
    const active = button.dataset.build === name;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (loadoutId) loadoutId.textContent = build.id;
  if (coreName) coreName.textContent = build.core;
  if (buildCaption) buildCaption.textContent = build.caption;
  if (syncValue) syncValue.textContent = build.sync;
  if (syncBar) syncBar.style.width = build.sync;

  modules.forEach((module, i) => {
    const data = build.modules[i];
    if (!data) return;
    const nameEl = module.querySelector(".mod-name");
    if (nameEl) nameEl.textContent = data.name;
    const tier = module.querySelectorAll(".mod-tier i");
    tier.forEach((bar, index) => bar.classList.toggle("on", index < data.tier));
  });

  if (loadout) {
    loadout.classList.remove("is-swapping");
    void loadout.offsetWidth;
    loadout.classList.add("is-swapping");
    window.setTimeout(() => loadout.classList.remove("is-swapping"), 400);
  }

  if (animate && hasGsap && !reducedMotion) {
    gsap.fromTo(
      modules,
      { opacity: 0.35, scale: 0.96 },
      { opacity: 1, scale: 1, duration: 0.35, stagger: 0.04, ease: "power2.out", clearProps: "transform,opacity" }
    );
  }

  beep({ freq: 1300, dur: 0.06, type: "square", slide: -400 });
  glitch();
  window.requestAnimationFrame(drawLoadoutLines);
}

buildButtons.forEach((button) => {
  button.addEventListener("click", () => setBuild(button.dataset.build));
});

setBuild("netrunner", false);
window.requestAnimationFrame(drawLoadoutLines);

if (loadoutStage && typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => drawLoadoutLines()).observe(loadoutStage);
}
window.addEventListener("resize", drawLoadoutLines);

/* ── Life path ──────────────────────────────────────────────── */
const memories = Array.from(doc.querySelectorAll(".memory"));
const lifeHead = doc.getElementById("lifeHead");

const memoryObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("is-active", entry.isIntersecting);
    });
  },
  { rootMargin: "-35% 0px -42% 0px" }
);
memories.forEach((memory) => memoryObserver.observe(memory));

if (hasGsap && hasScrollTrigger && !reducedMotion) {
  window.ScrollTrigger.create({
    trigger: ".life-list",
    start: "top 72%",
    end: "bottom 62%",
    scrub: 0.4,
    onUpdate: (self) => {
      if (lifeHead) lifeHead.style.setProperty("--life-top", `${self.progress * 100}%`);
    },
  });
} else if (lifeHead) {
  lifeHead.style.setProperty("--life-top", "50%");
}

/* ── Section reveals ────────────────────────────────────────── */
if (hasGsap && hasScrollTrigger && !reducedMotion) {
  gsap.utils.toArray(".sec-head").forEach((head) => {
    gsap.from(head.querySelectorAll(".sec-code, h2, .sec-status"), {
      opacity: 0,
      x: -20,
      duration: 0.7,
      stagger: 0.06,
      ease: "power2.out",
      clearProps: "transform",
      scrollTrigger: { trigger: head, start: "top 86%", once: true },
    });

    window.ScrollTrigger.create({
      trigger: head,
      start: "top 86%",
      once: true,
      onEnter: () => {
        const title = head.querySelector("h2.glitch");
        if (!title) return;
        title.classList.add("is-glitching");
        window.setTimeout(() => title.classList.remove("is-glitching"), 420);
      },
    });
  });

  gsap.from(".dossier-card", {
    opacity: 0,
    x: -28,
    duration: 0.8,
    ease: "power2.out",
    scrollTrigger: { trigger: ".dossier", start: "top 76%", once: true },
  });

  gsap.utils.toArray(".gig").forEach((card, index) => {
    gsap.from(card, {
      opacity: 0,
      y: 26,
      duration: 0.6,
      delay: (index % 2) * 0.07,
      ease: "power2.out",
      clearProps: "transform",
      scrollTrigger: { trigger: card, start: "top 88%", once: true },
    });
  });

  gsap.from(".loadout", {
    opacity: 0,
    y: 30,
    duration: 0.8,
    ease: "power2.out",
    scrollTrigger: { trigger: ".cyber", start: "top 72%", once: true },
  });

  gsap.utils.toArray(".memory").forEach((memory) => {
    gsap.from(memory, {
      opacity: 0,
      x: -24,
      duration: 0.6,
      ease: "power2.out",
      clearProps: "transform",
      scrollTrigger: { trigger: memory, start: "top 90%", once: true },
    });
  });

  gsap.from(".contact-title, .contact-sub, .contact-grid", {
    opacity: 0,
    y: 30,
    duration: 0.7,
    stagger: 0.08,
    ease: "power2.out",
    scrollTrigger: { trigger: ".contact", start: "top 72%", once: true },
  });
}

/* ── Reboot ─────────────────────────────────────────────────── */
const reboot = doc.getElementById("reboot");
reboot?.addEventListener("click", () => {
  glitch();
  doc.body.classList.add("is-fast");
  window.setTimeout(() => doc.body.classList.remove("is-fast"), 500);
  if (lenis) lenis.scrollTo(0, { duration: 1.2 });
  else window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
});

/* ── Year ───────────────────────────────────────────────────── */
const yearEl = doc.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

/* ── Keyboard shortcuts ─────────────────────────────────────── */
doc.addEventListener("keydown", (event) => {
  const tag = (event.target && event.target.tagName) || "";
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (boot && !boot.hidden) return;

  const key = event.key.toLowerCase();
  if (key === "o" && !dayMode) cycleOptics();
  if (key === "a") toggleAudio();
  if (key === "d") setDayMode(!dayMode);
  if (key === "m") {
    if (window.getComputedStyle(menuBtn).display === "none") return;
    if (menu.classList.contains("is-open")) closeMenu();
    else openMenu();
  }
});

/* ── Refresh after fonts / images ───────────────────────────── */
window.addEventListener("load", () => {
  if (hasScrollTrigger) window.ScrollTrigger.refresh();
  drawLoadoutLines();
});
if (doc.fonts && doc.fonts.ready) {
  doc.fonts.ready.then(() => {
    drawLoadoutLines();
    if (hasScrollTrigger) window.ScrollTrigger.refresh();
  });
}
