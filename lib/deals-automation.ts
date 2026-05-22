/**
 * Shared utilities for Lin's in-store deals automation
 * Used by clip-coupons.ts, add-coupon-products.ts, and deals-workflow.ts
 */

import { chromium, devices } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { SavedCookies, CookieData } from './cookie-auth.js'

export interface RetailerConfig {
  id: string
  name: string
  url: string
}

export interface CliOptions {
  retailer: RetailerConfig
  cookieFile: string
  headless: boolean
  stateFile?: string
  reportFile?: string
}

/** Look up a retailer by id from config/retailers.json. */
export function loadRetailer(id: string): RetailerConfig {
  const cfgPath = 'config/retailers.json'
  if (!existsSync(cfgPath)) {
    throw new Error(`Retailer config not found at ${cfgPath}`)
  }
  const data = JSON.parse(readFileSync(cfgPath, 'utf-8')) as { retailers: RetailerConfig[] }
  const match = data.retailers.find(r => r.id === id)
  if (!match) {
    const ids = data.retailers.map(r => r.id).join(', ')
    throw new Error(`Unknown retailer "${id}". Available: ${ids}`)
  }
  if (!match.url.includes('/pages/in-store-deals')) {
    throw new Error(`Retailer "${id}" has no in-store-deals URL`)
  }
  return match
}

/**
 * Parse common CLI flags. Either pass `--retailer <id>` (auto-derives paths),
 * or pass `--cookies` / `--state` / `--report` explicitly to override.
 */
export function parseCli(defaultRetailer = 'lins'): CliOptions {
  const argv = process.argv
  const find = (flag: string): string | undefined =>
    argv.find((_, i) => argv[i - 1] === flag)

  const retailerId = find('--retailer') ?? defaultRetailer
  const retailer = loadRetailer(retailerId)

  return {
    retailer,
    cookieFile: find('--cookies') ?? `cookies/${retailerId}.json`,
    stateFile: find('--state') ?? `reports/${retailerId}-state.json`,
    reportFile: find('--report') ?? `reports/${retailerId}-added.csv`,
    headless: argv.includes('--headless'),
  }
}

