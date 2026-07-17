import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyRepositorySnapshot,
  fetchPublicRepositories,
  normalizeRepositories,
  renderProjectBadges,
  replaceManagedSection,
} from "./sync-public-projects.mjs";

const TEMPLATE = `before
<!-- AUTO:PROJECT_BADGES:START -->
old badges
<!-- AUTO:PROJECT_BADGES:END -->
middle
<!-- AUTO:PROJECT_STATS:START -->
old stats
<!-- AUTO:PROJECT_STATS:END -->
archive
<!-- AUTO:PROJECT_ARCHIVE:START -->
old archive
<!-- AUTO:PROJECT_ARCHIVE:END -->
after`;

function repository(overrides = {}) {
  const name = overrides.name ?? "FoodDelivery_App";
  return {
    description: "A learning project",
    disabled: false,
    fork: false,
    html_url: `https://github.com/JasonTM17/${name}`,
    language: "TypeScript",
    name,
    private: false,
    pushed_at: "2026-07-14T10:00:00Z",
    updated_at: "2026-07-14T10:00:00Z",
    visibility: "public",
    ...overrides,
  };
}

test("normalization keeps only owned public learning projects", () => {
  const projects = normalizeRepositories([
    repository(),
    repository({ name: "Horror_Game_Funny", description: null, language: "GDScript", pushed_at: "2026-07-15T10:00:00Z" }),
    repository({ name: "JasonTM17" }),
    repository({ name: "nguyen_son" }),
    repository({ name: "private-project", private: true, visibility: "private" }),
    repository({ name: "forked-project", fork: true }),
    repository({ name: "disabled-project", disabled: true }),
    repository({ name: "wrong-owner", html_url: "https://github.com/example/wrong-owner" }),
  ]);

  assert.deepEqual(projects.map((project) => project.name), ["Horror_Game_Funny", "FoodDelivery_App"]);
  assert.match(projects[0].description, /early-stage learning project/i);
});

test("repositories without detected technology use a polished in-progress state", () => {
  const [project] = normalizeRepositories([
    repository({ description: null, language: null, name: "New_Study_Project" }),
  ]);

  assert.equal(project.language, "In progress");
  assert.equal(project.description, "An early-stage learning project currently taking shape.");
});

test("curated project copy stays concise and evidence based", () => {
  const [project] = normalizeRepositories([
    repository({
      description: "Portfolio-grade enterprise agricultural platform",
      language: "Java",
      name: "AgriCore_SpringBoot_Microservices",
    }),
  ]);

  assert.equal(project.title, "AgriCore");
  assert.equal(
    project.description,
    "Java 21 and Spring Boot microservices learning platform for farms, crop cycles, field work, inventory, IoT, sales, and QR traceability.",
  );
});

test("repository descriptions stay concise and student focused", () => {
  const [project] = normalizeRepositories([
    repository({
      description: `Professionally built portfolio-grade production-grade real-world ${"learning system ".repeat(20)}`,
    }),
  ]);

  assert.doesNotMatch(project.description, /professional|portfolio-grade|production-grade|real-world/i);
  assert.match(project.description, /^Learning system/);
  assert.ok(Array.from(project.description).length <= 180);
  assert.match(project.description, /…$/);
});

test("repositories updated on the same day keep a stable display order", () => {
  const sameDayPayload = [
    repository({ name: "FoodDelivery_App", pushed_at: "2026-07-15T01:00:00Z" }),
    repository({ name: "Horror_Game_Funny", pushed_at: "2026-07-15T23:00:00Z" }),
  ];
  const earlyFoodFlow = normalizeRepositories([
    ...sameDayPayload,
  ]);
  const lateFoodFlow = normalizeRepositories([
    repository({ name: "FoodDelivery_App", pushed_at: "2026-07-15T23:30:00Z" }),
    repository({ name: "Horror_Game_Funny", pushed_at: "2026-07-15T00:30:00Z" }),
  ]);

  assert.deepEqual(
    earlyFoodFlow.map((project) => project.name),
    ["FoodDelivery_App", "Horror_Game_Funny"],
  );
  assert.deepEqual(
    lateFoodFlow.map((project) => project.name),
    ["FoodDelivery_App", "Horror_Game_Funny"],
  );
  assert.deepEqual(
    normalizeRepositories([...sameDayPayload].reverse()).map((project) => project.name),
    ["FoodDelivery_App", "Horror_Game_Funny"],
  );
  assert.equal(
    applyRepositorySnapshot(TEMPLATE, normalizeRepositories(sameDayPayload)),
    applyRepositorySnapshot(TEMPLATE, normalizeRepositories([...sameDayPayload].reverse())),
  );
});

test("newer calendar dates rank first and invalid dates remain deterministic", () => {
  const projects = normalizeRepositories([
    repository({ name: "FoodDelivery_App", pushed_at: "not-a-date" }),
    repository({ name: "Horror_Game_Funny", pushed_at: "2026-07-15T00:00:01Z" }),
    repository({ name: "Language_App", pushed_at: "2026-07-14T23:59:59Z" }),
  ]);

  assert.deepEqual(
    projects.map((project) => project.name),
    ["Horror_Game_Funny", "Language_App", "FoodDelivery_App"],
  );
});

