---
name: release-fitlog
description: Verify, commit, push, migrate, deploy, and smoke-test Fitlog while preserving unrelated work. Invoke only when the user explicitly asks to release, push, merge, deploy, or ship.
disable-model-invocation: true
---

# Release Fitlog

1. Map the user's authorization separately for commit, push, main update, production migration, deployment, and external configuration.
2. Inspect status, branch, unstaged/staged diffs, and `origin/main..HEAD`. Preserve unrelated work; never rename the Conductor branch, reset, rewrite history, or force-push.
3. Review the intended diff for secrets, ownership gaps, unsafe migrations, generated artifacts, and accidental files. Run tests, lint, and build.
4. If schema changed, invoke `/migrate-fitlog-database` and complete the authorized target's dry-run before rollout.
5. Stage only intended files, recheck the staged diff, commit, fetch, and verify that publishing cannot overwrite newer mainline work.
6. Push only the authorized ref. Production deploys through the Vercel `main` integration; do not substitute `vercel --prod` from a branch.
7. Wait for deployment readiness, then smoke-test `https://fitlog.site`: public auth/legal pages, protected behavior, changed path, and a safe failure case. Do not create fake production health data.
8. For icons, compare the deployed file and mention iOS reinstall caching. For auth, verify canonical trusted origins. For Garmin Worker changes, verify its separately authorized deployment.
9. Report commit, refs, migration, deployment, smoke results, and residual risk. Never claim completion for a check not performed.
