import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { styleContributionSnake } from "./style-contribution-snake.mjs";

function matrixFixture(columns = 53, rows = 7) {
  const cells = Array.from({ length: columns * rows }, (_, index) => `<rect class="c${index === 0 ? ' c1' : ''}" x="${2 + index % columns * 16}" y="${2 + Math.floor(index / columns) * 16}" width="12" height="12"/>`).join("");
  const paths = Array.from({ length: 4 }, (_, index) => `@keyframes s${index}{0%,100%{transform:translate(0px,-16px)}25%{transform:translate(${columns * 16}px,0px)}50%{transform:translate(16px,${rows * 16}px)}75%{transform:translate(0px,0px)}}.s.s${index}{animation-name:s${index}}`).join("");
  const segments = Array.from({ length: 4 }, (_, index) => `<rect class="s s${index}" x="${0.8 + index}" y="${0.8 + index}" width="${14.4 - index * 1.4}" height="${14.4 - index * 1.4}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -32 880 192" width="880" height="192"><desc>Fixture</desc><style>:root{--cs:purple;--ce:#161b22}.c{animation:none 83100ms linear infinite}.c.c1{fill:var(--c3);animation-name:c1}@keyframes c1{12%{fill:var(--c3)}12.1%,100%{fill:var(--ce)}}.s{animation:none linear 83100ms infinite}${paths}</style>${cells}<rect class="u u1" x="1" y="144" width="200" height="12"/>${segments}</svg>`;
}

const SOURCE = matrixFixture(5,3);

function numericAttribute(tag, name) {
  return Number(tag.match(new RegExp(`\\b${name}="([^\"]+)"`))?.[1]);
}

function movementFrames(svg, index) {
  const keyframes = svg.match(new RegExp(`@keyframes s${index}\\{(?:[^{}]|\\{[^{}]*\\})*\\}`))?.[0];
  assert.ok(keyframes, `segment ${index} has movement keyframes`);
  return [...keyframes.matchAll(/([\d.% ,]+)\{transform:translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\}/g)]
    .flatMap(match => [...match[1].matchAll(/([\d.]+)%/g)].map(time => ({ time: Number(time[1]), x: Number(match[2]), y: Number(match[3]) })))
    .sort((a,b) => a.time - b.time);
}

function positionAt(frames, time) {
  const end = frames.findIndex(frame => frame.time >= time);
  assert.ok(end >= 0, "the complete 0–100% cycle is defined");
  if (!end) return frames[0];
  const a = frames[end-1], b = frames[end], ratio = (time-a.time)/(b.time-a.time);
  return { x:a.x+(b.x-a.x)*ratio, y:a.y+(b.y-a.y)*ratio };
}

function assertContained(svg) {
  const cells = [...svg.matchAll(/<rect\b[^>]*class="c(?:\s[^\"]*)?"[^>]*>/g)].map(match => match[0]);
  const left = Math.min(...cells.map(tag => numericAttribute(tag, "x"))) + 1;
  const top = Math.min(...cells.map(tag => numericAttribute(tag, "y"))) + 1;
  const right = Math.max(...cells.map(tag => numericAttribute(tag, "x"))) + 11;
  const bottom = Math.max(...cells.map(tag => numericAttribute(tag, "y"))) + 11;
  for (let index = 0; index < 4; index++) {
    const tag = svg.match(new RegExp(`<rect\\b[^>]*class="s s${index}"[^>]*>`))?.[0];
    assert.ok(tag);
    for (const frame of movementFrames(svg, index)) {
      const x = numericAttribute(tag, "x") + frame.x, y = numericAttribute(tag, "y") + frame.y;
      assert.ok(x >= left - 1e-6 && y >= top - 1e-6
        && x + numericAttribute(tag, "width") <= right + 1e-6
        && y + numericAttribute(tag, "height") <= bottom + 1e-6,
      `segment ${index} at ${frame.time}% leaves matrix [${left},${top},${right},${bottom}]: ${x},${y}`);
    }
  }
}

test("every snake segment stays inside the matrix throughout the complete loop", () => {
  for (const columns of [53, 54]) for (const theme of ["light", "dark"]) {
    assertContained(styleContributionSnake(matrixFixture(columns), { theme }));
  }
});

test("movement turns through the interior instead of scanning rows", () => {
  const head = movementFrames(styleContributionSnake(matrixFixture()),0);
  const verticalColumns = new Set(head.slice(1).flatMap((b,index) => {
    const a = head[index];
    return a.x === b.x && a.y !== b.y && a.x > 0 && a.x < 52*16 ? [a.x] : [];
  }));
  assert.ok(verticalColumns.size >= 26, `varied interior turns expected, found ${verticalColumns.size} columns`);
});

test("calendar-seeded paths are repeatable across themes and vary with the data", () => {
  const source = matrixFixture();
  const light = styleContributionSnake(source), dark = styleContributionSnake(source,{theme:"dark"});
  assert.equal(styleContributionSnake(source),light);
  for (let index = 0; index < 4; index++) assert.deepEqual(movementFrames(light,index),movementFrames(dark,index));
  const changed = styleContributionSnake(source.replace('fill:var(--c3)','fill:var(--c4)'));
  assert.notDeepEqual(movementFrames(light,0),movementFrames(changed,0));
});

test("all four segments occupy legal distinct cells at every tick for multiple seeds", () => {
  for (const columns of [53,54]) for (const level of [1,2,3,4]) {
    const svg = styleContributionSnake(matrixFixture(columns).replace('fill:var(--c3)',`fill:var(--c${level})`));
    assertContained(svg);
    const paths = Array.from({length:4}, (_,index) => movementFrames(svg,index));
    const length = paths[0].slice(1).reduce((sum,b,index) => sum+(Math.abs(b.x-paths[0][index].x)+Math.abs(b.y-paths[0][index].y))/16,0);
    assert.equal(Number(svg.match(/\.c,\.s\{animation-duration:(\d+)ms\}/)?.[1]),length*160,"longer paths keep the same speed per cell");
    for (let step = 0; step < length; step++) {
      const cells = paths.map(path => {
        const point = positionAt(path,step/length*100);
        const x = Math.round(point.x/16), y = Math.round(point.y/16);
        assert.ok(Math.hypot(point.x-x*16,point.y-y*16) < 0.001,"every tick lands on a grid cell");
        return `${x},${y}`;
      });
      assert.equal(new Set(cells).size,4,`no head/body collision at tick ${step}`);
    }
  }
});

test("partial weeks never send the head or body into an absent calendar cell", () => {
  const source = matrixFixture().replace(/<rect class="c c1"[^>]+\/>/,'')
    .replace('<rect class="c" x="834" y="98" width="12" height="12"/>','');
  const svg = styleContributionSnake(source);
  const paths = Array.from({length:4}, (_,index) => movementFrames(svg,index));
  const length = paths[0].slice(1).reduce((sum,b,index) => sum+(Math.abs(b.x-paths[0][index].x)+Math.abs(b.y-paths[0][index].y))/16,0);
  const visited = new Set();
  for (let step = 0; step < length; step++) for (const [index,path] of paths.entries()) {
    const point = positionAt(path,step/length*100);
    const cell = `${Math.round(point.x/16)},${Math.round(point.y/16)}`;
    assert.ok(cell !== '0,0' && cell !== '52,6',`absent cell ${cell} must never be visited`);
    if (!index) visited.add(cell);
  }
  assert.equal(visited.size,53*7-2);
});

test("the loop closes continuously and the body follows one shared route", () => {
  for (const [columns,rows] of [[3,2],[5,3],[53,7],[54,7]]) {
    const svg = styleContributionSnake(matrixFixture(columns,rows));
    assertContained(svg);
    const paths = Array.from({length:4}, (_,index) => movementFrames(svg,index));
    const head = paths[0];
    const length = head.slice(1).reduce((sum,b,index) => {
      const a = head[index];
      assert.ok(a.x === b.x || a.y === b.y, "movement follows rows/columns, never diagonal shortcuts");
      return sum + (Math.abs(b.x-a.x)+Math.abs(b.y-a.y))/16;
    },0);
    for (const [index,frames] of paths.entries()) {
      assert.equal(frames[0].time,0);
      assert.equal(frames.at(-1).time,100);
      assert.equal(frames[0].x,frames.at(-1).x);
      assert.equal(frames[0].y,frames.at(-1).y);
      const times = frames.flatMap((frame,i) => i ? [frame.time,(frame.time+frames[i-1].time)/2] : [0]);
      for (const time of times) {
        const actual = positionAt(frames,time);
        const expected = positionAt(head,((time-index*100/length)%100+100)%100);
        assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y) < 0.001, "body keeps its one-cell delay, including the restart");
      }
    }
    // Inspect every real cell, including cells between the compressed corners.
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const visited = head.slice(1).some((b,index) => {
        const a = head[index], x = column*16, y = row*16;
        return x >= Math.min(a.x,b.x) && x <= Math.max(a.x,b.x)
          && y >= Math.min(a.y,b.y) && y <= Math.max(a.y,b.y);
      });
      assert.ok(visited, `calendar cell ${column},${row} is visited`);
    }
  }
});

