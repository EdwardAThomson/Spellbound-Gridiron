---
harness:
  generated_by: plimsoll/0.1
  run_id: r_df5df1c84aa4
  generated_at: 2026-08-10T14:18:25Z
  regenerable: true
---

# Assumptions

### Exact file names/locations for the new specs and services that acceptance commands reference

- choice: Use e2e/menu.spec.ts, e2e/help.spec.ts, e2e/tutorial.spec.ts, e2e/campaign.spec.ts, services/campaign.ts + services/campaign.test.ts, services/tutorial.ts + services/tutorial.test.ts, and a HelpModal in components/
- rejected: Embedding tutorial/campaign logic inside existing files (App.tsx/rules.ts) and folding new e2e assertions into the existing smoke spec
- reversal_cost: cheap

### Whether Help replaces or sits alongside the existing Game Rules button

- choice: Provide a single always-available Help entry that supersedes the Game Rules button, with Controls and How-to-play sections (How-to-play reusing GAME_RULES)
- rejected: Keeping a separate Game Rules button in addition to a new Help entry
- reversal_cost: cheap

### How the campaign is persisted and keyed in localStorage

- choice: Store campaign state under its own versioned key (e.g. spellbound_campaign_v1), separate from match saves and rosters, with a version field and corrupt/missing-data fallback to a clean state
- rejected: Reusing the existing save-game key/namespace for campaign state
- reversal_cost: moderate

### The AI-vs-AI match simulator's scoring model

- choice: Deterministic, rng-injected function mapping team quality (aggregate levels/stats) plus injected rolls to a plausible score; same rng always yields the same result
- rejected: Purely random scores independent of team quality, or an LLM-generated score
- reversal_cost: moderate

### Fixture structure for a 4-team double round-robin

- choice: 6 rounds, 12 total fixtures (each pair plays twice, home/away), standings scored 3-1-0
- rejected: Single round-robin (6 fixtures) or an unbalanced schedule
- reversal_cost: moderate

### How the tutorial board/scenario is set up

- choice: A fixed scripted Grass/Clear scenario driven by the data-driven step list, running with no API keys and isolated from real saves/rosters
- rejected: Reusing a normal randomized Quick Play match as the tutorial surface
- reversal_cost: moderate

### How the menu is re-reachable from a running/finished match

- choice: Expose a quit-to-menu control during play plus a return-to-menu action on the game-over screen, both without a page reload and preserving save integrity
- rejected: Only offering return-to-menu on the game-over screen (no mid-match quit)
- reversal_cost: cheap
