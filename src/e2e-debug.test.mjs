import { chromium } from 'file:///C:/Users/rodri/.vscode/extensions/danielsanmedium.dscodegpt-3.24.75/standalone/node_modules/patchright/index.mjs';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const log = (...a) => console.log(...a);
const getState = async () => (await (await fetch('http://localhost:3000/api/state')).json());

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const A = await browser.newPage();
try {
  await A.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await A.waitForTimeout(1500);
  await A.locator('#login-email').fill('ctrodriguez2@up.edu.ph');
  await A.locator('#login-pin').fill('K9mP2x7R');
  await A.getByRole('button', { name: /log ?in/i }).first().click();
  await A.waitForTimeout(4000);

  const MARK = 'E2E-MODAL-' + Date.now();
  await A.getByRole('button', { name: /create new assignment/i }).first().click();
  await A.waitForTimeout(1200);
  await A.locator('input[placeholder*="Photo Essay"]').first().fill(MARK);
  await A.getByRole('button', { name: /issue layout assignment card/i }).first().click({ timeout: 10000 });
  await A.waitForTimeout(3500);

  const t = (await getState()).tasks.find((x) => x.title === MARK);
  log('task id:', t?.id);

  const h4s = A.locator('h4', { hasText: MARK });
  log('h4 matches:', await h4s.count());
  await h4s.first().click();
  await A.waitForTimeout(2500);

  const probe = await A.evaluate(() => ({
    hasStatusLabel: Array.from(document.querySelectorAll('label')).some((l) => l.innerText.trim() === 'Status'),
    hasArchived: Array.from(document.querySelectorAll('option')).some((o) => o.value === 'Archived'),
    overlays: document.querySelectorAll('.fixed.inset-0').length,
    bodyTail: document.body.innerText.slice(-300).replace(/\s+/g, ' '),
  }));
  console.log('MODAL PROBE:', JSON.stringify(probe, null, 1));
} catch (e) {
  log('ERROR:', e.message);
} finally {
  await browser.close();
}
