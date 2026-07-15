import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OWNER = "JasonTM17";
const API_VERSION = "2026-03-10";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const MAX_DESCRIPTION_LENGTH = 180;
const EXCLUDED_REPOSITORIES = new Set(["jasontm17", "nguyen_son"]);
const ROOT_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const README_PATH = path.join(ROOT_DIRECTORY, "README.md");

const CURATED_TITLES = new Map([
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

function normalizedDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString().slice(0, 10);
}

function normalizedDescription(repository) {
  const description = repository.description
    ?.replace(/\b(?:professional(?:ly)?(?:\s+built)?|production[- ](?:grade|ready|like)|enterprise[- ]grade|real[- ]world)\b\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!description) {
    return "A public learning project; open the repository for source code and progress notes.";
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
      language: repository.language?.trim() || "—",
      name: repository.name,
      pushedAt: repositoryTimestamp(repository),
      title: friendlyRepositoryName(repository.name),
    }))
    .sort((left, right) => right.pushedAt.localeCompare(left.pushedAt) || left.name.localeCompare(right.name));

  return [...new Map(repositories.map((repository) => [repository.name.toLowerCase(), repository])).values()];
}

function recentProjectTable(repositories) {
  const rows = repositories.map((repository) => `  <tr>
    <td width="76%" valign="top">
      <strong><a href="${repository.href}">${escapeHtml(repository.title)}</a></strong><br />
      <sub>${escapeHtml(repository.description)}</sub>
    </td>
    <td width="24%" valign="top" align="right">
      <code>${escapeHtml(repository.language)}</code><br />
      <sub>${normalizedDate(repository.pushedAt)}</sub>
    </td>
  </tr>`);

  return `<table>
${rows.join("\n")}
</table>`;
}

function projectIndexTable(repositories) {
  const rows = repositories.map((repository) => (
    `| [${escapeMarkdownCell(repository.title)}](${repository.href}) | ${escapeMarkdownCell(repository.language)} | ${normalizedDate(repository.pushedAt)} |`
  ));

  return [
    "| Project | Main language | Updated |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

export function renderProjectBadges(repositories) {
  const count = repositories.length;
  return `<p align="center">
  <a href="https://nguyen-son-portfolio.vercel.app">
    <img src="https://img.shields.io/badge/Live%203D%20Portfolio-0F172A?style=for-the-badge&amp;logo=vercel&amp;logoColor=white" alt="Open Nguyen Son's live 3D portfolio" />
  </a>
  <a href="https://github.com/${OWNER}?tab=repositories">
    <img src="https://img.shields.io/badge/${count}%20Public%20Projects-0F172A?style=for-the-badge&amp;logo=github&amp;logoColor=white" alt="Explore Nguyen Son's ${count} public learning-project repositories" />
  </a>
</p>`;
}

export function renderProjectStats(repositories) {
  return `<table>
  <tr>
    <td width="33%" align="center"><strong>${repositories.length}</strong><br /><sub>public learning projects</sub></td>
    <td width="33%" align="center"><strong>4</strong><br /><sub>connected learning tracks</sub></td>
    <td width="33%" align="center"><strong>1</strong><br /><sub>interactive 3D portfolio</sub></td>
  </tr>
</table>`;
}

export function renderProjectArchive(repositories) {
  const count = repositories.length;
  const recentRepositories = repositories.slice(0, 5);

  return `The archive currently follows **${count} public learning projects** from GitHub. New public repositories appear automatically; private, forked, disabled, profile, and portfolio-metadata repositories stay out of this list.

### Recently updated

${recentProjectTable(recentRepositories)}

<details>
  <summary><strong>Browse all ${count} public learning projects</strong></summary>

${projectIndexTable(repositories)}

</details>

<sub>Automatically refreshed from GitHub every six hours. The four learning tracks above remain curated so the profile keeps a clear story.</sub>`;
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

export function applyRepositorySnapshot(readme, repositories) {
  if (!repositories.length) throw new Error("Refusing to replace the profile archive with an empty snapshot.");

  const withBadges = replaceManagedSection(readme, "PROJECT_BADGES", renderProjectBadges(repositories));
  const withStats = replaceManagedSection(withBadges, "PROJECT_STATS", renderProjectStats(repositories));
  return replaceManagedSection(withStats, "PROJECT_ARCHIVE", renderProjectArchive(repositories));
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

export async function synchronizeReadme() {
  const repositories = await fetchPublicRepositories();
  const currentReadme = await readFile(README_PATH, "utf8");
  const nextReadme = applyRepositorySnapshot(currentReadme, repositories);

  if (nextReadme === currentReadme) {
    console.log(`Profile archive already matches ${repositories.length} public learning projects.`);
    return false;
  }

  await writeFile(README_PATH, nextReadme, "utf8");
  console.log(`Updated profile archive with ${repositories.length} public learning projects.`);
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
