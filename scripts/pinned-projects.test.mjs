import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fetchPinnedRepositories, normalizePinnedRepositories, renderPinnedAssets, renderPinnedProjects } from "./pinned-projects.mjs";
import { applyRepositorySnapshot, normalizeRepositories, synchronizeReadme } from "./sync-public-projects.mjs";

const TEMPLATE = ["PROJECT_BADGES", "PROJECT_STATS", "PINNED_PROJECTS", "PROJECT_ARCHIVE"]
  .map(name => `<!-- AUTO:${name}:START -->\nold ${name}\n<!-- AUTO:${name}:END -->`).join("\n");

function pin(name = "HealthCare_Project", overrides = {}) {
  return { name, nameWithOwner: `JasonTM17/${name}`, url: `https://github.com/JasonTM17/${name}`,
    isPrivate: false, description: "A current project description.", primaryLanguage: { name: "JavaScript" }, ...overrides };
}

function publicRepo() {
  return { name: "HealthCare_Project", html_url: "https://github.com/JasonTM17/HealthCare_Project", private: false,
    visibility: "public", description: "A learning project", language: "JavaScript", pushed_at: "2026-10-28" };
}

function mockFetch(nodes, errors) {
  return async url => ({ ok: true, status: 200, headers: new Headers(),
    json: async () => String(url).endsWith("/graphql") ? { data: { user: { pinnedItems: { nodes } } }, ...(errors ? { errors } : {}) } : [publicRepo()] });
}

async function workspace(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "profile-pins-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("profile-pins-"));
    await rm(directory, { recursive: true, force: true });
  });
  const readmePath = path.join(directory, "README.md");
  const assetsDirectory = path.join(directory, "pinned");
  await writeFile(readmePath, TEMPLATE);
  return { directory, readmePath, assetsDirectory };
}

test("pins preserve profile order, including contributed public repositories", () => {
  const nodes = [pin("z-last"), pin("a-first", { nameWithOwner: "another-owner/a-first", url: "https://github.com/another-owner/a-first" })];
  assert.deepEqual(normalizePinnedRepositories(nodes).map(p => p.fullName), ["JasonTM17/z-last", "another-owner/a-first"]);
});

test("public showcase cannot disclose private pins or accept unsafe/incomplete metadata", () => {
  assert.deepEqual(normalizePinnedRepositories([pin("private", { isPrivate: true })]), []);
  for (const nodes of [null, [null], [pin("bad", { url: "javascript:alert(1)" })], [pin("bad", { nameWithOwner: "wrong/repo" })], [pin(), pin()], Array(7).fill(pin())]) {
    assert.throws(() => normalizePinnedRepositories(nodes), /invalid|incomplete|duplicate/i);
  }
});

test("GraphQL uses actual pinnedItems with authenticated variables and rejects partial errors", async () => {
  let request;
  const pins = await fetchPinnedRepositories({ token: "test-token", fetchImpl: async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ data: { user: { pinnedItems: { nodes: [pin()] } } } }) };
  } });
  assert.equal(pins[0].name, "HealthCare_Project");
  assert.equal(request.url, "https://api.github.com/graphql");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  const body = JSON.parse(request.options.body);
  assert.match(body.query, /pinnedItems\(first: 6, types: \[REPOSITORY\]\)/);
  assert.deepEqual(body.variables, { login: "JasonTM17" });
  await assert.rejects(() => fetchPinnedRepositories({ token: "test-token", fetchImpl: mockFetch([pin()], [{ message: "private provider details" }]) }), /previous showcase is preserved/);
  await assert.rejects(() => fetchPinnedRepositories({ token: "" }), /GH_TOKEN/);
});

test("empty pins are a valid user choice, malformed HTTP/GraphQL responses are not", async () => {
  assert.deepEqual(await fetchPinnedRepositories({ token: "test-token", fetchImpl: mockFetch([]) }), []);
  for (const response of [{ ok: false, status: 403 }, { ok: true, json: async () => ({ data: { user: null } }) }, { ok: true, json: async () => { throw new Error("secret provider error"); } }]) {
    await assert.rejects(() => fetchPinnedRepositories({ token: "test-token", fetchImpl: async () => response }), error => !error.message.includes("secret"));
  }
});

