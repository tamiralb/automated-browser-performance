/**
 * Quick authentication check - verify if cookies are working
 * by checking for "No available coupons" message
 */

import { chromium, devices } from 'playwright'
import { loadCookiesFromFile, loadCookiesIntoContext } from '../lib/cookie-auth.js'

async function checkAuthentication(url: string, cookieFile: string) {
  console.log('\n🔐 Authentication Check\n')
  console.log(`URL: ${url}`)
  console.log(`Cookies: ${cookieFile}\n`)

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  })

  // Load cookies
  console.log('🍪 Loading cookies...')
  const cookies = loadCookiesFromFile(cookieFile)
  await loadCookiesIntoContext(context, cookies)
  console.log(`✅ Loaded ${cookies.length} cookies\n`)

  const page = await context.newPage()

  // Navigate to the page
  console.log('📄 Navigating to page...')
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(5000) // Wait for content to load

  // Check for authentication indicators
  console.log('\n🔍 Checking for authentication indicators...\n')

  // Check for "No available coupons" message (indicates auth failure)
  const noOffersMessage = await page.locator('text=No available coupons').count()
  const checkBackMessage = await page.locator('text=Check back later').count()

  // Check for sign-in button (indicates not logged in)
  const signInButton = await page.locator('text=Sign in').count()

  // Check for offers/coupons (indicates auth success)
  const offerCards = await page.locator('[data-testid*="offer"], [class*="offer"], [class*="coupon"]').count()

  console.log('Results:')
  console.log(`  "No available coupons" message: ${noOffersMessage > 0 ? '❌ FOUND (AUTH FAILED)' : '✅ Not found'}`)
  console.log(`  "Check back later" message: ${checkBackMessage > 0 ? '❌ FOUND (AUTH FAILED)' : '✅ Not found'}`)
  console.log(`  "Sign in" button: ${signInButton > 0 ? '⚠️  FOUND (Not logged in)' : '✅ Not found'}`)
  console.log(`  Offer/coupon elements: ${offerCards} ${offerCards > 0 ? '✅ (AUTH SUCCESS)' : '❌ (None found)'}`)

  console.log('\n📸 Taking screenshot for manual verification...')
  await page.screenshot({ path: './reports/auth-check-screenshot.png', fullPage: false })
  console.log('Screenshot saved: ./reports/auth-check-screenshot.png')

  // Final verdict
  console.log('\n' + '='.repeat(80))
  if (noOffersMessage > 0 || checkBackMessage > 0) {
    console.log('❌ AUTHENTICATION FAILED')
    console.log('   The page shows "No available coupons" - cookies are not working')
  } else if (signInButton > 0) {
    console.log('⚠️  NOT LOGGED IN')
    console.log('   The page shows "Sign in" button - cookies may be expired')
  } else if (offerCards > 0) {
    console.log('✅ AUTHENTICATION SUCCESS')
    console.log(`   Found ${offerCards} offer elements - cookies are working!`)
  } else {
    console.log('⚠️  UNCLEAR')
    console.log('   Could not determine auth status - check screenshot manually')
  }
  console.log('='.repeat(80) + '\n')

  // Keep browser open for 10 seconds so user can see
  console.log('Browser will stay open for 10 seconds for you to verify...')
  await page.waitForTimeout(10000)

  await browser.close()
}

// Run
const url = process.argv[2]
const cookieFile = process.argv[3]

if (!url || !cookieFile) {
  console.error('\n❌ Usage: tsx check-auth.ts <url> <cookie-file>\n')
  console.log('Example:')
  console.log('  tsx check-auth.ts https://shop.davisfoodanddrug.com/store/davis-food-drug/pages/in-store-deals cookies/davis.json\n')
  process.exit(1)
}

checkAuthentication(url, cookieFile).catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
