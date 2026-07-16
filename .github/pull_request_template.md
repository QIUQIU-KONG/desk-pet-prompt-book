## Summary

Describe the user or repository problem, the chosen behavior, and the scope intentionally left unchanged.

## Verification

- [ ] I added or updated tests and observed the relevant test fail before implementation when behavior changed.
- [ ] `corepack pnpm run check:syntax` passes.
- [ ] `corepack pnpm test` passes.
- [ ] `corepack pnpm run readiness` passes.
- [ ] `corepack pnpm audit --audit-level high` passes.
- [ ] I included browser/Electron smoke evidence when runtime behavior changed.

## Visual Evidence

Attach before/after screenshots for visual changes. Confirm that prompts, usernames, personal paths, and other sensitive content have been removed.

## Privacy Impact

Explain changes to clipboard access, local storage, logs, network behavior, telemetry, import/export, encryption, or deletion. Write `None` only after checking each category.

## Asset Provenance

- [ ] No visual asset changed; or
- [ ] Every changed asset records its creator/provider, model or tool, references, governing terms, modifications, attribution, and redistribution permission.
- [ ] `ASSET-LICENSE.md` and `docs/asset-provenance.md` are updated when distributed visual files change.

## Final Checks

- [ ] The change is focused and does not include credentials, local configuration, generated prompt data, or machine-specific paths.
- [ ] Replaced code and obsolete assets were removed after references and tests moved.
- [ ] Documentation and changelog entries match the observable behavior.
