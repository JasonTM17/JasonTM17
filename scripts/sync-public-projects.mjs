import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchPinnedRepositories, PIN_LIMIT, pinAssetName, renderPinnedAssets, renderPinnedProjects } from "./pinned-projects.mjs";

const OWNER = "JasonTM17";
const API_VERSION = "2026-03-10";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const MAX_DESCRIPTION_LENGTH = 180;
const EXCLUDED_REPOSITORIES = new Set(["jasontm17", "nguyen_son"]);
const ROOT_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const README_PATH = path.join(ROOT_DIRECTORY, "README.md");

const CURATED_TITLES = new Map([
  ["AgriCore_SpringBoot_Microservices", "AgriCore"],
  ["AI_Algothrithm_Invidual_Study_University", "8-puzzle AI Lab"],
  ["AI_Algothrithm_Study_University", "15-puzzle AI Lab"],
  ["App_AI_powered_waste_sorting", "AI-powered waste sorting"],
  ["CampusCore_FullStack_Individual", "CampusCore"],
  ["ChillTravel_NextJS", "WanderViet"],
  ["Crab_Mobile_Flutter", "Crab"],
  ["DevHire_Cloud_Spring_Microservices", "DevHire Cloud"],
  ["Ecommerce_BookStore", "BookStore"],
  ["FoodDelivery_App", "FoodFlow"],
  ["Internal_Developer_Platform_DevOps", "Internal Developer Platform"],
  ["JobHunter_SpringBoot_RestfulAPI_React", "JobHunter"],
  ["Language_App", "LinguaFlow"],
  ["Laptopshop_Spring_Boot_MVC", "Laptop Shop"],
  ["Leetrank_Project", "LeetRank"],
  ["MilkTea_Iku", "MilkTea Iku"],
  ["Money_Management_App", "Money Management"],
  ["ON-OFF_JS", "ON/OFF"],
  ["VN_TravelAI", "VN TravelAI"],
  ["Wavestream_Soundcloud", "Wavestream"],
]);

const CURATED_DESCRIPTIONS = new Map([
  [
    "AgriCore_SpringBoot_Microservices",
    "Java 21 and Spring Boot microservices learning platform for farms, crop cycles, field work, inventory, IoT, sales, and QR traceability.",
  ],
]);

function managedMarker(name, boundary) {
  return `<!-- AUTO:${name}:${boundary} -->`;
}

function escapeMarkdownCell(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .trim();
}

