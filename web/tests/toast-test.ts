import { chromium } from 'playwright';

const SITE_URL = 'https://snfpnl.com';
const PASSWORD = 'jockibox26';

async function testToastNotifications() {
  console.log('Testing Toast Notifications on Production\n');
  console.log('='.repeat(50));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  try {
    // Step 1: Login
    console.log('\n1. Logging in...');
    await page.goto(SITE_URL);
    await page.waitForSelector('#password', { timeout: 10000 });
    await page.fill('#name', 'Test User');
    await page.fill('#password', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.header', { timeout: 15000 });
    console.log('   ✓ Logged in successfully');

    // Step 2: Navigate to Upload page
    console.log('\n2. Navigating to Upload page...');
    await page.click('button:has-text("Upload")');
    await page.waitForSelector('.data-upload', { timeout: 10000 });
    console.log('   ✓ Upload page loaded');

    // Step 3: Test invalid file error toast
    console.log('\n3. Testing error toast (invalid file type)...');

    // Create a fake text file to trigger the error
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      // Create a buffer with fake content
      const buffer = Buffer.from('This is a test file');
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: buffer
      });

      // Wait for toast to appear
      await page.waitForTimeout(500);

      // Check if error toast appeared
      const errorToast = await page.$('.toast-error');
      if (errorToast) {
        const toastTitle = await errorToast.$('.toast-title');
        const titleText = await toastTitle?.textContent();
        console.log(`   ✓ Error toast appeared: "${titleText}"`);

        // Test dismiss button
        const dismissBtn = await errorToast.$('.toast-dismiss');
        if (dismissBtn) {
          await dismissBtn.click();
          await page.waitForTimeout(300);
          const toastAfterDismiss = await page.$('.toast-error');
          if (!toastAfterDismiss) {
            console.log('   ✓ Toast dismissed successfully');
          }
        }
      } else {
        console.log('   ✗ Error toast did not appear');
      }
    }

    // Step 4: Test toast container exists
    console.log('\n4. Verifying toast container...');
    const toastContainer = await page.$('.toast-container');
    if (toastContainer) {
      console.log('   ✓ Toast container is present');
    } else {
      console.log('   ✗ Toast container not found');
    }

    // Step 5: Test another invalid file to see animation
    console.log('\n5. Testing toast animation...');
    if (fileInput) {
      const buffer2 = Buffer.from('Another test');
      await fileInput.setInputFiles({
        name: 'invalid.pdf',
        mimeType: 'application/pdf',
        buffer: buffer2
      });

      await page.waitForTimeout(1000);
      const toast = await page.$('.toast');
      if (toast) {
        const boundingBox = await toast.boundingBox();
        if (boundingBox) {
          console.log(`   ✓ Toast positioned at x:${Math.round(boundingBox.x)}, y:${Math.round(boundingBox.y)}`);
        }
      }
    }

    // Wait to observe
    console.log('\n6. Waiting 3 seconds to observe...');
    await page.waitForTimeout(3000);

    console.log('\n' + '='.repeat(50));
    console.log('Toast notification tests completed!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\nTest failed:', error);
  } finally {
    await browser.close();
  }
}

testToastNotifications();
