# Grass website

Aashika's portfolio hero: rolling grass hills, a wooden desk with a cream computer and a coffee set, drawn in real time with WebGL2. Every blade is its own shape and sways on its own, and the wind follows Seattle's live wind.

It is a static page with no build step: `index.html`, `desk.js` (the desk set), `touch.js` (blades part under the cursor or a finger), `crt-face.jpg` (the screen), `fonts/stevie-sans-book.woff` (the nav font), `aashika-ashok-resume.pdf` (her resume), `sounds.js` + `vendor/cuelume/` (interface sounds), and `tune.js` + `vendor/dialkit/` for the optional tune panel.

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
| Desk | Hidden (`?desk=1` shows it); its place: left/right 2.60 m, near/far −1.10 m, elevation 2 cm, size 1.38×, angle −31°, monitor 1.40× |
| Coffee mug | Left/right 13 cm, back/front 0 cm, size 1.00× |
| Hills | Rounded mounds, height 0.92×, background mounds 80%, 1 hump across, width 1.56×, circled hills hidden |
| Light | Haze 1.05×, overall 1.11×, depth of field 0, glow 1.00× |
| Grass | Impact radius 28 px, length 0.54×, density 169%, base 50%, lavender 0.50× |
| Colours | The grass-hills defaults (background #ffffff … computer #d9cbb1), except a darker blade: root #092c11, lower #266231, mid #183e13, and tip highlight #577214 |

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

### Contact links

The home has no contact links for now: her mock leaves them out, so the LinkedIn, Email and Resume row was removed (it is in git history). `aashika-ashok-resume.pdf` stays in the repo.

### Seattle line

Bottom right, 60px from the edge and 24px from the bottom (20px on phones), in white over the grass: Seattle's local time and the live wind, for example "8:37 PM PST in Seattle · 4 mph S wind". The time comes from `Intl.DateTimeFormat` in America/Los_Angeles and ticks over on the minute. The wind is the same Open-Meteo reading that drives the grass (speed in mph, compass direction it blows from), refreshed every 10 minutes; under 1 mph it says "calm". Without a reading (offline or `?seattle=0`) it shows the time alone. Stevie Sans Book 14px at 92% white with a soft shadow, fading in with the scene; it ignores the pointer so the grass under it still parts.

## Home

From her mock, all in #1B1B1B:

- **Name**: "AASHIKA ASHOK" in Necto Mono 15px, uppercase, in a one-item pill with the nav's treatment (track, white thumb, colours, bold hover, press, focus ring), fixed 24px from the top and left edges so it lines up with the nav. It is selected on the landing page; once Work (or any nav item) is selected its thumb fades off and it reads and hovers like an unselected nav item, and clicking it scrolls back home. On phones it sits 20px under the nav.
- **Headline**: "Product designer obsessed with simplicity, / human behavior and aesthetics." in Season Mix Regular 30px (26px on phones), line height 1.44, breaking after "simplicity,". `fonts/season-mix-trial-regular.woff` is the TRIAL cut from befonts, licensed for personal use only.
- **List**: four rows of year (two digits, "24 – 26") and place (Stevie Sans Book 15px at 50% #1B1B1B, 16px apart) and role (Stevie Sans Book 15px), 43px under the headline, rows 15px apart, roles in one column 24px past the longest place. On phones each place stacks over its role.

The headline and list are one block, as wide as its longest line and centred. The headline's lines are centred, and the list keeps its two columns aligned and sits centred under it (on phones each stacked row is centred). Its middle sits at 41% of the window's height, the middle of the sky above the hills, and never closer than 112px to the top (192px on phones, 40px under the name pill). A small script in `index.html` measures the block's height for that. All of these values are custom properties at the top of `homepage.css`.

With `?tune`, the **Homepage** panel has sliders for every size, line height, tracking and gap, the block's centre and the name's position, plus a folder per part (name, headline, years and places, roles) for its colour and font, and copy for the name and headline. Its slider defaults are read from `homepage.css`, and its values are saved under `grass-website-homepage-v4`.

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

A separate **Card hover** panel tunes the Work covers' hover: the spring (stiffness/damping/mass, or duration/bounce), lift (scale) and the shadow's offset, blur, opacity and colour. **Hold hover** pins every cover in its hovered state and **Replay on first card** bounces one in and out. Its values live under `localStorage` key `grass-website-card-hover`; the shipped defaults are the `--cover-*` custom properties on `.work-rail` in `index.html`.

DialKit 2.1.0's plain-JavaScript build is vendored in `vendor/dialkit/` (MIT, Josh Puckett); `tune.js` builds the panel and drives the scene through a small API that `index.html` hands it.

## Sounds

`sounds.js` gives everything clickable a sound, using [Cuelume](https://github.com/danielwh2/cuelume) 0.2.8's mech theme (MIT, Daniel Belyi, vendored in `vendor/cuelume/` and mapped as `cuelume` in the import map). The sounds are synthesised live with Web Audio, so there are no audio files.

| Moment | Cue |
| --- | --- |
| Mouse lands on a clickable thing (nav, name, Work cards, the sheet's close gap, the ball) | `select`: a detent that rises toward later siblings and falls toward earlier ones; at most one every 50 ms |
| Pressing anything clickable | `toggle`: one snap |
| Pressing the ball | `navigate` in the bubble theme |
| Going back from a case study (close gap, back chip, "Go back") | `close` |

A mouse sounds on press-down; touch, pen and Enter/Space sound on the click itself, so a scroll that starts on a card stays silent. Hover is mouse-only and stays quiet until the visitor's first click or key press, since browsers block sound before then. It also stays quiet when the page moves under a still pointer (scrolling, the sheet growing). Only the homepage and the ball are covered: the case studies inside the sheet, and the `?tune` and `?annotate` panels, have no sounds.

## Case-study sheet

`project-sheet.js` opens the Work cards the way the Framer homepage does (a port of `PageProjectInteractions.tsx`, values unchanged). The sheet grows out of the clicked card and closes back into it. It sits 16px from every edge. That gap is the close button: hovering it shows the back chip, slides the sheet 24px away from that edge and clears the blur behind. Esc, Back and the case study's own home link close it, and Forward reopens it.

The case studies are the live Framer pages. `vercel.json` proxies `/verdigris-ai`, `/soundtransit-search` and `/e-commerce-product-creation` from aashikaashok.com onto this origin (marked `noindex`), so the sheet can reach into them: it hides their floating nav, waits for their fonts and swaps projects in place. A direct visit to one of those paths is sent to `/?case-study=…` by the Framer page and opens here over Work. Add a project by adding its card and its path to both files.

## URL parameters

Any setting can be overridden for testing, for example `?len=0.8&deskX=1.5`. Passing `wind` or `gust` turns the live Seattle wind off, and so does `?seattle=0`. `?t=3&paused=1` freezes a frame. `?debug=1` shows the frame rate, the canvas size and the current Seattle reading.
