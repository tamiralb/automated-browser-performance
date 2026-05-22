/**
 * Clip all available coupons on a retailer's in-store deals page.
 *
 * Usage:
 *   npx tsx utils/clip-coupons.ts --retailer <id> [--headless]
 *
 * --retailer auto-derives cookies/<id>.json and reports/<id>-state.json.
 * Override with --cookies / --state.
 */

import type { Page } from 'playwright'
import {
  parseCli, openDealsPage, scrollForMore,
  loadState, saveState, type RunState,
} from '../lib/deals-automation.js'

async function clipAll(page: Page, state: RunState): Promise<void> {
  let round = 0
  while (true) {
    round++
    const clipButtons = page.locator('button').filter({ hasText: /^Clip$/ })
    const count = await clipButtons.count()
    console.log(`\n🔄 Round ${round}: ${count} "Clip" buttons available`)

    if (count === 0) {
      if (!await scrollForMore(page)) {
        console.log('\n✅ No more coupons — reached end of page.')
        return
      }
      continue
    }

    for (let i = 0; i < count; i++) {
      try {
        const btn = clipButtons.nth(i)
        if (!await btn.isVisible() || !await btn.isEnabled()) continue
        await btn.scrollIntoViewIfNeeded()
        await page.waitForTimeout(200)
        await btn.click()
        state.clippedCount++
        if (state.clippedCount % 25 === 0) {
          console.log(`   ✂️  Clipped ${state.clippedCount} coupons so far...`)
        }
        await page.waitForTimeout(500)
      } catch {
        // Button changed state mid-iteration; skip
      }
    }

    await page.mouse.wheel(0, 1500)
    await page.waitForTimeout(1500)
  }
}

async function main() {
  const opts = parseCli()
  const state = loadState(opts.stateFile)
  const startCount = state.clippedCount

  const { page, close } = await openDealsPage(opts)
  try {
    await clipAll(page, state)
    saveState(opts.stateFile, state)
    const added = state.clippedCount - startCount
    console.log(`\n🎉 [${opts.retailer.name}] Clipped ${added} coupons this run (${state.clippedCount} total).`)
    if (!opts.headless) {
      console.log('   Browser stays open 5s for verification...')
      await page.waitForTimeout(5000)
    }
  } finally {
    saveState(opts.stateFile, state)
    await close()
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message ?? err)
  process.exit(1)
})
