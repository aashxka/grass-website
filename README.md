# Grass website

Aashika's portfolio hero: rolling grass hills, a wooden desk with a cream computer and a coffee set, drawn in real time with WebGL2. Every blade is its own shape and sways on its own, and the wind follows Seattle's live wind.

It is a static page with no build step and no dependencies: `index.html`, `desk.js` (the desk set), `touch.js` (blades part under the cursor or a finger) and `crt-face.jpg` (the screen).

## Run it

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## What it is

The hero from [grass-hills](https://github.com/aashxka/grass-hills) with her tuned settings fixed in place (no control panel, no navbar):

| Group | Settings |
| --- | --- |
| View | Scene, Hero 16:9 |
| Desk | Left/right 2.00 m, near/far −1.05 m, elevation −35 cm, size 1.82×, angle −31°, monitor 1.40× |
| Coffee mug | Left/right 13 cm, back/front 0 cm, size 1.00× |
| Hills | Rounded mounds, height 1.50×, background mounds 80%, 1 hump across, width 1.56× |
| Light | Haze 0.89×, overall 1.11×, depth of field 0, glow 1.00× |
| Grass | Impact radius 31 px, length 0.67×, density 100%, base 50%, lavender 1.00× |
| Colours | The grass-hills defaults (background #ffffff, blade root #1a662e … computer #d9cbb1) |

Changes from grass-hills:

- **Three distant mounds removed** from the skyline (far left, centre dip, far right). `HIDE_FAR` in `index.html` lists them as column ranges in banner pixels plus a minimum distance, so the smaller mounds behind them are left out too and the nearer hills form the skyline there.
- **Seattle's live wind.** The page reads the current wind and gusts for Seattle from [Open-Meteo](https://open-meteo.com) (free, no key) on load and every 10 minutes. The gust bands travel across the field at the real wind speed. Sway strength is the speed divided by 4.2 m/s, and gusts are the gust speed divided by 7.6 m/s, so an ordinary 4.2 m/s day looks exactly like the tuned panel (Strength 1.00, Gusts 1.00). New readings ease in over a few seconds. If the request fails, the tuned breeze plays. Reduced-motion users get a gentle breeze at most.
- **Full resolution.** It always renders at the screen's own pixel density with 4× multisampling. It does not drop resolution when frames are slow, as the grass-hills page does. The only limits are a cap near 10 million pixels for windows larger than 4K, and one step down to 1.5× on a device that cannot hold 20 fps.
- **Full-window hero.** On desktop the whole width of the scene fills the window, with white sky above. On phones and portrait tablets it crops the sides around the desk so the grass keeps a readable size.

## URL parameters

Any setting can be overridden for testing, for example `?len=0.8&deskX=1.5`. Passing `wind` or `gust` turns the live Seattle wind off, and so does `?seattle=0`. `?t=3&paused=1` freezes a frame. `?debug=1` shows the frame rate, the canvas size and the current Seattle reading.
