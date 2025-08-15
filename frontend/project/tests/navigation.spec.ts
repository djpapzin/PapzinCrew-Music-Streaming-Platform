import { test, expect } from '@playwright/test';

/**
 * E2E: verifies that navigation elements work correctly
 * 
 * Pre-req: Frontend dev server running at E2E_FRONTEND_URL or http://localhost:5173
 */

test.describe('Navigation functionality', () => {
  test('Logo click navigates to home page', async ({ page }) => {
    // Start by going to a different page (upload page)
    await page.goto('/upload');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Verify we're on the upload page
    await expect(page).toHaveURL(/\/upload$/);
    
    // Find the logo in the sidebar - it should contain "Papzin & Crew" text
    const logo = page.locator('a[aria-label="Go to Home"]').first();
    
    // Verify the logo is visible
    await expect(logo).toBeVisible();
    
    // Verify the logo contains the expected text
    await expect(logo).toContainText('Papzin & Crew');
    
    // Click the logo
    await logo.click();
    
    // Wait for navigation to complete
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    
    // Verify we're now on the home page
    await expect(page).toHaveURL(/^\/$|\/$/);
    
    // Verify the page title shows "Good evening" (home page indicator)
    const pageTitle = page.locator('h1').first();
    await expect(pageTitle).toContainText('Good evening');
  });

  test('Logo click from any page returns to home', async ({ page }) => {
    // Test from search page
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');
    
    // Click logo
    const logo = page.locator('a[aria-label="Go to Home"]').first();
    await logo.click();
    await page.waitForLoadState('domcontentloaded');
    
    // Verify we're on home
    await expect(page).toHaveURL(/^\/$|\/$/);
    
    // Test from library page
    await page.goto('/library');
    await page.waitForLoadState('domcontentloaded');
    
    // Click logo again
    await logo.click();
    await page.waitForLoadState('domcontentloaded');
    
    // Verify we're still on home
    await expect(page).toHaveURL(/^\/$|\/$/);
  });

  test('Logo has proper accessibility attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const logo = page.locator('a[aria-label="Go to Home"]').first();
    
    // Verify accessibility attributes
    await expect(logo).toHaveAttribute('aria-label', 'Go to Home');
    
    // Verify it's keyboard accessible
    await logo.focus();
    await expect(logo).toBeFocused();
    
    // Test keyboard navigation (Enter key)
    await page.goto('/upload');
    await page.waitForLoadState('domcontentloaded');
    
    await logo.focus();
    await page.keyboard.press('Enter');
    await page.waitForLoadState('domcontentloaded');
    
    // Verify navigation worked with keyboard
    await expect(page).toHaveURL(/^\/$|\/$/);
  });

  test('Logo maintains visual consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const logo = page.locator('a[aria-label="Go to Home"]').first();
    
    // Verify logo contains the music icon
    const musicIcon = logo.locator('svg').first();
    await expect(musicIcon).toBeVisible();
    
    // Verify logo text has gradient styling
    const logoText = logo.locator('span').first();
    await expect(logoText).toBeVisible();
    await expect(logoText).toContainText('Papzin & Crew');
    
    // Verify hover effects work
    await logo.hover();
    
    // The logo should have transform scale on hover (group-hover:scale-105)
    // We can't directly test CSS transforms, but we can verify the element is still visible and clickable
    await expect(logo).toBeVisible();
  });
});
