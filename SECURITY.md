# Security Policy

## Supported State

Desk Pet Prompt Book is source-stage alpha software. Security fixes target the current `main` branch; there is no supported production release or long-term support branch yet.

## Reporting A Vulnerability

Please report vulnerabilities **privately** through GitHub's private vulnerability reporting page when it is available:

<https://github.com/QIUQIU-KONG/desk-pet-prompt-book/security/advisories/new>

If private vulnerability reporting is unavailable, contact the repository owner through the options on the [QIUQIU-KONG GitHub profile](https://github.com/QIUQIU-KONG) to arrange a private channel. Do not include exploit details, sensitive prompts, access tokens, or unpatched vulnerability information in a public issue.

A useful report includes:

- the affected commit and operating system;
- a concise impact statement;
- reproducible steps or a minimal proof of concept;
- relevant logs with personal paths, prompts, and credentials removed; and
- any known mitigations.

The maintainer will assess reproducible reports and coordinate disclosure after a fix or mitigation is available. This source-stage project does not promise a fixed response-time SLA.

## Security Boundaries

The Electron window uses context isolation, renderer sandboxing, and disabled renderer Node integration. Renderer access to clipboard, storage, and window controls is limited to APIs exposed by `src/electron/preload.cjs`.

Prompt data is stored locally as unencrypted JSON. This protects neither against another process running as the same user nor against someone with filesystem access. See [`PRIVACY.md`](PRIVACY.md) for the data model and deletion guidance.

The project currently has no runtime account system, remote prompt API, telemetry, auto-update service, installer, or code-signing pipeline. Do not infer those protections from the source repository.

## Dependency Review

Before submitting dependency changes, run:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run check:syntax
corepack pnpm test
corepack pnpm run audit:high
```

Lockfile changes must be reviewed with the package manifest. Do not commit registry credentials, access tokens, or machine-specific mirror configuration.
