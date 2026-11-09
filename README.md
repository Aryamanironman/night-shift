# NIGHT SHIFT — Aryaman Sharma

A Cyberpunk 2077-inspired braindance portfolio. Original interface, code and assets. Not affiliated with CD PROJEKT RED.

**Live:** <https://aryamanironman.github.io/night-shift/>

The page is one continuous braindance: a Night City flythrough, a BD scrubber as scroll progress, gigs instead of project cards, a cyberware loadout instead of a skills list, a life-path memory timeline and a terminal contact. A hologram portrait watches from the subject panel.

## What's inside

- **Night City flythrough** — a procedural Three.js street with lit facades, neon signs, rain, flying cars, a holo-core and UnrealBloom.
- **Left HUD rail** — section dots and a hover label, optics, audio, day/night and JACK IN. No top navigation bar.
- **BD scrubber** — hero scroll drives the city and the timecode; the fixed HUD tracks the full braindance.
- **Gig board** — six gigs with category filters and a datashard dialog for the full dossier.
- **Cyberware loadout** — NETRUNNER / SOLO builds with slots, tiers, a core, SYNC and connecting lines.
- **Life path** — scroll-linked memory rail and active fragments.
- **Hologram portrait** — the GitHub avatar turned into a cyan scan portrait with a chromatic ghost and scan sweep.
- **Custom cursor** — instant HUD reticle with contextual labels; magnetic buttons and 3D tilt on cards.
- **Reactive background** — fixed CSS skyline, sun and perspective grid; the sun and grid shift with the pointer.
- **Corpo Daylight** — a second, light theme with dark-gold type, bright yellow controls, a cream city and an ink skyline. Persists in `localStorage`.
- **Optics** — KIROSHI / THERMAL / NV colour grades for the city (night only).
- **Audio** — optional low synth drone and HUD beeps. Off by default, no autoplay.
- **Performance** — the city is paused when offscreen, capped at 60fps desktop / 45fps mobile, DPR 1, bloom at 0.72 resolution, and the old ambient WebGL layer is gone. Scroll-time blur on panels has been removed.

## Controls

- Scroll: drive the braindance.
- Left rail: sections, optics, audio, day/night, contact.
- Gig board: ALL / AI / SPORT / PRODUCT; OPEN FILE opens the datashard.
- Cyberware: NETRUNNER / SOLO.
- Dossier: click the terminal line to decrypt the personal log.
- Keyboard: `D` day/night, `O` optics (night), `A` audio, `M` menu on mobile.
- Boot sequence: skip with Escape, Enter or the skip button.

## Run it

```bash
cd aryaman-portfolio
python -m http.server 4174
```

Open <http://127.0.0.1:4174>. A local server is needed for ES modules and the import map.

## Deploy

Fully static. This repo is deployed to GitHub Pages from `main` / root:

<https://aryamanironman.github.io/night-shift/>

All asset paths are relative, so the site also works on Vercel, Netlify or Cloudflare Pages. `og:image` and `twitter:image` are already set to the GitHub Pages URL; update them if you move to a custom domain.

## Hologram

The portrait is generated from the GitHub avatar (a pixel character) and processed into a cyan hologram: duotone, scanlines, glitch slices, yellow edge and a chromatic ghost.

To use a real photo instead, replace `assets/img/aryaman-holo.webp` with a transparent-background portrait (560×560 is ideal). Both `<img class="holo-img">` and `<img class="holo-ghost">` point at it. The original avatar source is archived locally in `design-demos/source/avatar-source.png` and is not part of the published repo.

## Files

```
index.html          markup, copy and project content
css/style.css       all themes, HUD, world background, responsive rules
js/city3d.js        procedural Night City + bloom + holo-core
js/main.js          boot, rail, day/night, optics, audio, cursor, filters, dialog, loadout
js/audio.js         synthesized drone and HUD beeps
assets/img/         project visuals, hologram, social preview
.nojekyll           serve the static site without Jekyll processing
```

Earlier builds and the avatar source are kept locally in `design-demos/` and are ignored by git; they are not published.

## Stack

Three.js 0.164.1 (+ addons) · GSAP 3.12.5 + ScrollTrigger · Lenis 1.1.14 · Rajdhani / Chakra Petch / Share Tech Mono (Google Fonts) · vanilla HTML/CSS/JS.

The project visuals are screenshots of Aryaman's own live demos and repositories: Matchcall, OVERTURN, MoodMix, STEADI and MarginPlate. `lastword` uses a hand-built HTML diagram because it is middleware with no UI.
