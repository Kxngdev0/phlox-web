# PHOLX landing page — scroll-driven hero

Static site: `index.html`, `styles.css`, `script.js`. No build step.
Libraries load from CDNs: Tailwind (utilities), GSAP + ScrollTrigger, Lenis (smooth scroll), Inter (Google Fonts).

## Run it

Open `index.html` directly, or serve the folder for correct asset loading:

```bash
python3 -m http.server 8080     # then open http://localhost:8080
```

## How the hero works

- `.seq` is a tall track (520svh desktop, 440svh mobile). `.seq__sticky` pins to the viewport with CSS `position: sticky`.
- ScrollTrigger reports scroll progress `0 → 1`. Lenis drives it with smoothed wheel scrolling; touch stays native, so there is no touch lag on 9:16 phones.
- The canvas follows progress with exponential smoothing (`CONFIG.smoothing`), so frames glide instead of snapping.
- Text beats fade, slide and pin by progress windows (`WINDOWS` in `script.js`). Edit the arrays to retime them.
- Rendering pauses when the hero is off-screen. Canvas DPR is capped (2 desktop, 1.5 mobile) to hold 60fps.

## Frame source (two modes)

**1. `procedural` (default)** — no assets. A particle system morphs scatter → cube lattice → sphere → torus network as you scroll. Particle counts: `CONFIG.procedural`.

**2. `images`** — your own product/3D render sequence.

1. Render or export a clip (a turntable or exploded view works well), 3–5 s.
2. Convert to WebP frames:
   ```bash
   mkdir -p assets/frames
   ffmpeg -i product.mp4 -vf "fps=30,scale=1600:-2" -c:v libwebp -quality 70 assets/frames/frame_%04d.webp
   ```
3. In `script.js` set `mode: 'images'` and `images.count` to the number of frames. Check `images.start` and the `path` pattern against your filenames.
4. Use a dark or transparent background so the page's gradient shows through.

Tips: aim for 90–150 frames at ≤1600px wide and ≤60 KB each. Frames load coarse-to-fine (every 8th, then 4th, 2nd, 1st), so the animation works while loading.

## Before launch

- **Contact form:** get a free key at web3forms.com and paste it into `access_key` in `index.html`.
- **Email / studio details:** `hello@pholx.com` is a placeholder; change it in the CTA section.
- **Footer links:** privacy and terms point to `#`.
- Production: replace the Tailwind CDN with a compiled build (`npx tailwindcss -o tailwind.css --minify`) and self-host GSAP and Lenis.

## Accessibility

- `prefers-reduced-motion`: Lenis is disabled, the canvas stops drifting and shows a static composed frame, and reveal animations are skipped.
- Spec tabs support arrow-key navigation, and the nav menu is a real button with `aria-expanded`.
