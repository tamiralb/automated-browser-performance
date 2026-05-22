/**
 * Save authentication cookies for later use
 *
 * Usage:
 *   npx tsx save-cookies.ts <url> <output-file>
 *   npx tsx save-cookies.ts https://shop.davisfoodanddrug.com davis-cookies.json
 *
 * This will:
 * 1. Open a browser to the URL
 * 2. Wait for you to log in manually
 * 3. Save all cookies to the specified file
 * 4. You can then use these cookies in tests with --cookies flag
 */

import { chromium, devices } from 'playwright'
import * as readline from 'readline'
import { saveCookiesToFile, extractCookies } from '../lib/cookie-auth.js'

async function waitForUser(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question('Press ENTER when you are logged in: ', () => {
      rl.close()
      resolve()
    })
  })
}

async function saveCookies(url: string, outputFile: string, auto: boolean = false) {
  console.log('\n🔐 Cookie Saver\n')
  console.log(`URL: ${url}`)
  console.log(`Output: ${outputFile}\n`)

  // Launch browser
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  })

  const page = await context.newPage()

  console.log('📊 Opening browser...')
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

  console.log('')
  console.log('='.repeat(80))
  console.log('🔐 PLEASE LOG IN')
  console.log('='.repeat(80))
  console.log('')
  console.log('A browser window has opened. Please:')
  console.log('  1. Click "Sign In" and log in with your credentials')
  console.log('  2. Wait until you are fully logged in')
  console.log('  3. Verify you can see your account name')
  if (auto) {
    console.log('  4. Close the browser window when done')
    console.log('')
    console.log('⏳ Waiting for you to close the browser...')
  } else {
    console.log('  4. Come back to this terminal')
    console.log('  5. Press ENTER')
    console.log('')
    console.log('⏳ Waiting for you to log in...')
  }
  console.log('='.repeat(80))
  console.log('')

  if (auto) {
    // Poll cookies every 2s so we have them captured before browser closes
    let lastCookies: any[] = []
    const pollInterval = setInterval(async () => {
      try {
        lastCookies = await context.cookies()
      } catch {
        clearInterval(pollInterval)
      }
    }, 2000)

    await new Promise<void>(resolve => browser.once('disconnected', resolve))
    clearInterval(pollInterval)

    console.log('\n✅ Browser closed. Saving cookies...')
    const cookieCount = lastCookies.length
    console.log(`📊 Found ${cookieCount} cookies`)
    console.log('')
    console.log('Cookies found:')
    lastCookies.forEach((cookie: any, i: number) => {
      console.log(`  ${i + 1}. ${cookie.name} (domain: ${cookie.domain})`)
    })
    console.log('')
    saveCookiesToFile(lastCookies as any, outputFile, url, `Saved from manual login at ${url}`)
    console.log('')
    console.log('✅ Cookies saved successfully!')
    console.log('')
    console.log('You can now use these cookies in tests:')
    console.log(`  npm run test:retailer:cookies lins -- --cookies ${outputFile}`)
    console.log(`  npm run test:graphql -- <url> --cookies ${outputFile}`)
    console.log('')
    return
  }

  await waitForUser()

  console.log('\n✅ Extracting cookies...')
  const cookies = await extractCookies(context)

  console.log(`📊 Found ${cookies.length} cookies`)
  console.log('')

  // Show cookie names
  console.log('Cookies found:')
  cookies.forEach((cookie, i) => {
    console.log(`  ${i + 1}. ${cookie.name} (domain: ${cookie.domain})`)
  })
  console.log('')

  // Save to file
  saveCookiesToFile(cookies, outputFile, url, `Saved from manual login at ${url}`)

  console.log('')
  console.log('✅ Cookies saved successfully!')
  console.log('')
  console.log('You can now use these cookies in tests:')
  console.log(`  npx tsx test-retailer.ts <retailer-id> --cookies ${outputFile}`)
  console.log(`  npx tsx graphql-test.ts <url> --cookies ${outputFile}`)
  console.log('')

  await browser.close()
}

async function main() {
  const args = process.argv.slice(2)
  const auto = args.includes('--auto')
  const positional = args.filter(a => !a.startsWith('--'))
  const url = positional[0]
  const outputFile = positional[1]

  if (!url || !outputFile) {
    console.error('\n❌ Error: Missing arguments\n')
    console.log('Usage:')
    console.log('  npx tsx save-cookies.ts <url> <output-file> [--auto]')
    console.log('')
    console.log('Examples:')
    console.log('  npx tsx save-cookies.ts https://shop.davisfoodanddrug.com davis-cookies.json')
    console.log('  npx tsx save-cookies.ts https://shop.linsgrocery.com cookies/lins.json --auto')
    console.log('')
    process.exit(1)
  }

  await saveCookies(url, outputFile, auto)
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
