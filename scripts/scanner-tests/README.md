# DeployBuddy Scanner Test Suite

This directory contains synthetic unit and regression test fixtures for the DeployBuddy scanner core (`netlify/scanner-core/analyze.ts`).

## Running the Tests

With Node.js >= 22.18:
```bash
node --test scripts/scanner-tests/*.test.ts
```

Or with `tsx`:
```bash
npx --yes tsx --test scripts/scanner-tests/*.test.ts
```

## Structure
- `make-source.ts`: In-memory `RepoSource` builder for synthetic file trees.
- `p1.test.ts`: [P1] Detection of web apps vs libraries/tools/monorepos (C01 - C09).
- `p2.test.ts`: [P2] Hosting targets and framework-correct Netlify advice (C10 - C21).
- `p3.test.ts`: [P3] Committed `.env` file scanning and secret detection (C22 - C27).
- `p4.test.ts`: [P4] Environment variable references and `.env.example` accuracy (C28 - C35).
- `p5.test.ts`: [P5] Source file scanning prioritization and timeout safety (C36 - C38).
- `p6.test.ts`: [P6] Predictable default secrets (C39 - C41).
- `p7.test.ts`: [P7] Grouping environment variables by workspace folder / tooling (C42).
- `regression.test.ts`: Regression control tests (C43, C44).
