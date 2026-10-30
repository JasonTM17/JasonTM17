import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THEMES = {
  light: { background: "#fafcfb", border: "#d5e2db", cellBorder: "transparent", snake: "#0f766e", head: ["#198b76", "#105d51"], body: ["#279783", "#4cad95", "#86c6b3"], eye: "#effff8", dots: ["#e9efed", "#d0eade", "#9ed8c5", "#62b89b", "#2c876c"] },
  dark: { background: "#0d151c", border: "#28383e", cellBorder: "transparent", snake: "#b3f4e5", head: ["#defff4", "#80dcbc"], body: ["#89d6be", "#59b99a", "#368e72"], eye: "#143c32", dots: ["#162128", "#163d34", "#25624f", "#3f9979", "#69c3a0"] },
};

const attribute = (tag, name) => Number(tag?.match(new RegExp(`\\b${name}="([0-9.]+)"`))?.[1]);
const percent = (step, length) => Number((step / length * 100).toFixed(6));

function variedRoute(columns, rows, seed, allowed) {
  const count = columns*rows;
  const neighbors = Array.from({length:count}, (_,cell) => [
    cell%columns > 0 ? cell-1 : -1, cell%columns < columns-1 ? cell+1 : -1,
    cell >= columns ? cell-columns : -1, cell < count-columns ? cell+columns : -1,
  ].filter(value => value >= 0 && allowed.has(cell) && allowed.has(value)));
  const key = pose => pose.reduce((value,cell) => value*count+cell,0);
  const middle = Math.floor(rows/2)*columns+Math.max(3,Math.floor(columns/2));
  const start = columns > 3 ? [middle,middle-1,middle-2,middle-3] : [5,4,3,0];
  if (start.some(cell => !allowed.has(cell))) throw new Error("Expected interior calendar cells for the starting pose.");
  const startKey = key(start);
  // Reverse state search proves a legal return for the whole body, not just
  // the head. Moving into the previous tail cell is legal because it vacates.
  const returnToStart = new Map([[startKey,null]]), reverse = [start];
  for (let index = 0; index < reverse.length; index++) {
    const pose = reverse[index];
    for (const tail of neighbors[pose[3]]) {
      if (pose.slice(1).includes(tail)) continue;
      const previous = [...pose.slice(1),tail], id = key(previous);
      if (!returnToStart.has(id)) {
        returnToStart.set(id,pose);
        reverse.push(previous);
      }
    }
  }
  let state = seed;
  const random = () => {
    state = (state+0x6d2b79f5)|0;
    let value = Math.imul(state^(state>>>15),state|1);
    value ^= value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
  const shuffled = values => {
    const result = [...values];
    for (let index = result.length-1; index > 0; index--) {
      const other = Math.floor(random()*(index+1));
      [result[index],result[other]] = [result[other],result[index]];
    }
    return result;
  };
  let pose = start;
  const route = [start[0]], unvisited = new Set(allowed);
  unvisited.delete(start[0]);
  while (unvisited.size) {
    const queue = [{pose,parent:-1}], seen = new Set([key(pose)]);
    let goal = -1;
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index].pose;
      if (unvisited.has(current[0])) { goal = index; break; }
      for (const head of shuffled(neighbors[current[0]])) {
        if (current.slice(0,3).includes(head)) continue;
        const next = [head,...current.slice(0,3)], id = key(next);
        if (seen.has(id) || !returnToStart.has(id)) continue;
        seen.add(id);
        queue.push({pose:next,parent:index});
      }
    }
    if (goal < 0) throw new Error("Cannot cover the contribution matrix with a legal snake route.");
    const path = [];
    for (let index = goal; queue[index].parent >= 0; index = queue[index].parent) path.push(queue[index].pose);
    for (const next of path.reverse()) { route.push(next[0]); unvisited.delete(next[0]); }
    pose = queue[goal].pose;
  }
  while (key(pose) !== startKey) {
    pose = returnToStart.get(key(pose));
    if (!pose) throw new Error("Cannot close the contribution snake loop.");
    route.push(pose[0]);
  }
  route.pop(); // the 100% frame closes the exact four-segment starting pose
  return route.map(cell => [cell%columns,Math.floor(cell/columns)]);
}

