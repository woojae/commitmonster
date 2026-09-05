# Security review

Reviewed the static Commit Monster source on 2026-09-04, starting at commit
`5f7989f`. This is the HTML/CSS/JavaScript version with `vercel.json`, not the
earlier React/Sites deployment. These changes are local and have not been
published or verified against a production URL.

## Findings addressed

- **Browser resource exhaustion:** the old 600-row check ran only after an
  entire source line had been wrapped and tokenized. A single large pasted
  line could exceed that cap by an arbitrary amount. Input is now capped at
  50,000 UTF-16 code units before normalization and again after tab expansion;
  wrapping stops inside the loop at 600 rows. Outline regex inputs, search
  result rendering, commit messages, and output/debug logs are bounded too.
  This affected the visitor's own browser; no remote server denial of service
  was demonstrated.
- **Deployment-file exposure risk:** the old configuration did not specify a
  public output directory, and this checkout contains legacy build artifacts.
  A dependency-free packaging step now copies an explicit allowlist of 11
  public files into `site/`, and Vercel is configured to publish only that
  directory. Extra output files and symbolic links fail the build. Production
  exposure was not demonstrated; this closes the configuration risk.
- **Browser policy hardening:** removed remote font/icon requests and bundled
  the existing assets and licenses. Removed inline style attributes and the
  `unsafe-inline` permission. The configured CSP blocks network API requests,
  forms, object embeds, base-URL overrides, and framing. Framing also has an
  `X-Frame-Options: DENY` fallback. HTTP headers take effect only on deployment.
- **Invalid file IDs:** the console file selector now accepts only known snack
  IDs or the README, rejecting inherited keys such as `constructor` and
  `__proto__` without corrupting the UI state.
- **Accidental commits:** common environment files, private key files, local
  Vercel configuration, and generated output are ignored by Git. This does not
  remove secrets already tracked by Git.

## Checks and results

- No server endpoints, authentication implementation, database, file uploads,
  or server-side execution are present in the current application.
- Pasted code is held in page memory. The first-party scripts have no network
  or storage API calls, and never evaluate pasted snippets. HTML rendering of
  source text, searches, and commit messages uses escaping. The terminal and
  Git commands are simulated text, not shell execution.
- A high-confidence scan for common private-key, AWS access-key, GitHub-token,
  and OpenAI project-key patterns found no matches in the tracked source.
  This was not a comprehensive secret scan of all Git history or local files.
- There is no application package manifest or npm dependency graph to audit.
  OSV was queried for `npm/@vscode/codicons` version `0.0.36` and returned `{}`,
  meaning no matching advisories were reported by that query. Only its CSS
  and font are shipped. Press Start 2P is a pinned font binary, not a runtime
  JavaScript dependency. These checks do not prove either font is defect-free.
- Nine regression tests pass with `node --test tests/security.test.mjs`.
  They cover malicious HTML in source and commit messages; very large lines
  and tab expansion; bounded search results; invalid file IDs; all eight
  built-in meals; policy configuration; and deployment allowlist/symlink
  checks. The HTML tests use a DOM harness, not a real browser.
- `node --check js/app.js`, `node --check js/snacks.js`, `git diff --check`,
  and `node scripts/build.mjs` pass. The output contains only approved assets.

## Verification limits

No browser connection was available in this session, so live CSP enforcement,
font rendering, and browser behavior have not been verified. After deploying
the current static version, verify the HTTP headers, local font/icon loading,
and that `/.env`, `/.git/config`, `/dist/server/index.js`, and `/vercel.json`
are not publicly served. Inspect those responses without publishing their
contents if an unexpected exposure is found.

The earlier private `chatgpt.site` URL and the hosting account's access controls
were not changed or certified by this review. Legacy ignored `node_modules/`
and framework output remain on disk but are excluded from the new deployment
output. Keep the host, browser, and local Node.js installation maintained.

No remaining exploitable issue was demonstrated in the reviewed application
paths after these changes. This is a scoped review, not a guarantee that the
site or its hosting platform has no vulnerabilities.

## References

- [Vercel: build and output directory configuration](https://vercel.com/docs/builds/configure-a-build)
- [Vercel: static project configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [MDN: CSP style-src-attr and direct style-property changes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr)
- [OSV vulnerability query API](https://google.github.io/osv.dev/api/)