test("snapshot adds a new repository, updates counts, and is idempotent", () => {
  const projects = normalizeRepositories([
    repository(),
    repository({ name: "Horror_Game_Funny", language: "GDScript", pushed_at: "2026-07-15T10:00:00Z" }),
  ]);
  const updated = applyRepositorySnapshot(TEMPLATE, projects);

  assert.match(updated, /2%20Public%20Projects/);
  assert.match(updated, /<strong>2<\/strong> public projects/);
  assert.match(updated, /Horror Game Funny/);
  assert.match(updated, /Explore \*\*2 public projects\*\*/);
  assert.match(updated, /Browse All 2 Projects/);
  assert.doesNotMatch(updated, /GitHub Actions sync|Checked automatically|scheduled runs|private, forked|portfolio-metadata/i);
  assert.doesNotMatch(updated, /<td width="76%"/);
  assert.doesNotMatch(updated, /<sub>/);
  assert.doesNotMatch(updated, /old badges|old stats|old archive/);
  assert.equal(applyRepositorySnapshot(updated, projects), updated);
});

test("project badges use dynamic counts, distinct CTA colors, and inline images", () => {
  const badges = renderProjectBadges([
    repository(),
    repository({ name: "Horror_Game_Funny" }),
    repository({ name: "Language_App" }),
  ]);

  assert.match(badges, /Live%203D%20Portfolio-0F766E\?/);
  assert.match(badges, /3%20Public%20Projects-1D4ED8\?/);

  const badgeAnchors = [...badges.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(badgeAnchors.length, 2);
  for (const [, content] of badgeAnchors) {
    assert.doesNotMatch(content, /[\r\n]/);
    assert.match(content, /^<img\b[^>]* \/>$/);
  }
});

test("README project badges match the current renderer output", async () => {
  const readmeUrl = new URL("../README.md", import.meta.url);
  const readme = await readFile(readmeUrl, "utf8");
  const countMatch = readme.match(/<strong>(\d+)<\/strong> public projects/);

  assert.ok(countMatch, "README project count should remain inside the managed stats section");
  const expectedBadges = renderProjectBadges(Array.from({ length: Number(countMatch[1]) }));
  const renderedBadges = readme.match(
    /<!-- AUTO:PROJECT_BADGES:START -->\r?\n([\s\S]*?)\r?\n<!-- AUTO:PROJECT_BADGES:END -->/,
  );

  assert.ok(renderedBadges, "README should retain the managed project badge markers");
  assert.equal(
    renderedBadges[1].replace(/\r\n?/g, "\n"),
    expectedBadges.replace(/\r\n?/g, "\n"),
  );
});

test("rendered Overview hides synchronization and filtering implementation details", async () => {
  const readmeUrl = new URL("../README.md", import.meta.url);
  const readme = await readFile(readmeUrl, "utf8");
  const renderedCopy = readme.replace(/<!--[\s\S]*?-->/g, "");

  assert.doesNotMatch(
    renderedCopy,
    /GitHub Actions sync|Checked automatically|scheduled runs|private, forked|portfolio-metadata|appear automatically/i,
  );
});

test("snapshot removes repositories absent from the next public response", () => {
  const withTwo = applyRepositorySnapshot(TEMPLATE, normalizeRepositories([
    repository(),
    repository({ name: "Horror_Game_Funny", pushed_at: "2026-07-15T10:00:00Z" }),
  ]));
  const withOne = applyRepositorySnapshot(withTwo, normalizeRepositories([repository()]));

  assert.doesNotMatch(withOne, /Horror Game Funny/);
  assert.match(withOne, /1%20Public%20Projects/);
});

test("managed sections and empty snapshots fail closed", () => {
  assert.throws(() => replaceManagedSection("README", "PROJECT_BADGES", "body"), /missing a valid/i);
  assert.throws(
    () => replaceManagedSection(`${TEMPLATE}\n<!-- AUTO:PROJECT_BADGES:START -->`, "PROJECT_BADGES", "body"),
    /missing a valid/i,
  );
  assert.throws(() => applyRepositorySnapshot(TEMPLATE, []), /empty snapshot/i);
});

test("GitHub API failures reject before a snapshot can be rendered", async () => {
  await assert.rejects(
    () => fetchPublicRepositories({
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
    /status 503/i,
  );
});

test("GitHub pagination combines every page", async () => {
  const responses = [
    {
      headers: new Headers({ link: '<https://api.github.com/page=2>; rel="next"' }),
      json: async () => [repository()],
      ok: true,
      status: 200,
    },
    {
      headers: new Headers(),
      json: async () => [repository({ name: "Horror_Game_Funny", pushed_at: "2026-07-15T10:00:00Z" })],
      ok: true,
      status: 200,
    },
  ];
  const requestedPages = [];
  const projects = await fetchPublicRepositories({
    fetchImpl: async (url) => {
      requestedPages.push(url.searchParams.get("page"));
      return responses.shift();
    },
  });

  assert.deepEqual(requestedPages, ["1", "2"]);
  assert.deepEqual(projects.map((project) => project.name), ["Horror_Game_Funny", "FoodDelivery_App"]);
});

test("GitHub requests use the versioned API contract and authenticated owner query", async () => {
  let request;
  await fetchPublicRepositories({
    token: "test-token",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        headers: new Headers(),
        json: async () => [repository()],
        ok: true,
        status: 200,
      };
    },
  });

  assert.equal(request.url.pathname, "/users/JasonTM17/repos");
  assert.equal(request.url.searchParams.get("type"), "owner");
  assert.equal(request.url.searchParams.get("sort"), "pushed");
  assert.equal(request.url.searchParams.get("per_page"), "100");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.equal(request.options.headers["X-GitHub-Api-Version"], "2026-03-10");
});

test("the profile workflow polls twice hourly, stays active, and keeps manual dispatch available", async () => {
  const workflowUrl = new URL("../.github/workflows/sync-public-projects.yml", import.meta.url);
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /cron: "23,53 \* \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40} # v6\.0\.3/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40} # v6\.5\.0/);
  assert.match(workflow, /age_days >= 45/);
  assert.match(workflow, /git commit --allow-empty -m "ci\(profile\): keep scheduled sync active"/);
});