test("add/remove/reorder/description changes update cards and statistics deterministically", () => {
  const repositories = normalizeRepositories([publicRepo()]);
  const oldPins = normalizePinnedRepositories([pin("old"), pin("kept")]);
  const nextPins = normalizePinnedRepositories([pin("new"), pin("kept", { description: "Current metadata" })]);
  const old = applyRepositorySnapshot(TEMPLATE, repositories, oldPins);
  const next = applyRepositorySnapshot(old, repositories, nextPins);
  assert.match(next, /\[HealthCare Project\]\(https:\/\/github.com\/JasonTM17\/HealthCare_Project\)/);
  assert.ok(next.indexOf('href="https://github.com/JasonTM17/new"') < next.indexOf('href="https://github.com/JasonTM17/kept"'));
  assert.doesNotMatch(next, /JasonTM17\/old/);
  assert.match(next, /Current metadata/);
  assert.match(next, /<strong>2<\/strong> pinned projects/);
  assert.equal(applyRepositorySnapshot(next, repositories, nextPins), next);
  const reordered = applyRepositorySnapshot(next, repositories, [...nextPins].reverse());
  assert.ok(reordered.indexOf('href="https://github.com/JasonTM17/kept"') < reordered.indexOf('href="https://github.com/JasonTM17/new"'));
  const cleared = applyRepositorySnapshot(next, repositories, []);
  assert.doesNotMatch(cleared, /assets\/pinned|href="https:\/\/github.com\/JasonTM17\/kept"/);
  assert.match(cleared, /<strong>0<\/strong> pinned projects/);
});

test("untrusted descriptions and language names remain text in SVG and README attributes", () => {
  const pins = normalizePinnedRepositories([pin("safe", { description: '\"/><script>alert(1)</script>&', primaryLanguage: { name: '<img src=x onerror="x">' } })]);
  const markup = renderPinnedProjects(pins);
  assert.doesNotMatch(markup, /<script|<img src=x|alt="[^\n]*"\/>/);
  assert.match(markup, /&lt;script&gt;/);
  for (const svg of renderPinnedAssets(pins).values()) {
    assert.doesNotMatch(svg, /<script|<foreignObject|<image\b/);
    assert.match(svg, /&lt;script&gt;/);
  }
});

test("cards provide both themes and mobile sources for every pin", () => {
  const pins = normalizePinnedRepositories([pin()]);
  const assets = renderPinnedAssets(pins);
  assert.equal(assets.size, 4);
  assert.ok(assets.get("project-01-dark-mobile.svg").includes('viewBox="0 0 640 262"'));
  assert.ok(assets.get("project-01-light.svg").includes('viewBox="0 0 1200 180"'));
  for (const name of assets.keys()) assert.ok(renderPinnedProjects(pins).includes(name));
});

test("HTTP 200 with GraphQL errors leaves README and generated files untouched", async t => {
  const local = await workspace(t);
  await assert.rejects(() => synchronizeReadme({ ...local, token: "test-token", fetchImpl: mockFetch([pin()], [{ message: "internal message" }]) }), /previous showcase/);
  assert.equal(await readFile(local.readmePath, "utf8"), TEMPLATE);
  assert.deepEqual(await readdir(local.directory), ["README.md"]);
});

test("sync is idempotent and removes stale generated card slots after unpinning", async t => {
  const local = await workspace(t);
  const options = { ...local, token: "test-token" };
  assert.equal(await synchronizeReadme({ ...options, fetchImpl: mockFetch([pin("one"), pin("two")]) }), true);
  assert.equal((await readdir(local.assetsDirectory)).length, 8);
  assert.equal(await synchronizeReadme({ ...options, fetchImpl: mockFetch([pin("one"), pin("two")]) }), false);
  assert.equal(await synchronizeReadme({ ...options, fetchImpl: mockFetch([pin("two")]) }), true);
  assert.equal((await readdir(local.assetsDirectory)).length, 4);
  assert.equal(await synchronizeReadme({ ...options, fetchImpl: mockFetch([]) }), true);
  assert.deepEqual(await readdir(local.assetsDirectory), []);
  assert.match(await readFile(local.readmePath, "utf8"), /<strong>0<\/strong> pinned projects/);
});
