// The profile's curated selection is GitHub's pinnedItems, in its returned order.
export const PROFILE_OWNER = "JasonTM17";
export const PIN_LIMIT = 6;
export const PINNED_QUERY = `query ProfilePins($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: [REPOSITORY]) {
      nodes {
        ... on Repository {
          name nameWithOwner url description isPrivate
          primaryLanguage { name }
        }
      }
    }
  }
}`;

const THEMES = {
  dark: { bg: "#0d151c", line: "#2b3a45", ink: "#ecf2f5", muted: "#a5b5c1", accent: "#80decb" },
  light: { bg: "#f8faf9", line: "#ccd9d2", ink: "#18302d", muted: "#506963", accent: "#146e60" },
};

function xml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function compact(value, limit) {
  const chars = Array.from(value);
  return chars.length <= limit ? value : chars.slice(0, limit-1).join("").trimEnd() + "…";
}

function lines(value, limit, count = 2) {
  const words = value.split(/\s+/);
  const result = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (Array.from(next).length > limit && line) {
      result.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) result.push(line);
  const visible = result.slice(0, count).map(value => compact(value, limit));
  if (result.length > count) visible[count-1] = compact(visible[count-1] + " …", limit);
  return visible;
}

export function normalizePinnedRepositories(nodes) {
  if (!Array.isArray(nodes) || nodes.length > PIN_LIMIT) {
    throw new Error("GitHub returned an invalid pinned repository list.");
  }
  const seen = new Set();
  return nodes.flatMap(repository => {
    if (!repository || typeof repository.isPrivate !== "boolean") {
      throw new Error("GitHub returned an incomplete pinned repository.");
    }
    // A privileged token must never disclose private pins through a public README.
    if (repository.isPrivate) return [];
    const { name, nameWithOwner, url, description, primaryLanguage } = repository;
    if (typeof name !== "string" || typeof nameWithOwner !== "string"
      || !/^[a-z\d-]+\/[a-z\d_.-]+$/i.test(nameWithOwner)
      || nameWithOwner.split("/")[1] !== name
      || url !== `https://github.com/${nameWithOwner}`
      || (description !== null && typeof description !== "string")
      || (primaryLanguage !== null && typeof primaryLanguage?.name !== "string")) {
      throw new Error("GitHub returned invalid public pin metadata.");
    }
    const identity = nameWithOwner.toLowerCase();
    if (seen.has(identity)) throw new Error("GitHub returned a duplicate pinned repository.");
    seen.add(identity);
    return [{
      name, fullName: nameWithOwner, href: url,
      title: name.replace(/[-_]+/g, " ").trim(),
      description: description?.replace(/\s+/g, " ").trim() || "Explore the source code and project notes.",
      language: primaryLanguage?.name.trim() || "In progress",
    }];
  });
}

export async function fetchPinnedRepositories({ fetchImpl = fetch, token = process.env.GH_TOKEN } = {}) {
  if (!token) throw new Error("GH_TOKEN is required to read GitHub profile pins.");
  let response;
  try {
    response = await fetchImpl("https://api.github.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "User-Agent": "JasonTM17-profile-project-sync" },
      body: JSON.stringify({ query: PINNED_QUERY, variables: { login: PROFILE_OWNER } }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("GitHub profile pin request could not complete.");
  }
  if (!response.ok) throw new Error(`GitHub profile pin request failed with status ${response.status}.`);
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error("GitHub returned an unreadable profile pin response."); }
  if (payload.errors || !payload.data?.user?.pinnedItems) {
    throw new Error("GitHub profile pins were unavailable; the previous showcase is preserved.");
  }
  return normalizePinnedRepositories(payload.data.user.pinnedItems.nodes);
}

export function pinAssetName(slot, theme, mobile = false) {
  return `project-${String(slot).padStart(2, "0")}-${theme}${mobile ? "-mobile" : ""}.svg`;
}

export function renderPinnedProjects(pins) {
  if (!pins.length) return "My project selection is taking shape. [Explore all repositories](https://github.com/JasonTM17?tab=repositories).";
  return pins.map((pin, index) => {
    const slot = index + 1;
    const src = (theme, mobile) => `./assets/pinned/${pinAssetName(slot, theme, mobile)}`;
    return `<p>
  <a href="${pin.href}">
    <picture>
      <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="${src("dark", true)}" />
      <source media="(max-width: 600px)" srcset="${src("light", true)}" />
      <source media="(prefers-color-scheme: dark)" srcset="${src("dark", false)}" />
      <img src="${src("light", false)}" width="100%" alt="${xml(`${pin.fullName}. ${pin.description} Main language: ${pin.language}.`)}" />
    </picture>
  </a>
</p>`;
  }).join("\n\n");
}

export function renderPinCard(pin, slot, theme, mobile) {
  const c = THEMES[theme];
  const width = mobile ? 640 : 1200;
  const height = mobile ? 262 : 180;
  const titleLines = lines(pin.title, mobile ? 29 : 62, mobile ? 2 : 1);
  const descriptionLines = lines(pin.description, mobile ? 39 : 90);
  const descY = mobile ? 123 : 94;
  const text = (x, y, value, size, color, weight = 400) => `<text x="${x}" y="${y}" fill="${c[color]}" font-size="${size}" font-weight="${weight}">${xml(value)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${xml(pin.fullName)}</title>
<desc id="desc">${xml(`${pin.description} Main language: ${pin.language}.`)}</desc>
<rect x="1" y="1" width="${width-2}" height="${height-2}" rx="16" fill="${c.bg}" stroke="${c.line}"/>
<g font-family="Segoe UI, DejaVu Sans, sans-serif">
${text(26, mobile ? 49 : 48, String(slot).padStart(2, "0"), mobile ? 22 : 20, "accent")}
${titleLines.map((line, index) => text(mobile ? 72 : 80, (mobile ? 50 : 50) + index*36, line, mobile ? 30 : 31, "ink", 600)).join("\n")}
${descriptionLines.map((line, index) => text(mobile ? 26 : 80, descY + index*(mobile ? 32 : 29), line, mobile ? 26 : 22, "muted")).join("\n")}
${text(mobile ? 26 : 80, mobile ? 227 : 158, compact(pin.language, 28), mobile ? 26 : 20, "accent")}
${mobile ? "" : text(860, 158, compact(pin.fullName, 28), 17, "muted")}
</g>
</svg>\n`;
}

export function renderPinnedAssets(pins) {
  return new Map(pins.flatMap((pin, index) => Object.keys(THEMES).flatMap(theme => [false, true].map(mobile => [
    pinAssetName(index+1, theme, mobile), renderPinCard(pin, index+1, theme, mobile),
  ]))));
}
