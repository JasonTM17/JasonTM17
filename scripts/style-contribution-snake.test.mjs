import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { styleContributionSnake } from "./style-contribution-snake.mjs";

const KEYFRAMES = '@keyframes snake{0%{transform:translate(0,0)}100%{transform:translate(16px,0)}}';
const SOURCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -32 880 192" width="880" height="192"><desc>Fixture</desc><style>:root{--cs:purple;--ce:#161b22}.c{animation:snake 80s linear infinite}.c.c1{fill:var(--c3)}${KEYFRAMES}</style><rect class="c c1" x="2" y="2" width="12" height="12"/><rect class="u u1" x="1" y="144" width="200" height="12"/><rect class="s s0" x="0.8" y="0.8" width="14.4" height="14.4"/></svg>`;

test("styling preserves contribution cells and snake keyframes while framing the real graph", () => {
  const svg = styleContributionSnake(SOURCE,{theme:"dark"});
  assert.ok(svg.includes(KEYFRAMES));
  assert.ok(svg.includes('<rect class="c c1" x="2" y="2" width="12" height="12"/>'));
  assert.ok(svg.includes('<rect class="s s0" x="0.8" y="0.8" width="14.4" height="14.4"/>'));
  assert.match(svg,/viewBox="-28 -32 904 204"/);
  assert.match(svg,/rx="16" fill="#0d151c" stroke="#2b3a45"/);
  assert.match(svg,/<rect class="u u1"[^>]+height="4"/);
});

test("mint theme override follows upstream CSS and has distinct light/dark palettes", () => {
  const dark = styleContributionSnake(SOURCE,{theme:"dark"});
  const light = styleContributionSnake(SOURCE,{theme:"light"});
  assert.ok(dark.indexOf('--cs:#b3f4e5') > dark.indexOf('--cs:purple'));
  assert.match(dark,/--c4:#67c3a0/);
  assert.match(light,/--cs:#0f766e/);
  assert.match(light,/fill="#f8faf9"/);
});

test("reduced motion keeps the initial calendar and hides the snake/progress indicator", () => {
  const svg = styleContributionSnake(SOURCE,{staticMode:true});
  assert.match(svg,/\.c\{animation:none!important\}\.s,\.u\{display:none\}/);
  assert.match(svg,/\.c\.c1\{fill:var\(--c3\)\}/);
  const animated = styleContributionSnake(SOURCE);
  assert.match(animated,/@media\(prefers-reduced-motion:reduce\)/);
});

test("unsupported SVGs and repeat styling fail closed", () => {
  for (const source of ['<svg/>',SOURCE.replace('880 192','NaN 192'),SOURCE.replace('</svg>','<script>alert(1)</script></svg>'),SOURCE.replace('class="c c1"','onclick="x" class="c c1"')]) {
    assert.throws(()=>styleContributionSnake(source),/Expected|Refusing/);
  }
  assert.throws(()=>styleContributionSnake(styleContributionSnake(SOURCE)),/Refusing/);
  assert.throws(()=>styleContributionSnake(SOURCE,{theme:"other"}),/Unknown/);
});

test("workflow styles before publishing and README includes static theme alternatives", async () => {
  const workflow = await readFile(new URL('../.github/workflows/generate-contribution-snake.yml',import.meta.url),'utf8');
  assert.ok(workflow.indexOf('node scripts/style-contribution-snake.mjs dist') < workflow.indexOf('target_branch: output'));
  assert.match(workflow,/Platane\/snk\/svg-only@[0-9a-f]{40} # v3\.5\.0/);
  assert.match(workflow,/crazy-max\/ghaction-github-pages@[0-9a-f]{40} # v5\.0\.0/);
  const readme = await readFile(new URL('../README.md',import.meta.url),'utf8');
  assert.match(readme,/prefers-reduced-motion: reduce\)" srcset="https:\/\/raw\.githubusercontent\.com\/JasonTM17\/JasonTM17\/output\/github-contribution-grid-snake-dark-static\.svg"/);
  assert.match(readme,/github-contribution-grid-snake-static\.svg/);
});