function friendlyRepositoryName(name) {
  return CURATED_TITLES.get(name) ?? name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function repositoryTimestamp(repository) {
  return repository.pushed_at ?? repository.updated_at ?? "";
}

function truncateDescription(description) {
  const characters = Array.from(description);
  if (characters.length <= MAX_DESCRIPTION_LENGTH) return description;

  const clipped = characters.slice(0, MAX_DESCRIPTION_LENGTH - 1).join("");
  const lastWordBoundary = clipped.lastIndexOf(" ");
  const end = lastWordBoundary >= MAX_DESCRIPTION_LENGTH * 0.7
    ? clipped.slice(0, lastWordBoundary)
    : clipped;
  return `${end.trimEnd()}…`;
}

function sortableDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function normalizedDate(value) {
  return sortableDate(value) || "—";
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizedDescription(repository) {
  const sourceDescription = CURATED_DESCRIPTIONS.get(repository.name) ?? repository.description;
  const description = sourceDescription
    ?.replace(/\b(?:professional(?:ly)?(?:\s+built)?|portfolio[- ]grade|production[- ](?:grade|ready|like)|enterprise[- ]grade|real[- ]world)\b\s*/gi, "")
    .replace(/\brealtime\b/g, "real-time")
    .replace(/\s+/g, " ")
    .trim();

  if (!description) {
    return "An early-stage learning project currently taking shape.";
  }

  const studentFocusedDescription = description[0].toUpperCase() + description.slice(1);
  return truncateDescription(studentFocusedDescription);
}

export function normalizeRepositories(payload) {
  if (!Array.isArray(payload)) throw new Error("GitHub returned an invalid repository payload.");

  const repositories = payload
    .filter((repository) => {
      if (!repository || typeof repository !== "object" || typeof repository.name !== "string") return false;
      if (EXCLUDED_REPOSITORIES.has(repository.name.toLowerCase())) return false;
      if (repository.private !== false || repository.visibility !== "public") return false;
      if (repository.fork === true || repository.disabled === true) return false;
      return repository.html_url === `https://github.com/${OWNER}/${repository.name}`;
    })
    .map((repository) => ({
      description: normalizedDescription(repository),
      href: repository.html_url,
      language: repository.language?.trim() || "In progress",
      name: repository.name,
      pushedAt: repositoryTimestamp(repository),
      title: friendlyRepositoryName(repository.name),
    }))
    .sort((left, right) => (
      compareText(sortableDate(right.pushedAt), sortableDate(left.pushedAt))
      || compareText(left.title, right.title)
      || compareText(left.name, right.name)
    ));

  return [...new Map(repositories.map((repository) => [repository.name.toLowerCase(), repository])).values()];
}

function recentProjectList(repositories) {
  return repositories.map((repository) => (
    `- **[${escapeMarkdownCell(repository.title)}](${repository.href})** · ${escapeMarkdownCell(repository.language)} · ${normalizedDate(repository.pushedAt)}\n\n  ${escapeMarkdownCell(repository.description)}`
  )).join("\n\n");
}

function projectIndexTable(repositories) {
  const rows = repositories.map((repository) => (
    `| [${escapeMarkdownCell(repository.title)}](${repository.href}) | ${escapeMarkdownCell(repository.language)} | ${normalizedDate(repository.pushedAt)} |`
  ));

  return [
    "| Project | Technology / Status | Updated |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

export function renderProjectBadges(repositories) {
  const count = repositories.length;
  return `<p align="center">
  <a href="https://nguyen-son-portfolio.vercel.app"><img src="https://img.shields.io/badge/Live%203D%20Portfolio-0F766E?style=for-the-badge&amp;logo=vercel&amp;logoColor=white" alt="Open Nguyen Son's live 3D portfolio" /></a>
  <a href="https://github.com/${OWNER}?tab=repositories"><img src="https://img.shields.io/badge/${count}%20Public%20Projects-1D4ED8?style=for-the-badge&amp;logo=github&amp;logoColor=white" alt="Explore Nguyen Son's ${count} public learning-project repositories" /></a>
</p>`;
}

export function renderProjectStats(repositories, pins = []) {
  return `<p align="center">
  <strong>${repositories.length}</strong> public projects &nbsp;&middot;&nbsp;
  <strong>${pins.length}</strong> pinned projects &nbsp;&middot;&nbsp;
  <strong>1</strong> interactive 3D portfolio
</p>`;
}

export function renderProjectArchive(repositories, pins = []) {
  const count = repositories.length;
  const pinnedUrls = new Set(pins.map(pin => pin.href.toLowerCase()));
  const recentRepositories = repositories.filter(repository => !pinnedUrls.has(repository.href.toLowerCase())).slice(0, 5);
  const recentSection = recentRepositories.length
    ? `### Recently Updated\n\n${recentProjectList(recentRepositories)}\n\n`
    : "";

  return `Explore **${count} public projects** across product engineering, mobile development, applied AI, and platform delivery.

${recentSection}<details>
  <summary><strong>Browse All ${count} Projects</strong></summary>

${projectIndexTable(repositories)}

</details>`;
}

export function replaceManagedSection(source, name, body) {
  const start = managedMarker(name, "START");
  const end = managedMarker(name, "END");
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  const duplicateStartIndex = source.indexOf(start, startIndex + start.length);
  const duplicateEndIndex = source.indexOf(end, endIndex + end.length);

  if (
    startIndex < 0
    || endIndex < 0
    || endIndex <= startIndex
    || duplicateStartIndex >= 0
    || duplicateEndIndex >= 0
  ) {
    throw new Error(`README is missing a valid ${name} managed section.`);
  }

  const before = source.slice(0, startIndex + start.length);
  const after = source.slice(endIndex);
  return `${before}\n${body.trim()}\n${after}`;
}

export function applyRepositorySnapshot(readme, repositories, pins = []) {
  if (!repositories.length) throw new Error("Refusing to replace the profile archive with an empty snapshot.");

  const withBadges = replaceManagedSection(readme, "PROJECT_BADGES", renderProjectBadges(repositories));
  const withStats = replaceManagedSection(withBadges, "PROJECT_STATS", renderProjectStats(repositories, pins));
  const withPins = replaceManagedSection(withStats, "PINNED_PROJECTS", renderPinnedProjects(pins));
  return replaceManagedSection(withPins, "PROJECT_ARCHIVE", renderProjectArchive(repositories, pins));
}

export async function fetchPublicRepositories({ fetchImpl = fetch, token = process.env.GH_TOKEN } = {}) {
  const payload = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(`https://api.github.com/users/${OWNER}/repos`);
    url.search = new URLSearchParams({
      direction: "desc",
      page: String(page),
      per_page: String(PAGE_SIZE),
      sort: "pushed",
      type: "owner",
    }).toString();

    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "JasonTM17-profile-project-sync",
      "X-GitHub-Api-Version": API_VERSION,
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`GitHub repository request failed with status ${response.status}.`);

    const pagePayload = await response.json();
    if (!Array.isArray(pagePayload)) throw new Error("GitHub returned an invalid repository page.");
    payload.push(...pagePayload);

    const hasNextPage = response.headers.get("link")?.includes('rel="next"') ?? false;
    if (!hasNextPage) break;
    if (page === MAX_PAGES) throw new Error("GitHub repository pagination exceeded the safety limit.");
  }

  return normalizeRepositories(payload);
}

export async function synchronizeReadme({ fetchImpl = fetch, token = process.env.GH_TOKEN, readmePath = README_PATH, assetsDirectory = path.join(ROOT_DIRECTORY, "assets", "pinned") } = {}) {
  // Resolve and validate both snapshots before any local writes. Partial GraphQL data is never published.
  const [repositories, pins] = await Promise.all([
    fetchPublicRepositories({ fetchImpl, token }), fetchPinnedRepositories({ fetchImpl, token }),
  ]);
  const currentReadme = await readFile(readmePath, "utf8");
  const nextReadme = applyRepositorySnapshot(currentReadme, repositories, pins);
  const assets = renderPinnedAssets(pins);
  await mkdir(assetsDirectory, { recursive: true });
  let assetsChanged = false;
  for (const [name, svg] of assets) {
    const assetPath = path.join(assetsDirectory, name);
    const existing = await readFile(assetPath, "utf8").catch(error => { if (error.code === "ENOENT") return null; throw error; });
    if (existing !== svg) {
      await writeFile(assetPath, svg, "utf8");
      assetsChanged = true;
    }
  }
  for (let slot = pins.length+1; slot <= PIN_LIMIT; slot += 1) {
    for (const theme of ["dark", "light"]) for (const mobile of [false, true]) {
      const stalePath = path.join(assetsDirectory, pinAssetName(slot, theme, mobile));
      try { await rm(stalePath); assetsChanged = true; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }

  if (nextReadme === currentReadme && !assetsChanged) {
    console.log(`Profile already matches ${repositories.length} public projects and ${pins.length} pins.`);
    return false;
  }

  if (nextReadme !== currentReadme) await writeFile(readmePath, nextReadme, "utf8");
  console.log(`Updated profile with ${repositories.length} public projects and ${pins.length} pins.`);
  return true;
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  synchronizeReadme().catch((error) => {
    console.error(error instanceof Error ? error.message : "Profile project sync failed.");
    process.exitCode = 1;
  });
}
