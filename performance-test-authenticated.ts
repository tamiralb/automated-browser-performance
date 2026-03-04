import { chromium, devices } from 'playwright'
import { loginToInstacart, BASE_URL } from './auth.js'

interface PerformanceMetrics {
  htmlSize: number
  htmlSizeUncompressed: number
  compressionRatio: number
  scriptsCount: number
  blockingScripts: number
  firstPaint: number
  domContentLoaded: number
  loadComplete: number
}

async function runAuthenticatedPerformanceTest() {
  console.log('🚀 Starting authenticated performance test...\n')

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  })

  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  })

  const page = await context.newPage()

  // Step 1: Login
  await loginToInstacart(page)
  console.log('')

  // Step 2: Clear performance data and measure fresh load
  console.log('📊 Measuring performance (cold start)...')

  const startTime = Date.now()
  await page.goto(`${BASE_URL}/store`, {
    waitUntil: 'networkidle',
  })
  const loadTime = Date.now() - startTime

  // Step 3: Collect metrics
  const metrics: PerformanceMetrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const paint = performance.getEntriesByType('paint')

    return {
      htmlSize: nav.encodedBodySize || 0,
      htmlSizeUncompressed: nav.decodedBodySize || 0,
      compressionRatio: nav.decodedBodySize && nav.encodedBodySize
        ? nav.decodedBodySize / nav.encodedBodySize
        : 0,
      scriptsCount: document.querySelectorAll('script').length,
      blockingScripts: document.querySelectorAll('script:not([async]):not([defer])').length,
      firstPaint: paint[0]?.startTime || 0,
      domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
    }
  })

  // Step 4: Check for compression
  const response = await page.goto(`${BASE_URL}/store`, { waitUntil: 'domcontentloaded' })
  const headers = response?.headers() || {}
  const contentEncoding = headers['content-encoding'] || 'none'

  // Step 5: Display results
  console.log('\n' + '='.repeat(60))
  console.log('📈 PERFORMANCE TEST RESULTS')
  console.log('='.repeat(60))
  console.log(`\n🌐 URL: ${BASE_URL}/store`)
  console.log(`⏱️  Total Load Time: ${loadTime}ms`)
  console.log(`\n📦 HTML Size:`)
  console.log(`   Compressed: ${(metrics.htmlSize / 1024).toFixed(2)} KB`)
  console.log(`   Uncompressed: ${(metrics.htmlSizeUncompressed / 1024).toFixed(2)} KB`)
  console.log(`   Compression: ${contentEncoding} (${metrics.compressionRatio.toFixed(2)}x)`)
  console.log(`\n📜 Scripts:`)
  console.log(`   Total: ${metrics.scriptsCount}`)
  console.log(`   Blocking: ${metrics.blockingScripts}`)
  console.log(`\n⚡ Timing Metrics:`)
  console.log(`   First Paint: ${metrics.firstPaint.toFixed(0)}ms`)
  console.log(`   DOM Content Loaded: ${metrics.domContentLoaded}ms`)
  console.log(`   Load Complete: ${metrics.loadComplete}ms`)

  // Step 6: Evaluate against targets
  console.log(`\n🎯 Target Comparison:`)

  const targets = [
    { name: 'HTML Size (compressed)', value: metrics.htmlSize / 1024, target: 300, unit: 'KB', warn: 400 },
    { name: 'Total Scripts', value: metrics.scriptsCount, target: 90, unit: '', warn: 100 },
    { name: 'Blocking Scripts', value: metrics.blockingScripts, target: 0, unit: '', warn: 2 },
    { name: 'First Paint', value: metrics.firstPaint, target: 1800, unit: 'ms', warn: 2500 },
    { name: 'DOM Content Loaded', value: metrics.domContentLoaded, target: 2500, unit: 'ms', warn: 3500 },
  ]

  targets.forEach(({ name, value, target, unit, warn }) => {
    const status = value <= target ? '✅' : value <= warn ? '⚠️' : '❌'
    const valueStr = `${value.toFixed(0)}${unit}`
    const targetStr = `${target}${unit}`
    console.log(`   ${status} ${name}: ${valueStr} (target: <${targetStr})`)
  })

  console.log('\n' + '='.repeat(60))

  await browser.close()

  // Return metrics for potential CI integration
  return metrics
}

// Run the test
runAuthenticatedPerformanceTest().catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
