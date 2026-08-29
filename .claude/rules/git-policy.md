# Git and production policy

- Inspect `git status --short`, the current branch, and relevant diffs before editing or staging.
- Treat all pre-existing tracked and untracked changes as user-owned. Preserve them and stage only task files.
- Use `origin/main` as the comparison and pull-request base. Do not rename the active Conductor branch.
- Keep commits focused and describe behavior, not implementation trivia.
- Never force-push, reset shared history, discard changes, or run broad destructive cleanup commands.
- Do not commit secrets, real environment files such as `.env.local`, `.vercel/`, `.next/`, `.context/`, database dumps, or generated caches. `.env.example` may contain variable names and non-secret placeholders only.
- Do not push, merge, deploy, change Neon/Vercel configuration, or apply a production migration without explicit authorization or a clear standing instruction from the user.
- Before an authorized push, fetch safely and confirm the intended commits and files. Never silently overwrite a newer `origin/main`.
- Report the commit hash, pushed ref, migration result, deployment URL/status, and smoke-test result for actions actually performed.
- Production deploys from `main` through the Vercel Git integration, so shipping means merging, not `vercel --prod` from a branch.
- Never commit `public/motivation/` images without confirming their licence, or anything pulled by `vercel env pull`.
