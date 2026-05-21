/**
 * Volume/Soak Test - Multiple browsers hitting the same endpoint
 *
 * Usage:
 *   tsx volume-test.ts <url> --cookies <cookie-file> --browsers 10 --duration 60
 */

import { chromium, devices, Browser, BrowserContext, Page } from 'playwright'
import { loadCookiesFromFile, loadCookiesIntoContext } from '../lib/cookie-auth.js'

interface GraphQLOperation {
  operationName: string
  duration: number
  size: number
  timestamp: number
  browserIndex: number
}

interface VolumeTestConfig {
  url: string
  cookieFile: string
  browserCount: number
  refreshInterval: number // seconds
  duration: number // seconds (0 = infinite)
}

const operations: GraphQLOperation[] = []
let totalRequests = 0
let findOffersCount = 0

async function runBrowser(
  config: VolumeTestConfig,
  browserIndex: number,
  startTime: number
): Promise<void> {
  console.log(`🌐 [Browser ${browserIndex}] Starting...`)

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  })

  // Load cookies
  if (config.cookieFile) {
    const cookies = loadCookiesFromFile(config.cookieFile)
    await loadCookiesIntoContext(context, cookies)
  }

  const page = await context.newPage()

  // Intercept GraphQL requests
  await page.route('**/graphql**', async (route) => {
    const request = route.request()
    const startTime = Date.now()

    try {
      const response = await route.fetch()
      const endTime = Date.now()
      const duration = endTime - startTime

      // Try to extract operation name from request
      let operationName = 'unknown'
      try {
        const postData = request.postData()
        if (postData) {
          const body = JSON.parse(postData)
          operationName = body.operationName || body.operation || 'unknown'
        }

        // Try to extract from URL
        if (operationName === 'unknown') {
          const url = request.url()
          const match = url.match(/operationName=([^&]+)/)
          if (match) {
            operationName = match[1]
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }

      totalRequests++

      // Only track FindOffersForUserV2
      if (operationName === 'FindOffersForUserV2') {
        const body = await response.body()
        const size = body.length / 1024 // KB

        operations.push({
          operationName,
          duration,
          size,
          timestamp: Date.now(),
          browserIndex,
        })

        findOffersCount++
        console.log(`  📡 [Browser ${browserIndex}] FindOffersForUserV2: ${duration}ms (${size.toFixed(2)} KB)`)
      }

      await route.fulfill({ response })
    } catch (error) {
      await route.continue()
    }
  })

  // Navigate and refresh loop
  const endTime = config.duration > 0 ? startTime + (config.duration * 1000) : Number.MAX_SAFE_INTEGER

  while (Date.now() < endTime) {
    try {
      console.log(`  🔄 [Browser ${browserIndex}] Loading page...`)
      await page.goto(config.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })

      // Wait for refresh interval
      await page.waitForTimeout(config.refreshInterval * 1000)

      // Check if we should continue
      if (Date.now() >= endTime && config.duration > 0) {
        break
      }
    } catch (error) {
      console.error(`  ❌ [Browser ${browserIndex}] Error:`, error.message)
      // Continue even if there's an error
      await page.waitForTimeout(config.refreshInterval * 1000)
    }
  }

  console.log(`✅ [Browser ${browserIndex}] Test complete`)
  await browser.close()
}

