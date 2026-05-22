/**
 * End-to-end Lin's deals workflow: clip every available coupon, then add every
 * matching product to cart — in a single browser session.
 *
 * Usage:
 *   npx tsx utils/deals-workflow.ts [--cookies cookies/lins.json] [--headless] [--state reports/lins-state.json] [--report reports/lins-added.csv] [--skip-clip] [--skip-add]
 */

import type { Page, Locator } from 'playwright'
import {
  parseCli, openDealsPage, scrollForMore,
  loadState, saveState, writeReport,
  type RunState, type AddedProduct, type SkippedCoupon,
} from '../lib/deals-automation.js'

const skipClip = process.argv.includes('--skip-clip')
const skipAdd = process.argv.includes('--skip-add')

async function clipPhase(page: Page, state: RunState): Promise<void> {
  console.log('\n━━━ Phase 1: clipping coupons ━━━')
  let round = 0
  while (true) {
    round++
    const clipButtons = page.locator('button').filter({ hasText: /^Clip$/ })
    const count = await clipButtons.count()
    console.log(`Round ${round}: ${count} unclipped coupons`)
    if (count === 0) {
      if (!await scrollForMore(page)) break
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
        await page.waitForTimeout(500)
      } catch { /* skip */ }
    }
    await page.mouse.wheel(0, 1500)
    await page.waitForTimeout(1500)
  }
  console.log(`✅ Clipped ${state.clippedCount} total`)
}

async function getCouponId(btn: Locator): Promise<string> {
  return btn.evaluate(el => {
    let node: Element | null = el
    for (let i = 0; i < 8; i++) {
      node = node?.parentElement || null
      if (!node) break
      const text = (node.textContent || '').trim()
      if (text.length > 15 && !text.startsWith('Show items')) return text.slice(0, 100)
    }
    return `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  })
}

async function addPhase(
  page: Page,
  state: RunState,
  stateFile: string | undefined,
  reportPath: string | undefined,
): Promise<void> {
  console.log('\n━━━ Phase 2: adding products ━━━')

  // Reload to refresh the DOM after clipping (coupon cards now show "Show items")
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await page.keyboard.press('Escape').catch(() => {})
  await page.mouse.wheel(0, 1200)
  await page.waitForTimeout(2000)

  let round = 0
  while (true) {
    round++
    const showButtons = page.locator('button:not([data-processed])').filter({ hasText: /^Show items$/ })
    const count = await showButtons.count()
    console.log(`Round ${round}: ${count} unprocessed`)
    if (count === 0) {
      if (!await scrollForMore(page)) break
      continue
    }
    for (let i = 0; i < count; i++) {
      const btn = showButtons.nth(i)
      if (!await btn.isVisible().catch(() => false)) continue
      await btn.scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)

      const couponId = await getCouponId(btn)
      if (state.processedCoupons.includes(couponId)) {
        await btn.evaluate(el => el.setAttribute('data-processed', 'true')).catch(() => {})
        continue
      }

      console.log(`  🎫 ${couponId.slice(0, 60)}`)
      await btn.click()
      await page.waitForTimeout(2000)

      const addButtons = page.locator('button[aria-label^="Add"]')
      let addCount = await addButtons.count()
      if (addCount === 0) { await page.waitForTimeout(1500); addCount = await addButtons.count() }

      let addedHere = 0
      for (let j = 0; j < addCount; j++) {
        const addBtn = addButtons.nth(j)
        if (!await addBtn.isVisible().catch(() => false)) continue
        const aria = (await addBtn.getAttribute('aria-label')) ?? ''
        await addBtn.scrollIntoViewIfNeeded()
        await page.waitForTimeout(150)
        try { await addBtn.click() } catch { continue }
        const productName = aria.replace(/^Add (1 )?/, '')
        state.addedProducts.push({
          couponId, productName, ariaLabel: aria, addedAt: new Date().toISOString(),
        } satisfies AddedProduct)
        addedHere++
        await page.waitForTimeout(400)
        const confirmBtn = page.locator('button').filter({ hasText: /^Confirm$|^Done$|^OK$/ }).first()
        if (await confirmBtn.isVisible({ timeout: 600 }).catch(() => false)) {
          await confirmBtn.click()
          await page.waitForTimeout(300)
        }
      }

      if (addedHere === 0) {
        state.skippedCoupons.push({
          couponId, reason: 'no-add-buttons', label: couponId, skippedAt: new Date().toISOString(),
        } satisfies SkippedCoupon)
      }
      state.processedCoupons.push(couponId)
      await btn.evaluate(el => el.setAttribute('data-processed', 'true')).catch(() => {})
      saveState(stateFile, state)
      if (reportPath) writeReport(reportPath, state)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
      console.log(`     +${addedHere} (total ${state.addedProducts.length})`)
    }
  }
}

async function main() {
  const opts = parseCli()
  const state = loadState(opts.stateFile)
  const startClipped = state.clippedCount
  const startAdded = state.addedProducts.length

  const { page, close } = await openDealsPage(opts)
  try {
    if (!skipClip) await clipPhase(page, state)
    saveState(opts.stateFile, state)
    if (!skipAdd) await addPhase(page, state, opts.stateFile, opts.reportFile)

    saveState(opts.stateFile, state)
    if (opts.reportFile) writeReport(opts.reportFile, state)

    console.log(`\n━━━ [${opts.retailer.name}] Summary ━━━`)
    console.log(`  Clipped:  +${state.clippedCount - startClipped} (total ${state.clippedCount})`)
    console.log(`  Added:    +${state.addedProducts.length - startAdded} (total ${state.addedProducts.length})`)
    console.log(`  Coupons processed: ${state.processedCoupons.length}`)
    if (state.skippedCoupons.length > 0) {
      console.log(`  Skipped (no Add buttons): ${state.skippedCoupons.length}`)
    }
    if (!opts.headless) {
      console.log('\n   Browser stays open 10s for verification...')
      await page.waitForTimeout(10000)
    }
  } finally {
    saveState(opts.stateFile, state)
    if (opts.reportFile) writeReport(opts.reportFile, state)
    await close()
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message ?? err)
  process.exit(1)
})
