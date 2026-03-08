import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

// Capture console messages
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

console.log('Navigating to playground...');
await page.goto('http://localhost:8080/playground.html', { waitUntil: 'networkidle' });

// Wait for initialization
await page.waitForTimeout(3000);

console.log('Taking screenshot...');
await page.screenshot({ path: '/home/yangjing/ClaudePad/playground-test.png', fullPage: true });

// Check canvas content
const canvasData = await page.evaluate(() => {
  const canvas = document.getElementById('hyruleCanvas');
  return {
    width: canvas?.width,
    height: canvas?.height,
    hasContext: !!canvas?.getContext('2d')
  };
});
console.log('Canvas info:', canvasData);

// Check characters
const charInfo = await page.evaluate(() => {
  return window.characters?.length || 'undefined';
});
console.log('Characters:', charInfo);

await browser.close();
console.log('Screenshot saved to playground-test.png');
