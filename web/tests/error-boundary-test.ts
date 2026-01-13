import { chromium } from 'playwright';

const SITE_URL = 'https://snfpnl.com';
const PASSWORD = 'jockibox26';

async function testErrorBoundary() {
  console.log('Testing Error Boundary on Production\n');
  console.log('='.repeat(50));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  try {
    // Step 1: Login with crash-test query param
    console.log('\n1. Logging in (with crash-test mode)...');
    await page.goto(SITE_URL + '?crash-test');
    await page.waitForSelector('#password', { timeout: 10000 });
    await page.fill('#name', 'Test User');
    await page.fill('#password', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.header', { timeout: 15000 });
    console.log('   ✓ Logged in successfully');

    // Step 2: Verify crash button is visible
    console.log('\n2. Looking for Crash Test button...');
    await page.waitForTimeout(500);

    const crashButton = await page.$('button:has-text("Test Crash")');
    if (crashButton) {
      console.log('   ✓ Crash Test button found');
    } else {
      console.log('   ✗ Crash Test button not found');
      console.log('   Note: Button only shows with ?crash-test in URL');
      await browser.close();
      return;
    }

    // Step 3: Click crash button to trigger error
    console.log('\n3. Triggering crash...');
    await crashButton.click();
    await page.waitForTimeout(500);

    // Step 4: Verify Error Boundary UI appeared
    console.log('\n4. Checking Error Boundary UI...');

    const errorBoundary = await page.$('.error-boundary');
    if (errorBoundary) {
      console.log('   ✓ Error Boundary container appeared');

      const errorIcon = await page.$('.error-boundary-icon');
      if (errorIcon) {
        console.log('   ✓ Error icon displayed');
      }

      const errorTitle = await page.$('.error-boundary h1');
      if (errorTitle) {
        const titleText = await errorTitle.textContent();
        console.log(`   ✓ Title: "${titleText}"`);
      }

      const errorMessage = await page.$('.error-boundary-message');
      if (errorMessage) {
        const messageText = await errorMessage.textContent();
        console.log(`   ✓ Message: "${messageText?.substring(0, 50)}..."`);
      }

      // Check buttons
      const tryAgainBtn = await page.$('.error-boundary-btn.primary');
      const reloadBtn = await page.$('.error-boundary-btn.secondary');
      const homeBtn = await page.$('.error-boundary-btn.tertiary');

      if (tryAgainBtn) console.log('   ✓ "Try Again" button present');
      if (reloadBtn) console.log('   ✓ "Reload Page" button present');
      if (homeBtn) console.log('   ✓ "Go Home" button present');

      // Check error details
      const details = await page.$('.error-boundary-details');
      if (details) {
        console.log('   ✓ Error details expandable section present');
        await details.click();
        await page.waitForTimeout(300);
        const pre = await page.$('.error-boundary-details pre');
        if (pre) {
          const errorText = await pre.textContent();
          console.log(`   ✓ Error message: "${errorText?.substring(0, 60)}..."`);
        }
      }

      // Take screenshot
      await page.screenshot({ path: 'tests/error-boundary-screenshot.png' });
      console.log('\n   Screenshot saved: tests/error-boundary-screenshot.png');

      // Step 5: Test Try Again button
      console.log('\n5. Testing "Try Again" button...');
      if (tryAgainBtn) {
        await tryAgainBtn.click();
        await page.waitForTimeout(1000);

        // After Try Again, the app should try to re-render
        // Since the crash component resets state, it might recover
        const headerAfterRetry = await page.$('.header');
        if (headerAfterRetry) {
          console.log('   ✓ App recovered successfully!');
        } else {
          const stillError = await page.$('.error-boundary');
          if (stillError) {
            console.log('   ✓ Error boundary still showing (component still in error state)');
          }
        }
      }

    } else {
      console.log('   ✗ Error Boundary did not appear');
      console.log('   Taking screenshot for debugging...');
      await page.screenshot({ path: 'tests/error-boundary-debug.png' });
    }

    console.log('\n' + '='.repeat(50));
    console.log('Error Boundary test completed!');
    console.log('='.repeat(50));

    // Keep browser open briefly
    console.log('\nKeeping browser open for 3 seconds...');
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('\nTest error:', error);
    await page.screenshot({ path: 'tests/error-boundary-error.png' });
  } finally {
    await browser.close();
  }
}

testErrorBoundary();
