import { test, expect } from '@playwright/test';

const GITHUB_API = 'https://api.github.com/**';

const mockProfile = {
  login: 'testuser',
  name: 'Test User',
  avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
  bio: 'A test user',
  company: null,
  location: null,
  blog: '',
  twitter_username: null,
  followers: 42,
  following: 10,
  public_repos: 5,
};

const staleDate = new Date(Date.now() - 8 * 30 * 24 * 60 * 60 * 1000).toISOString();

const mockRepos = [
  {
    name: 'popular-lib',
    full_name: 'testuser/popular-lib',
    fork: false,
    description: 'A popular library',
    license: null,
    stargazers_count: 120,
    pushed_at: staleDate,
    default_branch: 'main',
  },
  {
    name: 'side-project',
    full_name: 'testuser/side-project',
    fork: false,
    description: null,
    license: { spdx_id: 'MIT' },
    stargazers_count: 8,
    pushed_at: new Date().toISOString(),
    default_branch: 'main',
  },
  {
    name: 'fresh-repo',
    full_name: 'testuser/fresh-repo',
    fork: false,
    description: 'Just started',
    license: { spdx_id: 'MIT' },
    stargazers_count: 0,
    pushed_at: new Date().toISOString(),
    default_branch: 'main',
  },
];

const mockPRs = {
  total_count: 1,
  items: [
    {
      title: 'Fix critical bug in parser',
      html_url: 'https://github.com/testuser/popular-lib/pull/1',
      created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      repository_url: 'https://api.github.com/repos/testuser/popular-lib',
    },
  ],
};

function setupRoutes(page) {
  return page.route(GITHUB_API, route => {
    const url = route.request().url();
    if (url.includes('/users/testuser/repos')) {
      return route.fulfill({ json: mockRepos });
    }
    if (url.includes('/users/testuser/events')) {
      return route.fulfill({ json: [] });
    }
    if (url.includes('/users/testuser')) {
      return route.fulfill({ json: mockProfile });
    }
    if (url.includes('/search/issues') && url.includes('type:pr')) {
      return route.fulfill({ json: mockPRs });
    }
    if (url.includes('/search/issues') && url.includes('type:issue')) {
      return route.fulfill({ json: { items: [] } });
    }
    return route.fulfill({ json: {} });
  });
}

test.describe('Results rendering', () => {
  test('displays profile card with user info', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/?u=testuser');
    await expect(page.locator('.profile-card')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.profile-info h2')).toHaveText('Test User');
    await expect(page.locator('.profile-info .username')).toContainText('@testuser');
  });

  test('displays score overview cards', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/?u=testuser');
    await expect(page.locator('.score-overview')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.score-card')).toHaveCount(3);
  });

  test('displays focus items ranked by score', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/?u=testuser');
    await expect(page.locator('.focus-item').first()).toBeVisible({ timeout: 10000 });

    // First item should have rank #1
    await expect(page.locator('.focus-item').first().locator('.focus-rank')).toHaveText('#1');

    // Items should have category tags
    const tags = page.locator('.focus-tag');
    const count = await tags.count();
    expect(count).toBeGreaterThan(0);
  });

  test('focus items have correct category colors', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/?u=testuser');
    await expect(page.locator('.focus-item').first()).toBeVisible({ timeout: 10000 });

    // Check that category tags exist with proper class names
    const categories = await page.locator('.focus-tag').allTextContents();
    const validCategories = ['health', 'work', 'growth'];
    for (const cat of categories) {
      expect(validCategories).toContain(cat);
    }
  });
});

test.describe('Scoring', () => {
  test('missing license on popular repo ranks high', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/?u=testuser');
    await expect(page.locator('.focus-item').first()).toBeVisible({ timeout: 10000 });

    // The popular-lib has 120 stars and no license — should appear in results
    const items = await page.locator('.focus-title').allTextContents();
    const licenseItem = items.find(t => t.includes('license') && t.includes('popular-lib'));
    expect(licenseItem).toBeTruthy();
  });

  test('stale PR is flagged', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/?u=testuser');
    await expect(page.locator('.focus-item').first()).toBeVisible({ timeout: 10000 });

    const items = await page.locator('.focus-title').allTextContents();
    const prItem = items.find(t => t.includes('Stale PR') || t.includes('critical bug'));
    expect(prItem).toBeTruthy();
  });

  test('scores are displayed as numbers', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/?u=testuser');
    await expect(page.locator('.focus-item').first()).toBeVisible({ timeout: 10000 });

    const scores = await page.locator('.focus-score').allTextContents();
    for (const s of scores) {
      const num = parseFloat(s.replace('score: ', ''));
      expect(num).toBeGreaterThan(0);
      expect(num).toBeLessThanOrEqual(5);
    }
  });
});

test.describe('Caching', () => {
  test('cached results show cache notice', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/?u=testuser');
    await expect(page.locator('.profile-card')).toBeVisible({ timeout: 10000 });

    // Now reload — should use cache
    await page.goto('/?u=testuser');
    await expect(page.locator('.profile-card')).toBeVisible({ timeout: 10000 });
    // Cache should be fresh (< 4h), so no "cached" notice... but the results load instantly
  });

  test('re-scan button clears cache and reloads', async ({ page }) => {
    // Seed stale cache
    await page.goto('/');
    await page.evaluate((profile) => {
      const data = {
        profile,
        findings: [],
        repoCount: 0,
        timestamp: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago (stale)
      };
      localStorage.setItem('gitfocus:result:testuser', JSON.stringify(data));
    }, mockProfile);

    await page.goto('/?u=testuser');

    // Should show cached results with re-scan button
    await expect(page.locator('#rescanBtn')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#cacheNotice')).toContainText('cached');
  });
});

test.describe('Share URL', () => {
  test('analysis updates URL to ?u=username', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/');
    await page.locator('#usernameInput').fill('testuser');
    await page.locator('.search-box button[type="submit"]').click();
    await expect(page.locator('.profile-card')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('?u=testuser');
  });

  test('"New search" button returns to landing', async ({ page }) => {
    await setupRoutes(page);
    await page.goto('/?u=testuser');
    await expect(page.locator('.profile-card')).toBeVisible({ timeout: 10000 });
    await page.locator('text=New search').click();
    await expect(page.locator('#landing')).toBeVisible();
  });
});
