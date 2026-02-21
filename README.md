# git-focus

Analyze a GitHub profile and get a prioritized list of things to focus on — covering repo health, active work, and growth opportunities.

## How it works

Enter a GitHub username and git-focus will:

1. Fetch repos, PRs, issues, activity, and CI status via the GitHub API
2. Analyze across three categories: **Health**, **Work**, and **Growth**
3. Score each finding by impact, effort, and urgency
4. Return a ranked top 5-10 list of actionable focus items

Works without auth (60 req/hr) or sign in with GitHub for 5,000 req/hr.

## Run locally

```bash
npx serve . -p 8080
```

Open `http://localhost:8080` and search for a GitHub username.

## Tests

```bash
npm install
npx playwright install --with-deps chromium
npx playwright test
```

## Deploy

Deployed to GitHub Pages via the `deploy.yml` workflow. Pushes to `main` trigger a deploy after tests pass.

## OAuth proxy

The `worker/` directory contains a Cloudflare Worker that handles GitHub OAuth token exchange. Deploy it separately:

```bash
cd worker
npm install
npx wrangler deploy
```

Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as secrets in your Cloudflare Worker.

## License

MIT
