#!/usr/bin/env node
// Browser smoke test for the OpenCloud integration of src/App.vue.
//
// Prerequisites: `pnpm exec vite --config vite.harness.config.ts` (port 5199)
// and a Chromium binary (defaults to the Playwright-managed install).
//
// Usage: node test/harness/run-harness.mjs [scenario|all]
//   existing  file content is present before the editor mounts (regular open)
//   late      file content arrives after the editor mounted
//   empty     newly created file without content (starter project expected)
//   probe     raw Blockly load matrix, no assertions
import {chromium} from 'playwright-core';

const EXPECTATIONS = {
  existing: {
    projectName: 'Pumpenhaus',
    blockCountText: '5 Blöcke',
    emittedCount: 0,
    codeIncludes: ['pumpensteuerung_cycle', 'lueftersteuerung_cycle'],
  },
  late: {
    projectName: 'Pumpenhaus',
    blockCountText: '5 Blöcke',
    emittedCount: 0,
    codeIncludes: ['pumpensteuerung_cycle', 'lueftersteuerung_cycle'],
  },
  empty: {
    projectName: 'pumpenhaus',
    blockCountText: '10 Blöcke',
    emittedCount: 1,
    codeIncludes: ['anlagenstatus_cycle'],
  },
};

const requested = process.argv[2] ?? 'all';
const scenarios = requested === 'all' ? Object.keys(EXPECTATIONS) : [requested];

const browser = await chromium.launch({
  executablePath: process.env.HARNESS_CHROMIUM ?? '/opt/pw-browsers/chromium',
});

let failures = 0;

for (const scenario of scenarios) {
  const page = await browser.newPage();
  const consoleLines = [];
  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err.message}`));

  await page.goto(`http://localhost:5199/?scenario=${scenario}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(2500);

  const result = await page.evaluate(() => {
    const harness = window.__harness;
    return {
      scenario: harness.scenario,
      title: document.title,
      projectName: document.querySelector('.project-name input')?.value ?? null,
      blockCountText:
        document.querySelector('.statusbar span:last-child')?.textContent ?? null,
      code: document.querySelector('.code-wrap code')?.textContent ?? null,
      emittedCount: harness.emitted.length,
      lastEmittedPreview: harness.emitted.length
        ? harness.emitted[harness.emitted.length - 1].slice(0, 200)
        : null,
      log: harness.errors,
    };
  });
  await page.close();

  console.log(JSON.stringify({...result, code: result.code?.slice(0, 300)}, null, 2));

  const expected = EXPECTATIONS[scenario];
  if (!expected) continue;

  const problems = [];
  if (result.projectName !== expected.projectName) {
    problems.push(`projectName: expected ${expected.projectName}, got ${result.projectName}`);
  }
  if (result.blockCountText !== expected.blockCountText) {
    problems.push(
      `blockCountText: expected ${expected.blockCountText}, got ${result.blockCountText}`,
    );
  }
  if (result.emittedCount !== expected.emittedCount) {
    problems.push(`emittedCount: expected ${expected.emittedCount}, got ${result.emittedCount}`);
  }
  for (const needle of expected.codeIncludes) {
    if (!result.code?.includes(needle)) {
      problems.push(`generated code is missing "${needle}"`);
    }
  }

  if (problems.length) {
    failures += 1;
    console.error(`✗ ${scenario}\n  ${problems.join('\n  ')}`);
    console.error(consoleLines.join('\n'));
  } else {
    console.log(`✓ ${scenario}`);
  }
}

await browser.close();
process.exit(failures ? 1 : 0);
