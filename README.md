# commitmonster

A furry blue monster eats your codebase, one character at a time, inside a
full-page Visual Studio Code lookalike.

Live version of the little "Commit Monster" program from woojae.github.io,
grown into its own site.

## Running it

It is a static site with no build step. Open `index.html` in a browser, or
serve the folder:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## What is in the box

- `index.html` — the workbench: title bar, activity bar, explorer, tabs,
  editor, panel, status bar, command palette.
- `css/style.css` — Dark+ styling for the workbench.
- `js/snacks.js` — the code samples he eats. Real excerpts from SQLite, Lua,
  Redis, curl, Go, CPython, React and Rust; each carries its license in its
  header comment.
- `js/app.js` — the monster, the canvas editor, and all the workbench wiring.
- `js/muncher.js` — Commit Muncher, the maze game behind `muncher.game` in
  the Explorer (see below).
- `vendor/` — pinned local copies of the Codicons and Press Start 2P fonts, so
  the page loads nothing from third-party hosts until you play the music video
  (see `vendor/README.md`).

## Controls

| Action | How |
| --- | --- |
| Feed him | **Feed Me** button, `Space`, or Run in the menu bar |
| Frenzy | Click inside the editor while he eats |
| Stop / resume | **Stop** button or `Esc` |
| Hunger | Slider in the Commit Monster pane, or click the cookie in the status bar |
| Command palette | `⇧⌘P` or `F1`; `⌘P` for snacks only |
| Toggle side bar / panel | `⌘B` / `⌘J` |
| Your own code | Open `my-code.txt`, paste, press Feed Me |
| Extensions | `⇧⌘X`, search the list, click a row for details, Install / Uninstall |
| Play Commit Muncher | Open `muncher.game` in the Explorer, or `Commit Muncher: Play` in the palette |
| Watch the music video | Open `music-video.mp4` in the Explorer, or `Commit Monster: Play Music Video` in the palette |

## Commit Muncher

`muncher.game` is a Pac-Man-style arcade game starring the monster. He runs the
classic maze, drawn as an editor-blue neon outline. Pellets are syntax-colored
code glyphs, power pellets are cookies, and the four chasers are bugs:
NullPointer, RaceCondition, OffByOne and MemoryLeak, each with the classic
scatter/chase personality. Eat a cookie and the bugs become edible for a few
seconds; eaten bugs return to their house as eyes. A "PR" merge badge appears
twice a level as a bonus, and there is an extra life at 10,000.

Arrows or `WASD` to move, `P` or `Esc` to pause, swipe or the on-screen d-pad
on touch. The game pauses when you switch tabs. Your best score is kept in
`localStorage`; nothing leaves the page. Eating bugs, clearing a maze and
losing all show up in the terminal and the Timeline.

## Music video

`music-video.mp4` plays the [Commit Monster music video](https://www.youtube.com/watch?v=rKczy5114so).
It shows a poster until you press play. Only then does it embed the player
from `youtube-nocookie.com`, the one third-party origin the Content Security
Policy allows, as a frame. Closing or leaving the tab removes the player.

## Extensions

The Extensions view is a tiny marketplace. Installs are remembered in
`localStorage`.

- **Cookie Jar** puts a jar in the status bar. He earns a cookie every 8 lines
  he eats. Click the jar to give him one: a frenzy while he is eating, more
  hunger while he is not.
- **Bug Seasoning** sprinkles `TODO`, `FIXME` and `HACK` comments through every
  snack before he eats it, so the Problems panel fills up and the bug counter
  climbs faster.
- **Commit Monster** cannot be uninstalled. He ate the uninstaller.

A small console API is exposed as `window.CommitMonster` (`feed`, `pause`,
`resume`, `frenzy`, `openFile`, `commit`, `play`, `watch`, `tick`, `install`,
`uninstall`, `extensions`). The game has its own as `window.CommitMuncher`
(`start`, `pause`, `toggle`, `playing`, `score`).
