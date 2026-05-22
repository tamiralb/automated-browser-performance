/**
 * For each clipped coupon on the retailer's in-store deals page:
 *   1. Click "Show items" to reveal the matching products
 *   2. Click "Add" on each product
 *
 * Usage:
 *   npx tsx utils/add-coupon-products.ts --retailer <id> [--headless]
 *
 * --retailer auto-derives cookies/<id>.json, reports/<id>-state.json,
 * and reports/<id>-added.csv. Override any with --cookies / --state / --report.
 */

import type { Page, Locator } from 'playwright'
import {
  parseCli, openDealsPage, scrollForMore,
  loadState, saveState, writeReport,
  type RunState, type AddedProduct, type SkippedCoupon,
} from '../lib/deals-automation.js'

/** Build a reasonably-unique label for a coupon by walking up the DOM. */
async function getCouponId(btn: Locator): Promise<string> {
  return btn.evaluate(el => {
    let node: Element | null = el
    for (let i = 0; i < 8; i++) {
      node = node?.parentElement || null
      if (!node) break
      const text = (node.textContent || '').trim()
      if (text.length > 15 && !text.startsWith('Show items')) {
        return text.slice(0, 100)
      }
    }
    return `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  })
}

async function processCoupon(
  page: Page,
  btn: Locator,
  state: RunState,
  stateFile: string | undefined,
  reportFile: string | undefined,
): Promise<{ added: number; couponId: string }> {
  await btn.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  const couponId = await getCouponId(btn)

  // Skip if already processed in a prior run
  if (state.processedCoupons.includes(couponId)) {
    await btn.evaluate(el => el.setAttribute('data-processed', 'true')).catch(() => {})
    return { added: 0, couponId }
  }

  console.log(`\n   🎫 #${state.processedCoupons.length + 1}: "${couponId.slice(0, 60)}"`)
  await btn.click()
  await page.waitForTimeout(2000)

  const addButtons = page.locator('button[aria-label^="Add"]')
  let addCount = await addButtons.count()
  if (addCount === 0) {
    await page.waitForTimeout(1500)
    addCount = await addButtons.count()
  }
  console.log(`      ${addCount} Add button(s) found`)

  let addedThisCoupon = 0
  for (let j = 0; j < addCount; j++) {
    const addBtn = addButtons.nth(j)
    if (!await addBtn.isVisible().catch(() => false)) continue

    const aria = (await addBtn.getAttribute('aria-label')) ?? ''
    await addBtn.scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    try {
      await addBtn.click()
    } catch {
      continue
    }
    const productName = aria.replace(/^Add (1 )?/, '')
    state.addedProducts.push({
      couponId,
      productName,
      ariaLabel: aria,
      addedAt: new Date().toISOString(),
    } satisfies AddedProduct)
    addedThisCoupon++
    console.log(`      ➕ ${productName}`)
    await page.waitForTimeout(400)

    const confirmBtn = page.locator('button').filter({ hasText: /^Confirm$|^Done$|^OK$/ }).first()
    if (await confirmBtn.isVisible({ timeout: 600 }).catch(() => false)) {
      await confirmBtn.click()
      await page.waitForTimeout(300)
    }
  }

  if (addedThisCoupon === 0) {
    state.skippedCoupons.push({
      couponId,
      reason: 'no-add-buttons',
      label: couponId,
      skippedAt: new Date().toISOString(),
    } satisfies SkippedCoupon)
  }

  state.processedCoupons.push(couponId)
  await btn.evaluate(el => el.setAttribute('data-processed', 'true')).catch(() => {})

  // Persist after every coupon — crash only loses the in-flight one
  saveState(stateFile, state)
  if (reportFile) writeReport(reportFile, state)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  console.log(`      ✅ +${addedThisCoupon} (run total: ${state.addedProducts.length})`)
  return { added: addedThisCoupon, couponId }
}

async function main() {
  const opts = parseCli()
  const state = loadState(opts.stateFile)
  const startAdded = state.addedProducts.length

  const { page, close } = await openDealsPage(opts)
  try {
    await page.mouse.wheel(0, 1200)
    await page.waitForTimeout(2000)

    let round = 0
    while (true) {
      round++
      const showButtons = page.locator('button:not([data-processed])').filter({ hasText: /^Show items$/ })
      const count = await showButtons.count()
      console.log(`\n🔄 Round ${round}: ${count} unprocessed "Show items" buttons`)

      if (count === 0) {
        if (!await scrollForMore(page)) {
          console.log('\n✅ Reached end of page — done!')
          break
        }
        continue
      }

      for (let i = 0; i < count; i++) {
        const btn = showButtons.nth(i)
        if (!await btn.isVisible().catch(() => false)) continue
        await processCoupon(page, btn, state, opts.stateFile, opts.reportFile)
      }
    }

    saveState(opts.stateFile, state)
    if (opts.reportFile) writeReport(opts.reportFile, state)
    const added = state.addedProducts.length - startAdded
    console.log(`\n🎉 [${opts.retailer.name}] Added ${added} products this run (${state.addedProducts.length} total across ${state.processedCoupons.length} coupons).`)
    if (state.skippedCoupons.length > 0) {
      console.log(`   ⚠️  ${state.skippedCoupons.length} coupons had no Add buttons (out-of-stock?)`)
    }
    if (!opts.headless) {
      console.log('   Browser stays open 10s for verification...')
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