test("contribution clearing follows the first head visit and preserves the actual level", () => {
  const source = SOURCE.replace('class="c" x="66" y="34"','class="c c2" x="66" y="34"')
    .replace('</style>', '.c.c2{fill:var(--c4);animation-name:c2}@keyframes c2{40%{fill:var(--c4)}41%,100%{fill:var(--ce)}}</style>');
  const svg = styleContributionSnake(source);
  const head = movementFrames(svg,0);
  for (const [id,x,y,level] of [['c1',0,0,3],['c2',64,32,4]]) {
    const rule = svg.match(new RegExp(`@keyframes ${id}\\{([\\d.]+)%\\{fill:var\\(--c${level}\\)\\}([\\d.]+)%,100%\\{fill:var\\(--ce\\)\\}\\}`));
    assert.ok(rule);
    const point = positionAt(head,Number(rule[1]));
    assert.ok(Math.hypot(point.x-x,point.y-y) < 0.001);
    assert.ok(Number(rule[2]) > Number(rule[1]));
    assert.ok(svg.includes(`.c.${id}{fill:var(--c${level});animation-name:${id}}`));
  }
});

test("styling preserves contribution cells and initial levels while framing the real graph", () => {
  const svg = styleContributionSnake(SOURCE,{theme:"dark"});
  assert.ok(svg.includes('<rect class="c c1" x="2" y="2" width="12" height="12"/>'));
  assert.match(svg,/\.c\.c1\{fill:var\(--c3\);animation-name:c1\}/);
  assert.match(svg,/class="s s0" x="3" y="3" width="10" height="10"/);
  assert.match(svg,/viewBox="-28 -32 904 176"/);
  assert.match(svg,/rx="16" fill="#0d151c" stroke="#28383e"/);
  assert.match(svg,/<rect class="u u1"[^>]+height="12"/);
  assert.match(svg,/\.u\{display:none\}/);
});