/** Load cookies and validate file shape; throw a helpful error otherwise. */
export function loadCookies(filePath: string): CookieData[] {
  if (!existsSync(filePath)) {
    throw new Error(
      `Cookie file not found: ${filePath}\n` +
      `   Run: npx tsx utils/save-cookies.ts <url> ${filePath} --auto`
    )
  }
  const raw = readFileSync(filePath, 'utf-8')
  let parsed: SavedCookies | CookieData[]
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Cookie file ${filePath} is not valid JSON`)
  }
  const cookies = Array.isArray(parsed) ? parsed : parsed.cookies
  if (!Array.isArray(cookies) || cookies.length === 0) {
    throw new Error(`Cookie file ${filePath} contains no cookies`)
  }
  return cookies
}

/**
 * Quick freshness check: do any expirable cookies look stale?
 * Returns null if cookies look fine, or a warning message if they look expired.
 */
export function checkCookieFreshness(cookies: CookieData[]): string | null {
  const now = Math.floor(Date.now() / 1000)
  const sessionCookies = cookies.filter(c => c.expires && c.expires > 0)
  if (sessionCookies.length === 0) return null

  const expired = sessionCookies.filter(c => c.expires! < now)
  const expiringSoon = sessionCookies.filter(c => c.expires! >= now && c.expires! < now + 60 * 60)

  if (expired.length === sessionCookies.length) {
    return `⚠️  All ${expired.length} expirable cookies have expired — login likely required`
  }
  if (expired.length > 0) {
    return `⚠️  ${expired.length}/${sessionCookies.length} cookies expired (e.g. ${expired[0].name})`
  }
  if (expiringSoon.length > 0) {
    return `⚠️  ${expiringSoon.length} cookies expire within 1 hour`
  }
  return null
}

/**
 * Launch browser, load cookies, navigate to deals page, verify login.
 * Returns the page and a cleanup function.
 */
export async function openDealsPage(opts: CliOptions): Promise<{
  browser: Browser
  context: BrowserContext
  page: Page
  close: () => Promise<void>
}> {
  const cookies = loadCookies(opts.cookieFile)
  const warning = checkCookieFreshness(cookies)
  if (warning) console.log(warning)

  const browser = await chromium.launch({
    headless: opts.headless,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  })
  await context.addCookies(cookies)
  const page = await context.newPage()

  console.log(`\n🛒 [${opts.retailer.name}] navigating to in-store deals (${opts.headless ? 'headless' : 'headed'})...`)
  await page.goto(opts.retailer.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3000)

  if (page.url().includes('login') || page.url().includes('sso')) {
    await browser.close()
    throw new Error(
      `Redirected to login — cookies may be expired.\n` +
      `   Re-run: npx tsx utils/save-cookies.ts ${opts.retailer.url} ${opts.cookieFile} --auto`
    )
  }
  console.log('✅ Logged in\n')

  // Dismiss any opening overlay
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(800)

  return {
    browser,
    context,
    page,
    close: async () => {
      await browser.close().catch(() => {})
    },
  }
}

/** Scroll until window.scrollY stops growing. Returns whether more was loaded. */
export async function scrollForMore(page: Page, distance = 2000): Promise<boolean> {
  const prev = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, distance)
  await page.waitForTimeout(2000)
  const next = await page.evaluate(() => window.scrollY)
  return next !== prev
}

// ────────────────────────────────────────────────────────────────────────────
// Persistent run state — resume after crash
// ────────────────────────────────────────────────────────────────────────────

export interface RunState {
  startedAt: string
  updatedAt: string
  clippedCount: number
  processedCoupons: string[]     // stable IDs of coupons whose products were added
  addedProducts: AddedProduct[]
  skippedCoupons: SkippedCoupon[]
}

export interface AddedProduct {
  couponId: string
  productName: string
  ariaLabel: string
  addedAt: string
}

export interface SkippedCoupon {
  couponId: string
  reason: 'no-add-buttons' | 'click-failed' | 'unknown'
  label: string
  skippedAt: string
}

const EMPTY_STATE: Omit<RunState, 'startedAt' | 'updatedAt'> = {
  clippedCount: 0,
  processedCoupons: [],
  addedProducts: [],
  skippedCoupons: [],
}

export function loadState(filePath: string | undefined): RunState {
  if (!filePath || !existsSync(filePath)) {
    const now = new Date().toISOString()
    return { startedAt: now, updatedAt: now, ...EMPTY_STATE, processedCoupons: [], addedProducts: [], skippedCoupons: [] }
  }
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as RunState
    console.log(`📂 Resuming from ${filePath}: ${data.processedCoupons.length} coupons already processed`)
    return data
  } catch {
    console.log(`⚠️  Could not parse ${filePath}, starting fresh`)
    const now = new Date().toISOString()
    return { startedAt: now, updatedAt: now, ...EMPTY_STATE, processedCoupons: [], addedProducts: [], skippedCoupons: [] }
  }
}

export function saveState(filePath: string | undefined, state: RunState): void {
  if (!filePath) return
  state.updatedAt = new Date().toISOString()
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8')
}

/** Write a CSV report next to the state file. */
export function writeReport(reportPath: string, state: RunState): void {
  mkdirSync(dirname(reportPath), { recursive: true })
  const lines = [
    'couponId,productName,ariaLabel,addedAt',
    ...state.addedProducts.map(p =>
      [p.couponId, p.productName, p.ariaLabel, p.addedAt]
        .map(v => `"${(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ),
  ]
  writeFileSync(reportPath, lines.join('\n'), 'utf-8')
  console.log(`📝 Wrote ${state.addedProducts.length} rows to ${reportPath}`)
}
