# Contributing

We accept PRs that implement codemods described in open issues.

**Requirements**

- Tests with realistic fixtures.
- Idempotency: running the codemod twice should produce no diff.
- `--dry-run` support.
- Include an upstream reference link in your PR description.

**New transformations**

Open an issue using the “Transformation proposal” template and include: why it matters, before/after, detection (AST/regex/config path), edge cases, and an official reference URL.
