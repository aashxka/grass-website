# Grass website

Aashika's portfolio hero: rolling grass hills, a wooden desk with a cream computer and a coffee set, drawn in real time with WebGL2. Every blade is its own shape and sways on its own, and the wind follows Seattle's live wind.

It is a static page with no build step: `index.html`, `desk.js` (the desk set), `touch.js` (blades part under the cursor or a finger), `crt-face.jpg` (the screen), `fonts/stevie-sans-book.woff` (the nav font), `aashika-ashok-resume.pdf` (the contact bar's resume), and `tune.js` + `vendor/dialkit/` for the optional tune panel.

## Run it

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## What it is

The hero from [grass-hills](https://github.com/aashxka/grass-hills) with her tuned settings fixed in place (no control panel, and the grass-hills navbar is replaced by the nav below):

| Group | Settings |
| --- | --- |
| View | Scene, Hero 16:9 |
| Desk | Left/right 2.00 m, near/far −1.00 m, elevation 12 cm, size 1.06×, angle −31°, monitor 1.40× |
| Coffee mug | Left/right 13 cm, back/front 0 cm, size 1.00× |
| Hills | Rounded mounds, height 1.50×, background mounds 80%, 1 hump across, width 1.56× |
| Light | Haze 0.89×, overall 1.11×, depth of field 0, glow 1.00× |
| Grass | Impact radius 27 px, length 0.84×, density 238%, base 50%, lavender 0.67× |
| Colours | The grass-hills defaults (background #ffffff, blade root #1a662e … computer #d9cbb1), except tip highlight #275927 |

Changes from grass-hills:

- **Three distant mounds removed** from the skyline (far left, centre dip, far right). `HIDE_FAR` in `index.html` lists them as column ranges in banner pixels plus a minimum distance, so the smaller mounds behind them are left out too and the nearer hills form the skyline there.
- **Seattle's live wind.** The page reads the current wind and gusts for Seattle from [Open-Meteo](https://open-meteo.com) (free, no key) on load and every 10 minutes. The gust bands travel across the field at the real wind speed. Sway strength is the speed divided by 4.2 m/s, and gusts are the gust speed divided by 7.6 m/s, so an ordinary 4.2 m/s day looks exactly like the tuned panel (Strength 1.00, Gusts 1.00). New readings ease in over a few seconds. If the request fails, the tuned breeze plays. Reduced-motion users get a gentle breeze at most.
- **Full resolution.** It always renders at the screen's own pixel density with 4× multisampling. It does not drop resolution when frames are slow, as the grass-hills page does. The only limits are a cap near 10 million pixels for windows larger than 4K, and one step down to 1.5× on a device that cannot hold 20 fps.
- **Full-window hero.** On desktop the whole width of the scene fills the window, with white sky above. On phones and portrait tablets it crops the sides around the desk so the grass keeps a readable size.

## Nav

A segmented pill nav sits top centre, 24px from the top: Work, About, Experiments, Photos. It follows her reference exactly:

- Track: #F0F0F0, fully rounded, 5px padding, inner shadows #F7F7F7 (0 1 1) over #E0E0E0 (0 3 3).
- Selected thumb: white, inner shadows #FAFAFA (0 −1 1) over #E3E3E3 (0 −2 3), drop shadow #5F5F5F at 10% (0 3 4, spread −1).
- Text: Stevie Sans Book 14px, #1B1B1B selected and #878787 otherwise; items 38px tall with 20px side padding and 6px gaps.

Clicking an item slides the thumb to it (260 ms ease-out) and sets the URL hash (`#work`, `#about`, `#experiments`, `#photos`), so back and forward move it too. The pages behind them do not exist yet. Phones get tighter padding (and 13px text under 360px) so all four fit.

### Socials

Top right, 60px from the edge: three flat icon buttons (mail, LinkedIn, resume) sitting straight on the page, with no track or thumb. Each sits in an invisible 32px button against the nav's 48px bar, centred on the nav's centre line. At rest the icons are #1B1B1B at 53%, which lands on the nav's unselected #878787; on hover they go to full ink, with no circle or edge around them. Each presses in to 0.96 while held, and has a 36 × 40 hit area. Below 820px wide they sit centred, 8px under the nav.

The icons are one set of inline SVGs, each exactly 14 × 14px: the same rounded square (radius 3) holds every glyph. Mail is the flap folding in from the corners to the centre, LinkedIn is Stevie's own "in" with its square i-dot, and the resume has its top-right corner folded with three lines of text. They are drawn in Stevie Sans Book's own weight: 1.15px strokes (the font's stems are 0.081em, 1.13px at the nav's 14px), with flat-cut ends and sharp joins like its terminals.

Mail copies aashikaashok.work@gmail.com and shows a flat "Email copied" label under the mail icon (if the clipboard is blocked it opens the mail app instead); LinkedIn opens her profile in a new tab; Resume opens `aashika-ashok-resume.pdf` in a new tab.

## Tune panel (`?tune`)

Add `?tune` to the URL to open a [DialKit](https://github.com/joshpuckett/dialkit) panel (top left) with every control from the grass-hills page, applied live:

| Folder | Controls |
| --- | --- |
| View | View (Scene / Terrain), Frame (Banner / Hero 16:9) |
| Desk | Show, left/right (m), near/far (m), desk elevation (cm), size, desk angle (°), monitor size |
| Coffee mug | Left/right (cm), back/front (cm), mug size |
| Hills | Style (Rounded mounds / From banner / Valley), hill height, hill width; Rounded mounds adds background mounds (%), humps and **Hide circled hills**; From banner adds a toggle for each background hill |
| Light | Haze, overall, depth of field, glow |
| Grass | Impact radius (px), grass length, density (15–300%; above 100% the page grows extra blades between the existing ones, in quarter steps, with a "Growing grass…" pill), base (%), lavender |
| Wind | **Seattle live wind**, strength, gusts, pause wind. With live wind on, strength and gusts scale Seattle's reading (1.00 = as it is); off, they work as on grass-hills |
| Colours | All 14 colours, Reset colours |
| Reset | Back to the tuned look (colours stay, as on grass-hills) |

Panel values are saved in your browser (`localStorage` key `grass-website-tune`) and only apply when `?tune` is in the URL, so the plain URL always shows the deployed look. **Copy parameters** copies the current values to send back for baking in as the new defaults, and **Save version** keeps snapshots to compare. Without `?tune` the panel's code and styles are never downloaded.

DialKit 2.1.0's plain-JavaScript build is vendored in `vendor/dialkit/` (MIT, Josh Puckett); `tune.js` builds the panel and drives the scene through a small API that `index.html` hands it.

## URL parameters

Any setting can be overridden for testing, for example `?len=0.8&deskX=1.5`. Passing `wind` or `gust` turns the live Seattle wind off, and so does `?seattle=0`. `?t=3&paused=1` freezes a frame. `?debug=1` shows the frame rate, the canvas size and the current Seattle reading.