function containCalendarAnimation(body) {
  const cells = [...body.matchAll(/<rect\b[^>]*class="c(?:\s[^\"]*)?"[^>]*>/g)].map(match => ({
    tag: match[0], x: attribute(match[0], "x"), y: attribute(match[0], "y"),
  }));
  const xs = [...new Set(cells.map(cell => cell.x))].sort((a,b) => a-b);
  const ys = [...new Set(cells.map(cell => cell.y))].sort((a,b) => a-b);
  if (xs.length < 3 || xs.length > 54 || ys.length < 2 || ys.length > 7
    || [...xs, ...ys].some(value => !Number.isFinite(value))
    || [xs,ys].some(axis => axis.some((value,index) => index > 0 && value - axis[index-1] !== 16))) {
    throw new Error("Expected the pinned generator's regular contribution matrix.");
  }
  let seed = 2166136261;
  for (const cell of cells) {
    cell.id = cell.tag.match(/class="c (c[0-9a-z]+)"/)?.[1];
    cell.level = cell.id ? body.match(new RegExp(`\\.c\\.${cell.id}\\{fill:var\\(--c([0-4])\\)`))?.[1] : "0";
    if (cell.level === undefined) throw new Error("Expected the original contribution level.");
    for (const char of `${cell.x},${cell.y}:${cell.level};`) seed = Math.imul(seed^char.charCodeAt(0),16777619);
  }
  const allowed = new Set(cells.map(cell => ys.indexOf(cell.y)*xs.length+xs.indexOf(cell.x)));
  const route = variedRoute(xs.length,ys.length,seed,allowed);
  const firstVisit = new Map();
  route.forEach(([column,row], index) => {
    const key = `${xs[column]},${ys[row]}`;
    if (!firstVisit.has(key)) firstVisit.set(key,index);
  });
  const rules = new Map();
  for (const cell of cells) {
    const id = cell.id;
    if (!id) continue;
    const level = cell.level;
    const step = firstVisit.get(`${cell.x},${cell.y}`);
    if (level === undefined || step === undefined) throw new Error("Expected contribution level and route position.");
    rules.set(id, `@keyframes ${id}{${percent(step,route.length)}%{fill:var(--c${level})}${percent(step+0.25,route.length)}%,100%{fill:var(--ce)}}`);
  }
  const sizes = [10,8.6,7.6,6.8];
  for (const [index,size] of sizes.entries()) {
    const rect = new RegExp(`<rect\\b[^>]*class="s s${index}"[^>]*>`);
    if (!rect.test(body)) throw new Error("Expected all four original snake segments.");
    const geometry = `x="${xs[0]+6-size/2}" y="${ys[0]+6-size/2}" width="${size}" height="${size}" rx="${size*0.3}" ry="${size*0.3}"`;
    body = body.replace(rect, `<rect class="s s${index}" ${geometry}/>`);
    const points = Array.from({length:route.length+1}, (_,step) => route[(step-index+route.length)%route.length]);
    // Keep every turn and endpoint; interpolation never cuts across a corner.
    const frames = points.map(([column,row],step) => {
      const before = points[step-1], after = points[step+1];
      if (before && after && column-before[0] === after[0]-column && row-before[1] === after[1]-row) return "";
      return `${percent(step,route.length)}%{transform:translate(${column*16}px,${row*16}px)}`;
    }).join("");
    rules.set(`s${index}`, `@keyframes s${index}{${frames}}`);
  }
  body = body.replace(/@keyframes\s+([a-z0-9]+)\{(?:[^{}]|\{[^{}]*\})*\}/g, (rule,id) => {
    const replacement = rules.get(id);
    rules.delete(id);
    return replacement ?? rule;
  });
  if (rules.size) throw new Error("Expected the original contribution and snake animations.");
  return {body,duration:route.length*160};
}

