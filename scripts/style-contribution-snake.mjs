import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THEMES = {
  light: { background: "#f8faf9", border: "#ccd9d2", cellBorder: "#dce7e1", snake: "#0f766e", dots: ["#e9efec", "#cce7dd", "#95cfbe", "#50ab94", "#247863"] },
  dark: { background: "#0d151c", border: "#2b3a45", cellBorder: "#20302b", snake: "#b3f4e5", dots: ["#15211e", "#193d34", "#245f50", "#398e74", "#67c3a0"] },
};

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
  const frame = [x - 12, y, width + 24, height + 12];
  const body = source.slice(opening[0].length, source.lastIndexOf("</svg>"));
  // Preserve the real calendar, movement paths and keyframe timings. Only the
  // accumulated-cell indicator's thickness changes, from 12 to 4 SVG units.
  const thinProgress = body.replace(/<rect\b[^>]*>/g, tag => {
    const classes = tag.match(/\bclass="([^"]+)"/)?.[1].split(/\s+/) ?? [];
    return classes.includes("u") ? tag.replace(/\bheight="[^"]+"/, 'height="4"') : tag;
  });
  const css = `:root{--cb:${palette.cellBorder};--cs:${palette.snake};--ce:${palette.dots[0]};${palette.dots.map((color,index)=>`--c${index}:${color}`).join(";")}}`;
  const still = ".c{animation:none!important}.s,.u{display:none}";
  const accessibility = staticMode ? still : `@media(prefers-reduced-motion:reduce){${still}}`;
  const mode = staticMode ? "Static contribution calendar" : "Animated contribution calendar";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.join(" ")}" width="${frame[2]}" height="${frame[3]}" role="img" aria-labelledby="profile-snake-title profile-snake-desc" data-profile-snake="mint-v1">
<title id="profile-snake-title">${mode} for Nguyen Son</title>
<desc id="profile-snake-desc">GitHub contribution history with a mint palette. The calendar and snake path come from actual GitHub contributions.</desc>
<rect x="${frame[0]+0.5}" y="${frame[1]+0.5}" width="${frame[2]-1}" height="${frame[3]-1}" rx="16" fill="${palette.background}" stroke="${palette.border}"/>
${thinProgress}
<style>${css}${accessibility}</style>
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
