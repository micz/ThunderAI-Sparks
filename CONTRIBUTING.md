# Contributing to ThunderAI Sparks

Thank you for your interest in contributing to ThunderAI Sparks!
This page explains how to report issues, help with translations and open pull requests.

ThunderAI Sparks is a companion add-on for [ThunderAI](https://github.com/micz/ThunderAI).
It only *executes* features that need Thunderbird's experimental APIs (creating calendar
events and tasks from a mail message); it does **not** talk to any LLM and does **not**
contain the prompts. All AI prompting, model configuration and message extraction live in
the ThunderAI add-on. See [`CLAUDE.md`](CLAUDE.md) for the split between the two add-ons.

## Reporting bugs and requesting features

Issues for Sparks are tracked in the **ThunderAI** repository. Please open an issue there
using the [bug report or feature request templates](https://github.com/micz/ThunderAI/issues/new/choose)
and add the [`Sparks` label](https://github.com/micz/ThunderAI/labels/Sparks).
Before opening a new issue, check whether a similar one already exists.

## Translations

Translations are managed on [Weblate](https://hosted.weblate.org/engage/thunderai/).
Please **do not edit the locale files directly**: the only file edited by hand is
`_locales/en/messages.json`.
If your change adds or modifies user-facing strings, update only the English file; the
other languages will be updated through Weblate.

## A feature may need changes in both add-ons

Because Sparks is only the executor, a new event/task field (or any behavior that depends
on what the LLM is asked to produce) needs changes in **both** repositories:

- here, the field is plumbed through `api/CalendarTools/schema.json` and
  `api/CalendarTools/implementation.js`, and added to the field whitelist in
  `mztas-background.js` (which drops undeclared fields);
- in [ThunderAI](https://github.com/micz/ThunderAI), the prompt is updated to ask the LLM
  for that field.

If your change depends on the prompt, please open the related issue in the ThunderAI
repository so both sides can be coordinated.

## Release notes and changelog

When your change should be mentioned to users, add an entry to
`options/mztas-release-notes.html` and a matching `<h2>` block at the top of
[`CHANGELOG.md`](CHANGELOG.md) (the changelog uses HTML `<h2>`/`<ul>`, not Markdown
headings). The version is read at runtime from the manifest, so do not hardcode it; a
release bump changes `version` in `manifest.json`.

## Branches

| Branch | Purpose |
| ------ | ------- |
| `main` | Released code. It always matches the latest version published on [addons.thunderbird.net](https://addons.thunderbird.net/thunderbird/addon/thunderai-sparks/). |
| `dev`  | Ongoing development. The next release is built from here. |

### Which branch should my pull request target?

**Target `dev`** for almost everything: new features, improvements, refactoring,
documentation and non-urgent bug fixes.

**Target `main` only for urgent bug fixes** to the released version, for example:

- a feature that is completely broken;
- a regression introduced by the latest release;
- a compatibility break with a new Thunderbird version that stops an experimental API from working;
- a security issue.

If you are not sure, target `dev` and explain the urgency in the pull request: the fix can
still be moved to `main` if needed.

> Pull requests opened on `main` are automatically retargeted to `dev`, unless the source
> branch name starts with `hotfix/`.
> For an urgent fix, name your branch like `hotfix/short-description`.

## Opening a pull request

1. Fork the repository and create your branch:
   - from `dev` for regular changes: `git switch -c my-feature origin/dev`
   - from `main` for urgent fixes: `git switch -c hotfix/short-description origin/main`
2. Keep the pull request focused on a single change. Smaller pull requests are reviewed faster.
3. Test your change in Thunderbird (see below).
4. Open the pull request against the correct branch.

If GitHub reports conflicts, please update your branch by merging or rebasing the target
branch into it.

### Testing your change

ThunderAI Sparks requires **Thunderbird 140.0 or later**, and must run alongside the
ThunderAI add-on.

There is an automated test suite (Node's built-in runner, with jsdom as the only
development dependency). It is never packaged with the add-on.

- Level 1 (nothing to install): `node --test "tests/**/*.test.mjs"`
- Full suite, including the jsdom DOM tests: `npm ci` then `npm test`

See [`tests/README.md`](tests/README.md) for details.

To load your local copy without packaging it:

1. In Thunderbird, open *Tools → Developer Tools → Debug Add-ons*.
2. Click *Load Temporary Add-on…* and select the `manifest.json` file in your working copy
   (load ThunderAI the same way if it is not already installed).
3. Use *Reload* after each change.

## License

ThunderAI Sparks is released under the [GNU General Public License v3.0](LICENSE).
By contributing, you agree that your contributions will be licensed under the same license.