export function styleContributionSnake(source, { theme = "light", staticMode = false } = {}) {
  const palette = THEMES[theme];
  if (!palette) throw new Error("Unknown contribution theme.");
  const opening = source.match(/^<svg\b[^>]*>/);
  const viewBox = opening?.[0].match(/\bviewBox="([^"]+)"/);
  const box = viewBox?.[1].trim().split(/\s+/).map(Number);
  if (!opening || !source.trimEnd().endsWith("</svg>") || !box || box.length !== 4
    || box.some(value => !Number.isFinite(value)) || box[2] <= 0 || box[3] <= 0 || box[2] > 5000 || box[3] > 5000
    || !source.includes('@keyframes') || !/class="c(?:\s|\")/.test(source)) {
    throw new Error("Expected an animated SVG from the pinned contribution generator.");
  }
  if (/data-profile-snake=|<(?:script|foreignObject|image|use|a)\b|\bon[a-z]+\s*=|(?:href|xlink:href)\s*=|<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new Error("Refusing an already styled or unsupported contribution SVG.");
  }
  const [x, y, width, height] = box;
  const frame = [x - 12, y, width + 24, height - 16];
  const {body,duration} = containCalendarAnimation(source.slice(opening[0].length, source.lastIndexOf("</svg>")));
  const head = [...body.matchAll(/<rect\b[^>]*>/g)].map(match=>match[0]).find(tag=>tag.match(/\bclass="([^"]+)"/)?.[1].split(/\s+/).includes("s0"));
  const geometry = ["x", "y", "width", "height"].map(name=>Number(head?.match(new RegExp(`\\b${name}="([0-9.]+)"`))?.[1]));
  if (geometry.some(value=>!Number.isFinite(value)) || geometry[2] <= 0 || geometry[3] <= 0) {
    throw new Error("Expected the original animated snake head geometry.");
  }
  const [hx, hy, hw, hh] = geometry;
  // Eyes share the bounded head animation, including the loop seam.
  const eyes = [0.34, 0.68].map(offset=>`<circle class="s s0 profile-eye" cx="${(hx+hw*offset).toFixed(3)}" cy="${(hy+hh*0.39).toFixed(3)}" r="0.85"/>`).join("");
  const css = `:root{--cb:${palette.cellBorder};--cs:${palette.snake};--ce:${palette.dots[0]};${palette.dots.map((color,index)=>`--c${index}:${color}`).join(";")}}`;
  const finish = `.c{width:10px;height:10px;stroke:none;transform:translate(1px,1px)}.c,.s{animation-duration:${duration}ms}.u{display:none}.s{filter:none}.s.s0{fill:url(#profile-head-gradient)}${palette.body.map((color,index)=>`.s.s${index+1}{fill:${color}}`).join("")}.s.profile-eye{fill:${palette.eye};filter:none}`;
  const still = ".c{animation:none!important}.s,.u{display:none}";
  const accessibility = staticMode ? still : `@media(prefers-reduced-motion:reduce){${still}}`;
  const mode = staticMode ? "Static contribution calendar" : "Animated contribution calendar";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.join(" ")}" width="${frame[2]}" height="${frame[3]}" role="img" aria-labelledby="profile-snake-title profile-snake-desc" data-profile-snake="mint-v4">
<title id="profile-snake-title">${mode} for Nguyen Son</title>
<desc id="profile-snake-desc">Actual GitHub contribution history with a mint palette. The snake moves in varied directions entirely within the calendar matrix.</desc>
<defs><linearGradient id="profile-head-gradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.head[0]}"/><stop offset="1" stop-color="${palette.head[1]}"/></linearGradient></defs>
<rect x="${frame[0]+0.5}" y="${frame[1]+0.5}" width="${frame[2]-1}" height="${frame[3]-1}" rx="16" fill="${palette.background}" stroke="${palette.border}"/>
${body}
${eyes}
<style>${css}${finish}${accessibility}</style>
</svg>\n`;
}

export async function styleSnakeOutputs(directory = "dist") {
  const files = [];
  for (const theme of ["light", "dark"]) {
    const stem = `github-contribution-grid-snake${theme === "dark" ? "-dark" : ""}`;
    const source = await readFile(path.join(directory, `${stem}.svg`), "utf8");
    for (const staticMode of [false, true]) {
      files.push([`${stem}${staticMode ? "-static" : ""}.svg`, styleContributionSnake(source, { theme, staticMode })]);
    }
  }
  // Compute/validate all variants before replacing any generated file.
  for (const [name, svg] of files) await writeFile(path.join(directory, name), svg, "utf8");
  console.log("Styled contribution calendar: light/dark animation and static alternatives.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  styleSnakeOutputs(process.argv[2]).catch(() => {
    console.error("Contribution styling failed; generated assets were not published.");
    process.exitCode = 1;
  });
}