async function runVolumeTest(config: VolumeTestConfig): Promise<void> {
  console.log('\n' + '='.repeat(80))
  console.log('🚀 VOLUME / SOAK TEST - FindOffersForUserV2 Only')
  console.log('='.repeat(80))
  console.log(`URL: ${config.url}`)
  console.log(`Cookies: ${config.cookieFile || 'None'}`)
  console.log(`Browsers: ${config.browserCount}`)
  console.log(`Refresh Interval: ${config.refreshInterval}s`)
  console.log(`Duration: ${config.duration > 0 ? config.duration + 's' : 'Infinite (Ctrl+C to stop)'}`)
  console.log(`Tracking: FindOffersForUserV2 operations only`)
  console.log('='.repeat(80) + '\n')

  const startTime = Date.now()

  // Launch all browsers in parallel
  const browserPromises = []
  for (let i = 1; i <= config.browserCount; i++) {
    browserPromises.push(runBrowser(config, i, startTime))
  }

  // Run stats reporter in background
  const statsInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    const avgDuration = operations.length > 0
      ? operations.reduce((sum, op) => sum + op.duration, 0) / operations.length
      : 0

    console.log(`\n📊 [${elapsed}s] Total Requests: ${totalRequests} | FindOffersForUserV2: ${findOffersCount} | Avg: ${avgDuration.toFixed(0)}ms`)
  }, 5000)

  // Wait for all browsers to complete
  await Promise.all(browserPromises)

  clearInterval(statsInterval)

  // Final report
  const endTime = Date.now()
  const totalDuration = (endTime - startTime) / 1000

  console.log('\n' + '='.repeat(80))
  console.log('📊 FINAL RESULTS - FindOffersForUserV2 Only')
  console.log('='.repeat(80))
  console.log(`Total Duration: ${totalDuration.toFixed(1)}s`)
  console.log(`Total GraphQL Requests: ${totalRequests}`)
  console.log(`FindOffersForUserV2 Calls Tracked: ${findOffersCount}`)

  // FindOffersForUserV2 statistics
  if (operations.length > 0) {
    const durations = operations.map(op => op.duration).sort((a, b) => a - b)
    const sizes = operations.map(op => op.size)
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
    const avgSize = sizes.reduce((sum, s) => sum + s, 0) / sizes.length
    const minDuration = Math.min(...durations)
    const maxDuration = Math.max(...durations)
    const p50 = durations[Math.floor(durations.length * 0.5)]
    const p95 = durations[Math.floor(durations.length * 0.95)]
    const p99 = durations[Math.floor(durations.length * 0.99)]

    console.log('\nFindOffersForUserV2 Performance:')
    console.log(`  Count: ${operations.length}`)
    console.log(`  Average: ${avgDuration.toFixed(0)}ms (${avgSize.toFixed(2)} KB)`)
    console.log(`  Min: ${minDuration}ms`)
    console.log(`  Max: ${maxDuration}ms`)
    console.log(`  P50 (median): ${p50}ms`)
    console.log(`  P95: ${p95}ms`)
    console.log(`  P99: ${p99}ms`)

    // Top 10 slowest FindOffersForUserV2 calls
    const sortedOps = [...operations].sort((a, b) => b.duration - a.duration).slice(0, 10)
    console.log('\nTop 10 Slowest FindOffersForUserV2 Calls:')
    sortedOps.forEach((op, i) => {
      console.log(`  ${i + 1}. ${op.duration}ms (${op.size.toFixed(2)} KB) - Browser ${op.browserIndex}`)
    })
  } else {
    console.log('\n⚠️  No FindOffersForUserV2 calls were detected during the test.')
  }

  console.log('\n' + '='.repeat(80))
}

// Parse command line arguments
async function main() {
  const args = process.argv.slice(2)

  let url = args[0]
  let cookieFile: string | undefined
  let browserCount = 10
  let refreshInterval = 10 // seconds
  let duration = 60 // seconds (0 = infinite)

  // Parse flags
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cookies' && i + 1 < args.length) {
      cookieFile = args[i + 1]
    } else if (args[i] === '--browsers' && i + 1 < args.length) {
      browserCount = parseInt(args[i + 1])
    } else if (args[i] === '--refresh' && i + 1 < args.length) {
      refreshInterval = parseInt(args[i + 1])
    } else if (args[i] === '--duration' && i + 1 < args.length) {
      duration = parseInt(args[i + 1])
    }
  }

  if (!url) {
    console.error('\n❌ Error: Please specify a URL\n')
    console.log('Usage:')
    console.log('  tsx volume-test.ts <url> [options]')
    console.log('\nOptions:')
    console.log('  --cookies <file>        Cookie file for authentication')
    console.log('  --browsers <number>     Number of concurrent browsers (default: 10)')
    console.log('  --refresh <seconds>     Refresh interval in seconds (default: 10)')
    console.log('  --duration <seconds>    Test duration in seconds (default: 60, 0 = infinite)')
    console.log('\nExamples:')
    console.log('  tsx volume-test.ts https://shop.davisfoodanddrug.com/store/davis-food-drug/pages/in-store-deals --cookies cookies/davis.json --browsers 15 --refresh 10 --duration 120')
    console.log('  tsx volume-test.ts https://shop.davisfoodanddrug.com/store/davis-food-drug/pages/in-store-deals --browsers 5 --refresh 5 --duration 0  # Infinite')
    console.log('')
    process.exit(1)
  }

  const config: VolumeTestConfig = {
    url,
    cookieFile: cookieFile || '',
    browserCount,
    refreshInterval,
    duration,
  }

  await runVolumeTest(config)
}

main().catch(error => {
  console.error('❌ Test error:', error)
  process.exit(1)
})
