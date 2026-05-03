# Subreddit Gate Plan

## Summary
Add a separate Subreddit Gate for `reddit.com/r/<subreddit>/...` routes. It will be isolated from the existing custom URL blocker, show the loading overlay immediately, then allow or block through cache, manual lists, slug keyword matching, and Reddit metadata matching. The options page will include a slug splitter experiment that uses the same production helper.

## Key Changes
- Add a new Subreddit Gate tab in options with allowlist, blocklist, keyword list, safe cache controls, and a slug splitter experiment.
- Store subreddit allowlist, blocklist, and keywords in sync settings.
- Store the 20-item safe subreddit cache in local storage.
- Extend runtime logs with subreddit gate entries including route, decision, source, matched keyword, and split slug words.

## Gate Flow
1. Detect only `reddit.com/r/<subreddit>/...` and `www.reddit.com/r/<subreddit>/...`.
2. Skip existing custom URL blocking for `/r/<subreddit>` paths.
3. Show loading overlay first.
4. Check safe cache, then allowlist, then blocklist.
5. Read the subreddit slug from the URL and split it with the shared slug splitter.
6. If no slug keyword matches, read `shreddit-subreddit-header` metadata.
7. Match `display-name` directly without splitting, then match normalized `description`.
8. If nothing matches, allow and cache the normalized subreddit name as safe.

## Slug Splitter
- Accept either a bare slug or a Reddit subreddit URL.
- If the slug has uppercase boundaries, numbers, or underscores, split into normalized terms.
- If the slug is all lowercase with no numbers or underscores, treat the whole slug as one normalized term.
- Use the same helper in options and production content logic.

## Test Plan
- Run syntax checks only:
  - `node --check src/subreddit-slug.js`
  - `node --check options/options.js`
- Manual checks:
  - `BollyBlindsNGossip` splits into meaningful lowercase terms.
  - `cumswallowingmovies` remains one term.
  - `war2News` splits around the number and uppercase boundary.
  - A full Reddit URL extracts only the subreddit slug.

## Assumptions
- Subreddit list matching is case-insensitive and stores normalized lowercase names.
- Cache-first behavior is intentional.
- No E2E or live browser automation will be added or run.
