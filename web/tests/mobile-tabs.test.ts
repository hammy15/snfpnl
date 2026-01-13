/**
 * Mobile Tab Navigation Tests
 *
 * Tests that all tabs (Dashboard and Facility Detail) work correctly
 * on mobile devices via touchscreen interaction.
 *
 * Run with: npx tsx tests/mobile-tabs.test.ts
 */

import { chromium, devices, type Page } from 'playwright';

const TEST_URL = 'https://snfpnl.com';
const TEST_PASSWORD = 'jockibox26';

const MOBILE_DEVICES = ['iPhone 12', 'iPhone 14', 'Pixel 5', 'Galaxy S9+'];

interface TestResults {
  dashboardTabs: boolean;
  facilityTabs: boolean;
  userGuide: boolean;
}

async function login(page: Page, name: string): Promise<void> {
  const nameField = await page.locator('#name').count();
  if (nameField > 0) {
    await page.fill('#name', name);
    await page.fill('#password', TEST_PASSWORD);
    await page.tap('button[type="submit"]');
    await page.waitForTimeout(2000);
  }
}

async function closeUserGuide(page: Page): Promise<boolean> {
  const guideVisible = await page.locator('.user-guide-overlay').isVisible().catch(() => false);
  if (guideVisible) {
    const closeBtn = page.locator('.user-guide-close');
    const bbox = await closeBtn.boundingBox();
    if (bbox) {
      await page.touchscreen.tap(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
      await page.waitForTimeout(500);
      const stillVisible = await page.locator('.user-guide-overlay').isVisible().catch(() => false);
      return !stillVisible;
    }
  }
  return true; // Guide wasn't visible, consider it passed
}

async function testDashboardTabs(page: Page): Promise<boolean> {
  const tabs = ['Summary', 'Analytics', 'Exports'];
  let passed = 0;

  for (const tabName of tabs) {
    const tab = page.locator('[role="tab"]:has-text("' + tabName + '")');
    if (await tab.count() > 0) {
      const bbox = await tab.boundingBox();
      if (bbox) {
        await page.touchscreen.tap(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
        await page.waitForTimeout(600);
        const isSelected = await tab.getAttribute('aria-selected');
        if (isSelected === 'true') passed++;
      }
    }
  }

  return passed === tabs.length;
}

async function navigateToFacility(page: Page): Promise<boolean> {
  // Open mobile menu if present
  const hamburger = page.locator('.hamburger, .menu-toggle, [class*="menu-btn"]').first();
  if (await hamburger.count() > 0 && await hamburger.isVisible()) {
    await hamburger.tap({ force: true });
    await page.waitForTimeout(300);
  }

  // Navigate to Facilities
  const facilitiesNav = page.locator('button:has-text("Facilities")').first();
  if (await facilitiesNav.isVisible()) {
    await facilitiesNav.tap({ force: true });
    await page.waitForTimeout(1500);
  }

  // Click on a facility
  const facilityItem = page.locator('[class*="facility-name"]').first();
  if (await facilityItem.count() > 0) {
    await facilityItem.tap({ force: true });
    await page.waitForTimeout(2000);
    return true;
  }

  return false;
}

async function testFacilityTabs(page: Page): Promise<boolean> {
  const tabs = ['Overview', 'Financials', 'Analysis', 'Reports'];
  let passed = 0;

  for (const tabName of tabs) {
    const tab = page.locator('[role="tab"]:has-text("' + tabName + '")');
    if (await tab.count() > 0) {
      const bbox = await tab.boundingBox();
      if (bbox) {
        await page.touchscreen.tap(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
        await page.waitForTimeout(600);
        const isSelected = await tab.getAttribute('aria-selected');
        if (isSelected === 'true') passed++;
      }
    }
  }

  return passed === tabs.length;
}

async function testDevice(deviceName: string): Promise<TestResults> {
  const browser = await chromium.launch();
  const device = devices[deviceName];
  const context = await browser.newContext({
    ...device,
    hasTouch: true,
  });
  const page = await context.newPage();

  const results: TestResults = {
    dashboardTabs: false,
    facilityTabs: false,
    userGuide: false,
  };

  try {
    // Setup: navigate and clear storage
    await page.goto(TEST_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });

    // Login
    await login(page, 'Test ' + deviceName);

    // Test user guide close
    results.userGuide = await closeUserGuide(page);

    // Test dashboard tabs
    results.dashboardTabs = await testDashboardTabs(page);

    // Navigate to facility and test facility tabs
    if (await navigateToFacility(page)) {
      results.facilityTabs = await testFacilityTabs(page);
    }

  } catch (error) {
    console.error('[' + deviceName + '] Error:', error);
  } finally {
    await browser.close();
  }

  return results;
}

async function runTests(): Promise<void> {
  console.log('Mobile Tab Navigation Tests');
  console.log('============================\n');

  let allPassed = true;

  for (const deviceName of MOBILE_DEVICES) {
    const results = await testDevice(deviceName);

    const guideStatus = results.userGuide ? 'OK' : 'FAIL';
    const dashStatus = results.dashboardTabs ? 'OK' : 'FAIL';
    const facStatus = results.facilityTabs ? 'OK' : 'FAIL';

    console.log('[' + deviceName + ']');
    console.log('  User Guide Close: ' + guideStatus);
    console.log('  Dashboard Tabs:   ' + dashStatus);
    console.log('  Facility Tabs:    ' + facStatus);
    console.log('');

    if (!results.userGuide || !results.dashboardTabs || !results.facilityTabs) {
      allPassed = false;
    }
  }

  console.log('============================');
  if (allPassed) {
    console.log('All tests passed!');
  } else {
    console.log('Some tests failed.');
    process.exit(1);
  }
}

runTests();
