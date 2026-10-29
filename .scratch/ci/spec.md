**Status:** ready-for-agent

## Problem Statement

Nada roda os testes, o typecheck e o build antes de publicar. A 1.0 pode sair com um teste vermelho ou um build quebrado.

## Solution

Um workflow de integração contínua, no Git do projeto, roda a suíte de testes, o typecheck do TypeScript e o build de produção em cada push e pull request. O workflow falha se qualquer um dos três falhar.

## User Stories

1. As a maintainer, I want tests to run on every push, so that a broken seam blocks the release.
2. As a maintainer, I want the TypeScript check to run in that same workflow, so that a type error is not shipped behind a green test run.
3. As a maintainer, I want the production build to run in CI, so that the PWA bundle is known to compile.
4. As a contributor, I want the same commands locally and in CI, so that a green local run matches the workflow.
5. As a maintainer without a remote yet, I want the workflow file in the repo, so that the first push already checks the build.

## Implementation Decisions

- Use the scripts already defined for test and build. The typecheck is the one the build already runs before Vite; CI may run it as its own step so a type error is visible without a full bundle.
- The workflow installs dependencies from the lockfile and uses Node 20 or newer, matching the README.
- Do not add coverage gates, deploy steps, or secret keys.
- Creating the git history is a prerequisite of pushing the workflow, not a behavior change of the editor. This spec does not choose a host or force-push.

## Testing Decisions

- The seam is the workflow result: three commands, each exiting 0.
- Do not assert on CI vendor logs. Assert that the workflow invokes the project scripts.
- Existing Vitest seams stay as they are. This spec does not add a product test.

## Out of Scope

- Publishing the site from CI.
- Lint as a required check. It can be added later; the release bar is test, types, and build.
- Matrix builds for several operating systems. One current Linux runner is enough.

## Further Notes

The workspace may not be a git repository yet. The workflow file can land before `git init`. Pushing it is how the check becomes real.
