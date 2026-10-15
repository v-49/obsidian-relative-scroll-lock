const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19235');
  const page = browser.contexts()[0].pages().find(page => page.url().startsWith('app://obsidian.md/'));
  assert.ok(page, 'isolated Obsidian test vault must be running');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const settle = () => page.waitForTimeout(180);
  const positions = () => page.evaluate(() => app.workspace.getLeavesOfType('markdown').map(leaf => {
    const plugin = app.plugins.plugins['relative-scroll-lock'];
    return plugin.scroller(leaf.view).scrollTop;
  }));
  const move = async (index, delta) => {
    await page.evaluate(({ index, delta }) => {
      const plugin = app.plugins.plugins['relative-scroll-lock'];
      plugin.scroller(app.workspace.getLeavesOfType('markdown')[index].view).scrollTop += delta;
    }, { index, delta });
    await settle();
  };
  const near = (value, expected, label) => assert.ok(Math.abs(value - expected) <= 2, `${label}: ${value} vs ${expected}`);
  const results = [];
  for (const modes of [['source', 'source'], ['preview', 'preview'], ['source', 'preview']]) {
    console.log('Testing', modes.join('/'));
    await page.evaluate(async modes => {
      const plugin = app.plugins.plugins['relative-scroll-lock'];
      plugin.unlock();
      const leaves = app.workspace.getLeavesOfType('markdown');
      for (let index = 0; index < 2; index++) {
        await leaves[index].setViewState({ type: 'markdown', state: { file: '对照测试.md', mode: modes[index], source: false } });
      }
    }, modes);
    await page.waitForFunction(() => {
      const plugin = app.plugins.plugins['relative-scroll-lock'];
      return app.workspace.getLeavesOfType('markdown').every(leaf => plugin.scroller(leaf.view)?.scrollHeight > 10000);
    });
    await page.waitForTimeout(750);
    await page.evaluate(() => {
      const plugin = app.plugins.plugins['relative-scroll-lock'];
      app.workspace.getLeavesOfType('markdown').forEach((leaf, index) => {
        plugin.scroller(leaf.view).scrollTop = index ? 4200 : 1200;
      });
    });
    await settle();
    const beforeLock = await positions();
    console.log('before lock', beforeLock);
    await page.locator('.relative-scroll-lock-status').click();
    await settle();
    const afterLock = await positions();
    near(afterLock[0], beforeLock[0], 'locking left must not jump');
    near(afterLock[1], beforeLock[1], 'locking right must not jump');
    await move(0, 200);
    const afterForward = await positions();
    near(afterForward[1] - afterLock[1], afterForward[0] - afterLock[0], 'forward equal pixel delta');
    await move(1, -120);
    const afterReverse = await positions();
    near(afterReverse[0] - afterForward[0], afterReverse[1] - afterForward[1], 'reverse equal pixel delta');
    await page.locator('.relative-scroll-lock-status').click();
    await move(1, 350);
    const adjusted = await positions();
    near(adjusted[0], afterReverse[0], 'unlocked left stays put');
    await page.locator('.relative-scroll-lock-status').click();
    await settle();
    const relocked = await positions();
    near(relocked[0], adjusted[0], 'relocking left must not jump');
    near(relocked[1], adjusted[1], 'relocking right must not jump');
    await page.keyboard.down('Alt');
    await move(0, 150);
    const independent = await positions();
    near(independent[1], relocked[1], 'Alt leaves the other pane alone');
    await page.keyboard.up('Alt');
    await move(0, 100);
    const resumed = await positions();
    near(resumed[1] - independent[1], resumed[0] - independent[0], 'Alt release resumes at new offset');
    results.push({ modes, beforeLock, afterLock, relocked, resumed, passed: true });
  }
  // Actual wheel input, rather than only setting scrollTop.
  const bounds = await page.locator('.workspace-leaf.mod-active .cm-scroller').first().boundingBox();
  const source = bounds || await page.locator('.cm-scroller').first().boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  const beforeWheel = await positions();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(500);
  const afterWheel = await positions();
  near(afterWheel[0] - beforeWheel[0], afterWheel[1] - beforeWheel[1], 'real mouse wheel synchronizes');
  assert.ok(Math.abs(afterWheel[0] - beforeWheel[0]) > 20, 'mouse wheel actually moved');
  await page.evaluate(() => app.commands.executeCommandById('relative-scroll-lock:toggle'));
  assert.equal(await page.locator('.relative-scroll-lock-status').getAttribute('aria-pressed'), 'false');
  await page.evaluate(() => app.commands.executeCommandById('relative-scroll-lock:toggle'));
  assert.equal(await page.locator('.relative-scroll-lock-status').getAttribute('aria-pressed'), 'true');
  const output = path.resolve('test-results');
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'obsidian-scroll-lock.png') });
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'obsidian-e2e.json'), JSON.stringify({ app: await page.title(), results, beforeWheel, afterWheel, errors, passed: true }, null, 2));
  console.log(JSON.stringify({ app: await page.title(), scenarios: results.length, mouseWheel: true, command: true, errors, passed: true }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
