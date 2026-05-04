// tests/bookscape.spec.js
import { test, expect } from '@playwright/test';
// Înainte de fiecare test, spunem robotului să meargă la adresa locală a aplicației
test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
});

test.describe('BookScape Silver Challenge E2E Tests', () => {

    // =================================================================
    // SCENARIUL 1: Testarea fluxului de Autentificare (Login)
    // =================================================================
    test('User can log in and is redirected to Library', async ({ page }) => {
        // 1. Mergem pe pagina de login
        await page.click('text=Log In');

        // 2. Verificăm că am ajuns pe URL-ul corect
        await expect(page).toHaveURL('http://localhost:5173/login');

        // 3. Completăm formularul folosind atributele 'type'
        await page.fill('input[type="email"]', 'test@bookscape.com');
        await page.fill('input[type="password"]', 'parolasecreta');

        // 4. Apăsăm butonul de submit
        await page.click('button[type="submit"]');

        // 5. Verificăm ("Assert") dacă redirecționarea a avut succes și vedem titlul Library
        await expect(page).toHaveURL('http://localhost:5173/library');
        await expect(page.locator('h1')).toHaveText('My Library');
    });

    // =================================================================
    // SCENARIUL 2: Testarea adăugării unei cărți (Scraping Simulation)
    // =================================================================
    test('User can open Modal and add a new scraped book', async ({ page }) => {
        await page.goto('http://localhost:5173/library');

        await page.click('text=+ Scrape New Book');
        await expect(page.locator('h2').filter({ hasText: 'Scrape Book Data' })).toBeVisible();
        await page.fill('input[type="text"]', 'https://www.goodreads.com/book/show/test');
        await page.click('button:has-text("Scrape Book")');
        await expect(page.locator('text=Scrape Book Data')).not.toBeVisible();

        // --- REZOLVAREA AICI ---
        // Robotul trebuie să dea click pe "Next" ca să meargă pe pagina a 2-a
        await page.click('button:has-text("Next")');

        // Acum verificăm dacă pe ecran a apărut titlul
        await expect(page.locator('text=New Scraped Book')).toBeVisible();
    });

    // =================================================================
    // SCENARIUL 3: Testarea salvării preferinței de vizualizare (Cookies)
    // =================================================================
    test('Application remembers Grid view preference via Cookie', async ({ page, context }) => {
        await page.goto('http://localhost:5173/library');

        // 1. Apăsăm butonul 'Grid'
        await page.click('button:has-text("Grid")');

        // 2. Citim cookie-urile din browserul automatizat
        const cookies = await context.cookies();

        // 3. Căutăm cookie-ul nostru specificat la Pasul Anterior din provocarea Silver
        const viewPrefCookie = cookies.find(c => c.name === 'libraryViewPreference');

        // 4. Verificăm dacă există și dacă valoarea este 'grid'
        expect(viewPrefCookie).toBeDefined();
        expect(viewPrefCookie.value).toBe('grid');

        // 5. Dăm un refresh la pagină
        await page.reload();

        // 6. Verificăm dacă butonul 'Grid' are în continuare clasa 'active' după refresh
        const gridButton = page.locator('button:has-text("Grid")');
        await expect(gridButton).toHaveClass(/active/);
    });

});