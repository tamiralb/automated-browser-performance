import { chromium, devices } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://www.instacart.com.test:8081'

/**
 * Basic performance test without authentication
 * Useful for testing public pages or when session is not required
 */
async function runBasicPerformanceTest() {
  console.log('🚀 Starting basic performance test (no auth)...\n')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  })

  const page = await context.newPage()

  console.log('📊 Measuring performance...')

  const startTime = Date.now()
  await page.goto(`${BASE_URL}/store`, {
    waitUntil: 'networkidle',
  })
  const loadTime = Date.now() - startTime

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const paint = performance.getEntriesByType('paint')

    return {
      htmlSize: nav.encodedBodySize || 0,
      scriptsCount: document.querySelectorAll('script').length,
      blockingScripts: document.querySelectorAll('script:not([async]):not([defer])').length,
      firstPaint: paint[0]?.startTime || 0,
      domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
    }
  })

  console.log('\n✅ Performance Results:')
  console.log(`   Load Time: ${loadTime}ms`)
  console.log(`   HTML Size: ${(metrics.htmlSize / 1024).toFixed(2)} KB`)
  console.log(`   Total Scripts: ${metrics.scriptsCount}`)
  console.log(`   Blocking Scripts: ${metrics.blockingScripts}`)
  console.log(`   First Paint: ${metrics.firstPaint.toFixed(0)}ms`)
  console.log(`   DOM Content Loaded: ${metrics.domContentLoaded}ms`)

  await browser.close()
}

runBasicPerformanceTest().catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
