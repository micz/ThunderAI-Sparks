# claude-spec

Architecture and design documentation for **ThunderAI Sparks**, written for AI
agents (and humans) working in this repo.

Start with [`../CLAUDE.md`](../CLAUDE.md) for the high-level picture, then read
the docs here for detail.

## Documents

- [`01-overview.md`](01-overview.md) — what Sparks is, why it exists as a separate
  add-on, and its relationship to ThunderAI.
- [`02-architecture.md`](02-architecture.md) — components, the message flow between
  ThunderAI and Sparks, and the experimental Calendar API.
- [`03-data-contracts.md`](03-data-contracts.md) — the exact message actions and
  JSON payloads exchanged with ThunderAI (event & task shapes).
- [`04-thunderai-integration.md`](04-thunderai-integration.md) — the companion-add-on
  boundary: what lives in ThunderAI (prompts, LLM, menus) vs. what lives here.

## The one thing to remember

> **The prompts live in ThunderAI, not here.** Sparks receives already-produced
> JSON from ThunderAI and opens native Thunderbird dialogs with it. Any change
> that depends on *what the LLM is asked to produce* is a ThunderAI change.
> See [`04-thunderai-integration.md`](04-thunderai-integration.md).
