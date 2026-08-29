---
name: release-fitlog
description: Verify, commit, push, migrate, deploy, and smoke-test a Fitlog release using GitHub, Neon, and Vercel while preserving unrelated worktree changes. Invoke only when the user explicitly asks to release, push, merge, deploy, or ship changes.
disable-model-invocation: true
---

# Release Fitlog

## Authorization and scope

1. Confirm the user's request authorizes each requested mutation: commit, push, merge/update main, production migration, and deployment are separate actions.
2. Inspect `git status --short`, the current branch, `git diff`, `git diff --cached`, and `git log --oneline origin/main..HEAD`.
3. Preserve all unrelated changes. Do not rename the Conductor branch, force-push, reset, or rewrite history.

## Release gate

1. Review the final diff for secrets, generated artifacts, missing ownership filters, unsafe migrations, and accidental file changes.
2. Run `npm test`, `npm run lint`, and `npm run build`.
3. If the schema changed, invoke `/migrate-fitlog-database` and complete its dry-run before any production application.
4. Stage only intended files and create a focused commit. Recheck the staged diff before committing.
5. Fetch `origin` and confirm the push will not overwrite newer mainline work. Resolve divergence without destructive commands.

## Publish and verify

1. Push the authorized ref. Update `main` only when explicitly requested. Production deploys from `main` through the Vercel Git integration, so merging is what ships; do not deploy a branch with `vercel --prod`.
2. Apply an authorized production migration before or after deployment according to backward-compatibility needs; prefer an expand/migrate/contract rollout for breaking schema changes.
3. Deploy through the linked Vercel project and wait for READY/failed status. Do not treat upload completion as a successful deployment.
4. Smoke-test the production alias `https://my-health-app-phi.vercel.app`: public auth page, protected redirect/session behavior, changed API/UI path, and a safe failure case. Never create fake production health data merely to smoke-test.
5. Preview URLs stay behind Vercel Authentication; reach them with the protection bypass secret in an `x-vercel-protection-bypass` header rather than disabling protection.
5. For Neon Auth changes, verify the production origin remains in the branch's trusted-domain list.
6. Report commit SHA, pushed branch/main status, migration details, deployment URL/ID, smoke results, and any residual risk.
