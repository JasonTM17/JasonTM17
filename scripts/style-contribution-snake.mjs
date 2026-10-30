import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THEMES = {
  light: { background: "#fafcfb", border: "#d5e2db", cellBorder: "transparent", snake: "#0f766e", head: ["#198b76", "#105d51"], body: ["#279783", "#4cad95", "#86c6b3"], eye: "#effff8", dots: ["#e9efed", "#d0eade", "#9ed8c5", "#62b89b", "#2c876c"] },
  dark: { background: "#0d151c", border: "#28383e", cellBorder: "transparent", snake: "#b3f4e5", head: ["#defff4", "#80dcbc"], body: ["#89d6be", "#59b99a", "#368e72"], eye: "#143c32", dots: ["#162128", "#163d34", "#25624f", "#3f9979", "#69c3a0"] },
};

const attribute = (tag, name) => Number(tag?.match(new RegExp(`\\b${name}="([0-9.]+)"`))?.[1]);
const percent = (step, length) => Number((step / length * 100).toFixed(6));

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
  // Scan each row, then return along interior cells. The last-to-first edge
  // is also in the grid, so restarting the loop never uses an outside lane.
  const route = [];
  for (let row = 0; row < ys.length; row++) {
    for (let index = 0; index < xs.length; index++) route.push([row % 2 ? xs.length-1-index : index, row]);
  }
  let [column,row] = route.at(-1);
  while (row > 1) route.push([column,--row]);
  while (column > 0) route.push([--column,row]);
  while (row > 0) route.push([column,--row]);
  route.pop(); // the duplicate starting cell is represented by the 100% frame
  const firstVisit = new Map();
  route.forEach(([column,row], index) => {
    const key = `${xs[column]},${ys[row]}`;
    if (!firstVisit.has(key)) firstVisit.set(key,index);
  });
  const rules = new Map();
  for (const cell of cells) {
    const id = cell.tag.match(/class="c (c[0-9a-z]+)"/)?.[1];
    if (!id) continue;
    const level = body.match(new RegExp(`\\.c\\.${id}\\{fill:var\\(--c([0-4])\\)`))?.[1];
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
    // Keep corners and endpoints; linear interpolation follows each grid row.
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
  return body;
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
  const body = containCalendarAnimation(source.slice(opening[0].length, source.lastIndexOf("</svg>")));
  const head = [...body.matchAll(/<rect\b[^>]*>/g)].map(match=>match[0]).find(tag=>tag.match(/\bclass="([^"]+)"/)?.[1].split(/\s+/).includes("s0"));
  const geometry = ["x", "y", "width", "height"].map(name=>Number(head?.match(new RegExp(`\\b${name}="([0-9.]+)"`))?.[1]));
  if (geometry.some(value=>!Number.isFinite(value)) || geometry[2] <= 0 || geometry[3] <= 0) {
    throw new Error("Expected the original animated snake head geometry.");
  }
  const [hx, hy, hw, hh] = geometry;
  // Eyes share the bounded head animation, including the loop seam.
  const eyes = [0.34, 0.68].map(offset=>`<circle class="s s0 profile-eye" cx="${(hx+hw*offset).toFixed(3)}" cy="${(hy+hh*0.39).toFixed(3)}" r="0.85"/>`).join("");
  const css = `:root{--cb:${palette.cellBorder};--cs:${palette.snake};--ce:${palette.dots[0]};${palette.dots.map((color,index)=>`--c${index}:${color}`).join(";")}}`;
  const finish = `.c{width:10px;height:10px;stroke:none;transform:translate(1px,1px)}.u{display:none}.s{filter:none}.s.s0{fill:url(#profile-head-gradient)}${palette.body.map((color,index)=>`.s.s${index+1}{fill:${color}}`).join("")}.s.profile-eye{fill:${palette.eye};filter:none}`;
  const still = ".c{animation:none!important}.s,.u{display:none}";
  const accessibility = staticMode ? still : `@media(prefers-reduced-motion:reduce){${still}}`;
  const mode = staticMode ? "Static contribution calendar" : "Animated contribution calendar";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.join(" ")}" width="${frame[2]}" height="${frame[3]}" role="img" aria-labelledby="profile-snake-title profile-snake-desc" data-profile-snake="mint-v3">
<title id="profile-snake-title">${mode} for Nguyen Son</title>
<desc id="profile-snake-desc">Actual GitHub contribution history with a mint palette. The snake scans and returns entirely inside the calendar matrix.</desc>
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
