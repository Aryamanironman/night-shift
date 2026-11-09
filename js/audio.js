/* Night City audio: a low synth drone + short HUD beeps.
   Off by default. No autoplay. */

let ctx = null;
let master = null;
let droneGain = null;
let droneNodes = [];
let noiseBuffer = null;
let enabled = false;
const last = Object.create(null);

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function throttled(name, ms) {
  const now = performance.now();
  if (last[name] && now - last[name] < ms) return true;
  last[name] = now;
  return false;
}

function startDrone() {
  const c = ensure();
  if (!c || droneNodes.length) return;

  droneGain = c.createGain();
  droneGain.gain.value = 0.0001;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 210;
  filter.Q.value = 4;

  const oscA = c.createOscillator();
  oscA.type = "sawtooth";
  oscA.frequency.value = 55;
  const oscB = c.createOscillator();
  oscB.type = "sawtooth";
  oscB.frequency.value = 55.6;
  const oscC = c.createOscillator();
  oscC.type = "sine";
  oscC.frequency.value = 110;

  oscA.connect(filter);
  oscB.connect(filter);
  oscC.connect(filter);
  filter.connect(droneGain);
  droneGain.connect(master);

  oscA.start();
  oscB.start();
  oscC.start();
  droneNodes = [oscA, oscB, oscC, filter];

  droneGain.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 1.4);
}

function stopDrone() {
  if (!ctx || !droneNodes.length) return;
  const t = ctx.currentTime;
  try {
    droneGain.gain.cancelScheduledValues(t);
    droneGain.gain.setValueAtTime(droneGain.gain.value, t);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    droneNodes.forEach((node) => {
      if (node.stopAt) return;
      try {
        if (node.stop) {
          node.stop(t + 0.55);
        }
      } catch (e) {}
    });
  } catch (e) {}
  droneNodes = [];
}

export function setEnabled(value) {
  enabled = !!value;
  if (enabled) {
    ensure();
    startDrone();
    beep({ freq: 900, dur: 0.08, type: "square", gain: 0.05, slide: 500 });
  } else {
    stopDrone();
  }
  return enabled;
}

export function isEnabled() {
  return enabled;
}

export function beep({ freq = 1200, dur = 0.06, type = "square", gain = 0.05, slide = 0 } = {}) {
  if (!enabled) return;
  if (!ensure()) return;
  if (throttled("beep", 35)) return;

  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function glitch() {
  if (!enabled) return;
  if (!ensure()) return;
  if (throttled("glitch", 220)) return;

  if (!noiseBuffer) {
    const length = Math.floor(ctx.sampleRate * 0.3);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(900 + Math.random() * 1800, t0);
  filter.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + 0.25);
}

export function opticsSwitch() {
  beep({ freq: 1600, dur: 0.07, type: "sawtooth", gain: 0.04, slide: -700 });
}
