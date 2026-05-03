(function exposeSubredditSlugTools(globalScope) {
  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function extractSubredditSlug(input) {
    const value = String(input || "").trim();

    if (!value) {
      return "";
    }

    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      const parts = url.pathname.split("/").filter(Boolean);
      const subredditIndex = parts.findIndex((part) => part.toLowerCase() === "r");

      if (subredditIndex >= 0 && parts[subredditIndex + 1]) {
        return decodeURIComponent(parts[subredditIndex + 1]);
      }
    } catch {
      // Fall through and treat the input as a bare slug.
    }

    return value
      .replace(/^\/?r\//i, "")
      .split(/[/?#]/)[0]
      .trim();
  }

  function splitSubredditSlug(input) {
    const slug = extractSubredditSlug(input);
    const normalizedName = normalizeText(slug);

    if (!slug) {
      return {
        rawInput: String(input || ""),
        slug: "",
        normalizedName: "",
        splitMode: "empty",
        terms: []
      };
    }

    const shouldSplit = /[A-Z0-9_]/.test(slug);
    const source = shouldSplit
      ? slug
        .replace(/_/g, " ")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Za-z])([0-9])/g, "$1 $2")
        .replace(/([0-9])([A-Za-z])/g, "$1 $2")
      : slug;
    const terms = source
      .split(/\s+/)
      .map(normalizeText)
      .filter(Boolean);

    return {
      rawInput: String(input || ""),
      slug,
      normalizedName,
      splitMode: shouldSplit ? "split" : "single-lowercase-term",
      terms
    };
  }

  globalScope.redditContentFilterSlugTools = {
    extractSubredditSlug,
    normalizeText,
    splitSubredditSlug
  };
})(globalThis);
