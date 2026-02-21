import { test, expect } from '@playwright/test';

const GITHUB_API = 'https://api.github.com/**';

test.describe('Layout', () => {
  test('renders landing page with search input', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-title')).toContainText('focus');
    await expect(page.locator('#usernameInput')).toBeVisible();
    await expect(page.locator('.search-box button[type="submit"]')).toHaveText('Analyze');
  });

  test('has sticky header with logo and auth button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.logo')).toHaveText('git-focus');
    await expect(page.locator('#authBtn')).toHaveText('Sign in with GitHub');
  });

  test('canvas particle background is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas#particles')).toBeVisible();
  });
});

test.describe('Auth', () => {
  test('auth button says "Sign in with GitHub" when not signed in', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#authBtn')).toHaveText('Sign in with GitHub');
  });

  test('auth button says "Sign out" when token is in localStorage', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('gitfocus:token', 'fake-token'));
    await page.goto('/');
    await expect(page.locator('#authBtn')).toHaveText('Sign out');
  });

  test('clicking sign out clears token', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('gitfocus:token', 'fake-token'));
    await page.goto('/');
    await page.locator('#authBtn').click();
    const token = await page.evaluate(() => localStorage.getItem('gitfocus:token'));
    expect(token).toBeNull();
    await expect(page.locator('#authBtn')).toHaveText('Sign in with GitHub');
  });
});

test.describe('Search', () => {
  test('?u=username auto-fills input and starts analysis', async ({ page }) => {
    await page.route(GITHUB_API, route => {
      const url = route.request().url();
      if (url.includes('/users/testuser/repos')) {
        return route.fulfill({ json: [] });
      }
      if (url.includes('/users/testuser/events')) {
        return route.fulfill({ json: [] });
      }
      if (url.includes('/users/testuser')) {
        return route.fulfill({ json: mockProfile });
      }
      if (url.includes('/search/issues')) {
        return route.fulfill({ json: { items: [] } });
      }
      return route.fulfill({ json: {} });
    });

    await page.goto('/?u=testuser');
    await expect(page.locator('#usernameInput')).toHaveValue('testuser');
    await expect(page.locator('.profile-card')).toBeVisible({ timeout: 10000 });
  });

  test('submitting search form triggers analysis', async ({ page }) => {
    let fetched = false;
    await page.route(GITHUB_API, route => {
      const url = route.request().url();
      fetched = true;
      if (url.includes('/users/demo/repos')) {
        return route.fulfill({ json: [] });
      }
      if (url.includes('/users/demo/events')) {
        return route.fulfill({ json: [] });
      }
      if (url.includes('/users/demo')) {
        return route.fulfill({ json: { ...mockProfile, login: 'demo' } });
      }
      if (url.includes('/search/issues')) {
        return route.fulfill({ json: { items: [] } });
      }
      return route.fulfill({ json: {} });
    });

    await page.goto('/');
    await page.locator('#usernameInput').fill('demo');
    await page.locator('.search-box button[type="submit"]').click();
    await expect(page.locator('.profile-card')).toBeVisible({ timeout: 10000 });
    expect(fetched).toBe(true);
  });

  test('shows error for nonexistent user', async ({ page }) => {
    await page.route(GITHUB_API, route => {
      return route.fulfill({ status: 404, json: { message: 'Not Found' } });
    });

    await page.goto('/');
    await page.locator('#usernameInput').fill('nonexistent');
    await page.locator('.search-box button[type="submit"]').click();
    await expect(page.locator('#errorBox')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#errorBox')).toContainText('not found');
  });
});

const mockProfile = {
  login: 'testuser',
  name: 'Test User',
  avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
  bio: 'A test user',
  company: null,
  location: 'Internet',
  blog: '',
  twitter_username: null,
  followers: 42,
  following: 10,
  public_repos: 5,
};
