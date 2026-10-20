# Maintainer checklist

These settings live on GitHub and are intentionally not changed by repository
automation.

## Repository profile

- Add a verified deployment URL as the repository homepage.
- Add topics: `pwa`, `fitness`, `workout-tracker`, `offline-first`,
  `vanilla-javascript`.
- Enable Discussions if `SUPPORT.md` should route there.

## Security

- Enable Dependabot alerts and security updates.
- Enable secret scanning and push protection.
- Enable private vulnerability reporting.

## Main branch rules

- Require pull requests before merging.
- Require the `quality` and `browser` CI jobs.
- Require branches to be up to date.
- Block force pushes and deletion.
- Allow a maintainer bypass while the project has one maintainer.

## Releases

1. Update `CHANGELOG.md` and `package.json`.
2. Run `npm ci && npm run check && npm run test:e2e`.
3. Commit with `chore(release): vX.Y.Z`.
4. Tag `vX.Y.Z`.
5. Publish GitHub release notes from the changelog.
6. Deploy the exact tagged commit and verify offline installation.
