import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRepositorySnapshot,
  fetchPublicRepositories,
  normalizeRepositories,
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
  assert.match(projects[0].description, /public learning project/i);
});

test("repository descriptions stay concise and student focused", () => {
  const [project] = normalizeRepositories([
    repository({
      description: `Professionally built production-grade real-world ${"learning system ".repeat(20)}`,
    }),
  ]);

  assert.doesNotMatch(project.description, /professional|production-grade|real-world/i);
  assert.match(project.description, /^Learning system/);
  assert.ok(Array.from(project.description).length <= 180);
  assert.match(project.description, /…$/);
});

test("snapshot adds a new repository, updates counts, and is idempotent", () => {
  const projects = normalizeRepositories([
    repository(),
    repository({ name: "Horror_Game_Funny", language: "GDScript", pushed_at: "2026-07-15T10:00:00Z" }),
  ]);
  const updated = applyRepositorySnapshot(TEMPLATE, projects);

  assert.match(updated, /2%20Public%20Projects/);
  assert.match(updated, /<strong>2<\/strong><br \/><sub>public learning projects/);
  assert.match(updated, /Horror Game Funny/);
  assert.doesNotMatch(updated, /old badges|old stats|old archive/);
  assert.equal(applyRepositorySnapshot(updated, projects), updated);
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
