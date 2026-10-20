# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use [GitHub private vulnerability reporting](https://github.com/tomer-liran/grind/security/advisories/new).
Include:

- The affected commit or release
- Reproduction steps
- Expected impact
- Any suggested mitigation

You should receive an acknowledgement within seven days. Please allow time for
a fix and coordinated disclosure before publishing details.

## Supported versions

Security fixes target the latest code on `main` and the latest tagged release.
Older deployments should upgrade to receive fixes.

## Security model

Grind is a static, client-only PWA:

- Workout data is stored in the browser on the current device.
- There is no account system or first-party backend.
- Optional webhook sync sends the documented workout payload to an endpoint
  configured by the person deploying the app.
- A webhook URL shipped in browser JavaScript is public configuration, not a
  secret. The receiving endpoint must enforce its own authentication, CORS,
  rate limiting, validation, and idempotency.
- Exported backup files can contain workout history. Store and share them
  accordingly.

Dependency and workflow reports that do not demonstrate an exploitable impact
may be handled as regular maintenance issues.
