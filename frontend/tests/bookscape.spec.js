import { test, expect } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

async function register(page, email = `reader-${Date.now()}@bookscape.test`) {
  await page.goto(`${baseUrl}/register`);
  await page.getByPlaceholder('Your Name').fill('Reader');
  await page.getByPlaceholder('your@email.com').fill(email);
  await page.getByPlaceholder('Choose a password').fill('secret123');
  await page.getByRole('button', { name: /register/i }).click();
  await expect(page).toHaveURL(/\/library/);
}

async function login(page, email, password) {
  await page.goto(`${baseUrl}/login`);
  await page.getByPlaceholder('your@email.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/library/);
}

test.describe('BookScape E2E', () => {
  test('login/register/navigation flow', async ({ page }) => {
    await register(page);
    await expect(page.getByRole('heading', { name: /my library/i })).toBeVisible();

    await page.getByRole('link', { name: /insights/i }).click();
    await expect(page.getByRole('heading', { name: /reading insights/i })).toBeVisible();

    await page.getByRole('link', { name: /idea nexus/i }).click();
    await expect(page.getByRole('heading', { name: /idea nexus/i })).toBeVisible();
  });

  test('library CRUD and detail update flow', async ({ page }) => {
    await register(page);

    await page.getByRole('button', { name: /\+ add new book/i }).click();
    await page.getByRole('button', { name: /manual/i }).click();
    await page.getByPlaceholder('Title').fill('Playwright Book');
    await page.getByPlaceholder('Author').fill('QA Reader');
    await page.getByPlaceholder('Genre').fill('Testing');
    await page.getByPlaceholder('Publication year').fill('2026');
    await page.locator('input[name="source"]').fill('Manual');
    await page.getByPlaceholder('Synopsis').fill('A book created during an E2E test.');
    await page.getByPlaceholder('Your review').fill('Initial review.');
    await page.getByPlaceholder('Rating (0-5)').fill('4');
    await page.getByRole('button', { name: /save book/i }).click();

    await expect(page.getByText('Playwright Book')).toBeVisible();
    await page.getByRole('link', { name: /view/i }).first().click();
    await expect(page.getByRole('heading', { name: /playwright book/i })).toBeVisible();

    const review = page.getByPlaceholder('Your review');
    await review.fill('Updated from detail page.');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(
      page.locator('p').filter({ hasText: 'Updated from detail page.' }).first()
    ).toBeVisible();
  });

  test('scrape book updates insights and Idea Nexus stays populated', async ({ page }) => {
    await register(page);

    await page.route('**/books/scrape', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'scraped-e2e-book',
          title: 'Scraped E2E Book',
          author: 'Metadata Bot',
          genre: 'Testing',
          publication_year: 2026,
          source: 'Goodreads',
          source_url: 'https://www.goodreads.com/book/show/44767458-dune',
          synopsis: 'Mocked scrape response for a stable E2E run.',
          review: '',
          rating: 4,
          cover_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });
    await page.route('**/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_books: 4,
          average_rating: 4.25,
          books_by_genre: { Testing: 1, 'Sci-Fi': 1, Dystopian: 1, 'Self-improvement': 1 },
          books_by_source: { Goodreads: 2, Amazon: 1, 'Open Library': 1 },
          books_by_month: { '2026-05': 4 },
          top_rated_sources: { Goodreads: 4.5 },
          quotes_per_book: { Dune: 2 },
        }),
      });
    });
    await page.route('**/stats/quotes', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_quotes: 5,
          quotes_by_book: { Dune: 2 },
          quotes_by_relationship: { Resilience: 1, Identity: 1 },
        }),
      });
    });

    await page.getByRole('button', { name: /\+ add new book/i }).click();
    await page.getByPlaceholder(/goodreads/i).fill('https://www.goodreads.com/book/show/44767458-dune');
    await page.getByRole('button', { name: /start scraping now/i }).click();

    await page.getByRole('link', { name: /insights/i }).click();
    await expect(page.getByRole('heading', { name: /reading insights/i })).toBeVisible();
    await expect(page.getByText(/total books/i)).toBeVisible();

    await page.getByRole('link', { name: /idea nexus/i }).click();
    await expect(page.getByText(/resilience/i).first()).toBeVisible();
  });

  test('admin login can create a book and view refreshed stats', async ({ page }) => {
    await login(page, 'admin@bookscape.test', 'admin123');

    await expect(page.getByRole('link', { name: /admin/i })).toBeVisible();
    await page.getByRole('button', { name: /\+ add new book/i }).click();
    await page.getByRole('button', { name: /manual/i }).click();
    await page.getByPlaceholder('Title').fill(`Admin Book ${Date.now()}`);
    await page.getByPlaceholder('Author').fill('Admin Reader');
    await page.getByPlaceholder('Genre').fill('Administration');
    await page.getByPlaceholder('Publication year').fill('2026');
    await page.locator('input[name="source"]').fill('Manual');
    await page.getByPlaceholder('Synopsis').fill('Created by an admin E2E test.');
    await page.getByPlaceholder('Rating (0-5)').fill('5');
    await page.getByRole('button', { name: /save book/i }).click();

    await page.getByRole('link', { name: /insights/i }).click();
    await expect(page.getByRole('heading', { name: /reading insights/i })).toBeVisible();
    await expect(page.getByText(/total books/i)).toBeVisible();
  });

  test('normal user is restricted from admin UI', async ({ page }) => {
    await login(page, 'reader@bookscape.test', 'reader123');

    await expect(page.getByRole('link', { name: /admin/i })).toHaveCount(0);
    await page.goto(`${baseUrl}/admin`);
    await expect(page.getByRole('heading', { name: /admin access required/i })).toBeVisible();
  });

  test('password recovery flow works with a dev reset token', async ({ page }) => {
    const email = `reset-${Date.now()}@bookscape.test`;
    await register(page, email);
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByRole('link', { name: /forgot your password/i }).click();
    await page.getByPlaceholder('your@email.com').fill(email);
    await page.getByRole('button', { name: /send reset token/i }).click();
    await page.getByRole('link', { name: /continue to reset password/i }).click();

    await page.getByPlaceholder('New password').fill('newsecret123');
    await page.getByPlaceholder('Confirm password').fill('newsecret123');
    await page.getByRole('button', { name: /reset password/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await login(page, email, 'newsecret123');
    await expect(page.getByRole('heading', { name: /my library/i })).toBeVisible();
  });

  test('chat broadcasts between two logged-in users', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const readerContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const readerPage = await readerContext.newPage();

    await login(adminPage, 'admin@bookscape.test', 'admin123');
    await login(readerPage, 'reader@bookscape.test', 'reader123');

    await adminPage.getByRole('link', { name: /chat/i }).click();
    await readerPage.getByRole('link', { name: /chat/i }).click();

    const text = `Hello from Playwright ${Date.now()}`;
    await adminPage.getByPlaceholder(/share a thought/i).fill(text);
    await adminPage.getByRole('button', { name: /send/i }).click();

    await expect(readerPage.getByText(text)).toBeVisible();

    await adminContext.close();
    await readerContext.close();
  });
});
