import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const section = readme.match(/## Tech Stack([\s\S]*?)\n## /)?.[1] ?? "";

test("every tech stack badge links to a public-repository search for this owner", () => {
  const badges = [...section.matchAll(/<img src="https:\/\/img\.shields\.io\/badge\/[^"]+" alt="([^"]+)" \/>/g)];
  assert.ok(badges.length >= 10, "Expected the tech stack badges.");
  const links = [...section.matchAll(/<a href="([^"]+)"><img [^>]*alt="([^"]+)"/g)];
  assert.equal(links.length, badges.length, "Every badge must be wrapped in a link.");
  for (const [, href, alt] of links) {
    const url = new URL(href.replaceAll("&amp;", "&"));
    assert.equal(url.origin + url.pathname, "https://github.com/search", alt);
    assert.equal(url.searchParams.get("type"), "repositories", alt);
    const query = url.searchParams.get("q") ?? "";
    assert.match(query, /^user:JasonTM17 is:public /, alt);
  }
});
