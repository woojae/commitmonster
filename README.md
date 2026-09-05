# commitmonster

A furry blue monster eats your codebase, one character at a time, inside a
full-page Visual Studio Code lookalike.

Live version of the little "Commit Monster" program from woojae.github.io,
grown into its own site.

## Running it

It is a static site with no package dependencies. Package only the approved
public assets with Node.js, then serve that output on your own machine:

```sh
node scripts/build.mjs
python3 -m http.server 8000 --bind 127.0.0.1 --directory site
```

Then visit http://localhost:8000.

Vercel runs the same packaging command and serves only `site/`. Do not publish
the repository root: it may contain local configuration or old build output.
The packaging command refuses unexpected files and symbolic links in `site/`.

## What is in the box

- `index.html` — the workbench: title bar, activity bar, explorer, tabs,
  editor, panel, status bar, command palette.
- `css/style.css` — Dark+ styling for the workbench.
- `js/snacks.js` — the code samples he eats. Real excerpts from SQLite, Lua,
  Redis, curl, Go, CPython, React and Rust; each carries its license in its
  header comment.
- `js/app.js` — the monster, the canvas editor, and all the workbench wiring.

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

A small console API is exposed as `window.CommitMonster` (`feed`, `pause`,
`resume`, `frenzy`, `openFile`, `commit`, `tick`).

## Privacy and security

Pasted code stays in memory in the current page. It is drawn on a canvas or
rendered as escaped text; it is never executed, uploaded, or saved by the app.
The terminal, commit button, and extension installer are simulations.

Custom snippets are limited to 50,000 characters. A meal displays at most 600
wrapped editor rows. Output and debug logs are also bounded to prevent
unlimited memory growth during long sessions.

Fonts and icons are bundled locally with their licenses in `vendor/`.
Vercel's Content Security Policy disallows inline scripts and styles,
third-party resources, network API requests, forms, and framing. The HTML
also contains a fallback policy for ordinary static servers; HTTP-only
protections such as `frame-ancestors` and `X-Frame-Options` require the host
to apply the headers from `vercel.json`.

Run the security regressions with `node --test tests/security.test.mjs`.
See `SECURITY.md` for the review scope and deployment verification limits.
