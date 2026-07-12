# Contributing to OpenStudio AI

Thank you for your interest in contributing! This document explains how to get involved.

---

## Ways to Contribute

- **Bug reports** — open a GitHub Issue with reproduction steps
- **Feature requests** — discuss in GitHub Discussions before implementing
- **Pull requests** — code, documentation, tests
- **Plugins** — publish as separate packages with the `openstudio-plugin` topic
- **Models** — submit additions to the built-in model registry
- **Translations** — i18n is planned for v0.2

---

## Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m "feat: describe your change"`
6. Push and open a Pull Request

---

## Code Style

### TypeScript / React
- All code must pass ESLint and TypeScript checks: `npm run lint && npm run typecheck`
- Use functional components and hooks
- Follow existing file naming conventions
- No `any` types without justification

### Rust
- Run `cargo fmt` and `cargo clippy` before committing
- Keep unsafe code to an absolute minimum
- Document public functions

### Python
- Run `ruff format` and `ruff check` before committing
- Type annotations on all functions
- `mypy` must pass

---

## Commit Convention

We use [Conventional Commits](https://conventionalcommits.org):

```
feat:     new feature
fix:      bug fix
docs:     documentation only
refactor: code change without feature/fix
test:     add/modify tests
chore:    build scripts, tooling
```

---

## Pull Request Guidelines

- Keep PRs focused — one feature/fix per PR
- Add or update tests for your changes
- Update documentation if the behavior changes
- Fill in the PR template completely
- Be responsive to review feedback

---

## Code of Conduct

Be respectful and constructive. We follow the [Contributor Covenant](https://contributor-covenant.org/version/2/1/code_of_conduct/).
