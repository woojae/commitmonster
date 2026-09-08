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
- `vendor/` — pinned local copies of the Codicons and Press Start 2P fonts, so
  the page loads nothing from third-party hosts (see `vendor/README.md`).

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
`resume`, `frenzy`, `openFile`, `commit`, `tick`, `install`, `uninstall`,
`extensions`).