test("mint theme override follows upstream CSS and has distinct light/dark palettes", () => {
  const dark = styleContributionSnake(SOURCE,{theme:"dark"});
  const light = styleContributionSnake(SOURCE,{theme:"light"});
  assert.ok(dark.indexOf('--cs:#b3f4e5') > dark.indexOf('--cs:purple'));
  assert.match(dark,/--c4:#69c3a0/);
  assert.match(light,/--cs:#0f766e/);
  assert.match(light,/fill="#fafcfb"/);
});

test("a small face follows the bounded head without a shadow escaping the edge", () => {
  const svg = styleContributionSnake(SOURCE,{theme:"dark"});
  assert.equal([...svg.matchAll(/<circle class="s s0 profile-eye"/g)].length,2);
  assert.match(svg,/cx="6\.400" cy="6\.900" r="0\.85"/);
  assert.match(svg,/cx="9\.800" cy="6\.900" r="0\.85"/);
  assert.match(svg,/id="profile-head-gradient"/);
  assert.match(svg,/\.c\{width:10px;height:10px;stroke:none;transform:translate\(1px,1px\)\}/);
  assert.match(svg,/\.s\{filter:none\}/);
  assert.doesNotMatch(svg,/<(?:clipPath|mask|filter)\b/);
});

test("reduced motion keeps the initial calendar and hides the snake/progress indicator", () => {
  const svg = styleContributionSnake(SOURCE,{staticMode:true});
  assert.match(svg,/\.c\{animation:none!important\}\.s,\.u\{display:none\}/);
  assert.match(svg,/\.c\.c1\{fill:var\(--c3\);animation-name:c1\}/);
  const animated = styleContributionSnake(SOURCE);
  assert.match(animated,/@media\(prefers-reduced-motion:reduce\)/);
});

test("unsupported SVGs and repeat styling fail closed", () => {
  for (const source of ['<svg/>',SOURCE.replace('880 192','NaN 192'),SOURCE.replace('</svg>','<script>alert(1)</script></svg>'),SOURCE.replace('class="c c1"','onclick="x" class="c c1"')]) {
    assert.throws(()=>styleContributionSnake(source),/Expected|Refusing/);
  }
  assert.throws(()=>styleContributionSnake(styleContributionSnake(SOURCE)),/Refusing/);
  assert.throws(()=>styleContributionSnake(SOURCE,{theme:"other"}),/Unknown/);
  for (const source of [SOURCE.replace('x="66"','x="67"'),SOURCE.replace(/<rect class="s s3"[^>]+\/>/,''),SOURCE.replace('@keyframes s2','@keyframes missing'),SOURCE.replace('fill:var(--c3)','fill:var(--unknown)')]) {
    assert.throws(()=>styleContributionSnake(source),/Expected/);
  }
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
