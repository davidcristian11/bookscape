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
});
