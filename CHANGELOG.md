# Changelog

Notable changes are documented here. Grind follows
[Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/) structure.

## [Unreleased]

### Added

- Versioned, migratable local state with stable session and exercise IDs
- Atomic workout completion, history deletion, and undo
- Idempotent webhook outbox with bounded retries
- Training Log navigation and local backup import/export/reset controls
- Keyboard, focus, zoom, reduced-motion, and responsive accessibility support
- Vitest, Playwright, ESLint, formatting, type checks, CI, and repository checks
- Complete contributor, security, support, and issue/PR documentation
- PWA, favicon, social, and install artwork

### Changed

- Split domain, infrastructure, UI, and stylesheet responsibilities
- Replaced the legacy reel implementation with a focused workout plan
- Made package metadata and the in-app version use one release version
- Removed third-party font requests so the interface remains private and
  consistent offline

### Fixed

- Prevented the old query-string test harness from erasing workout data
- Corrected Monday week keys in positive UTC offsets
- Prevented discarded sessions from leaving personal-best or weekly residue
- Corrected unequal-set superset progression
- Prevented duplicate webhook retries
- Preserved active workouts when final storage writes fail
- Made bodyweight logging reps-only

[Unreleased]: https://github.com/tomer-liran/grind/commits/main
