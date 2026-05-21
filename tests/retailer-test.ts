/**
 * Test any retailer from the retailers.json configuration
 *
 * Usage:
 *   tsx tests/retailer-test.ts <retailer-id>
 *   tsx tests/retailer-test.ts davis-food-drug
 *   tsx tests/retailer-test.ts davis-food-drug --auth
 *   tsx tests/retailer-test.ts davis-food-drug --cookies cookies/davis.json
 *   tsx tests/retailer-test.ts --list
 *   tsx tests/retailer-test.ts --all
 *   tsx tests/retailer-test.ts --all --auth
 */

import { chromium, devices } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as readline from 'readline'
import { runWebVitalsCollection } from '../lib/web-vitals-collector.js'
import { analyzeResourceTiming } from '../lib/resource-analyzer.js'
import { runLighthouse } from '../lib/lighthouse-runner.js'
import { generateComprehensiveConsoleReport, generateComprehensiveJSONReport, generateComprehensiveHTMLReport } from '../lib/report-generator.js'
import { loadCookiesFromFile, loadCookiesIntoContext } from '../lib/cookie-auth.js'
import type { PerformanceBudgets, ComprehensiveTestResult } from '../lib/metrics-types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface Retailer {
  id: string
  name: string
  url: string
}

interface RetailersConfig {
  description: string
  retailers: Retailer[]
  defaultRetailer: string
}

/**
 * Load retailers configuration
 */
function loadRetailers(): RetailersConfig {
  const retailersPath = resolve(__dirname, '..', 'config', 'retailers.json')
  return JSON.parse(readFileSync(retailersPath, 'utf-8'))
}

/**
 * Load performance budgets
 */
function loadPerformanceBudgets(): PerformanceBudgets {
  const budgetsPath = resolve(__dirname, '..', 'config', 'performance-budgets.json')
  return JSON.parse(readFileSync(budgetsPath, 'utf-8'))
}

/**
 * List all available retailers
 */
function listRetailers(): void {
  const config = loadRetailers()

  console.log('\n📋 Available Retailers:\n')
  console.log('=' .repeat(80))
  console.log('ID'.padEnd(25) + 'Name'.padEnd(30) + 'URL')
  console.log('=' .repeat(80))

  config.retailers.forEach(retailer => {
    console.log(
      retailer.id.padEnd(25) +
      retailer.name.padEnd(30) +
      retailer.url
    )
  })

  console.log('=' .repeat(80))
  console.log(`\nDefault retailer: ${config.defaultRetailer}`)
  console.log('\nUsage:')
  console.log('  tsx tests/retailer-test.ts <retailer-id>')
  console.log('  tsx tests/retailer-test.ts davis-food-drug')
  console.log('  tsx tests/retailer-test.ts --all\n')
}

/**
 * Get retailer by ID
 */
function getRetailer(id: string): Retailer | null {
  const config = loadRetailers()
  return config.retailers.find(r => r.id === id) || null
}

/**
 * Wait for user to manually log in
 */
async function waitForManualLogin(page: any, retailer: Retailer): Promise<void> {
  console.log('\n' + '='.repeat(80))
  console.log('🔐 MANUAL LOGIN REQUIRED')
  console.log('='.repeat(80))
  console.log('')
  console.log(`A browser window has opened to: ${retailer.url}`)
  console.log('')
  console.log('Please complete the following steps:')
  console.log('  1. Click the "Sign In" button in the browser')
  console.log('  2. Enter your credentials and log in')
  console.log('  3. Wait until you are fully logged in and can see your account')
  console.log('  4. Come back to this terminal')
  console.log('  5. Press ENTER to continue the test')
  console.log('')
  console.log('⏳ Waiting for you to log in...')
  console.log('='.repeat(80))
  console.log('')

  // Wait for user to press Enter
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  await new Promise<void>((resolve) => {
    rl.question('Press ENTER when you are logged in and ready to continue: ', () => {
      rl.close()
      resolve()
    })
  })

  console.log('\n✅ Continuing with performance tests...\n')
}

/**
 * Test a single retailer
 */
async function testRetailer(
  retailer: Retailer,
  requireAuth: boolean = false,
  cookieFile?: string
): Promise<ComprehensiveTestResult> {
  console.log(`\n🚀 Testing ${retailer.name}`)
  console.log(`📍 URL: ${retailer.url}`)
  if (requireAuth) {
    console.log(`🔐 Authentication: Manual login required`)
  }
  if (cookieFile) {
    console.log(`🍪 Authentication: Using cookies from ${cookieFile}`)
  }
  console.log('')

  const budgets = loadPerformanceBudgets()

  // ============================================================================
  // Phase 1 & 2: Playwright Session (Web Vitals + Resource Timing)
  // ============================================================================

  console.log('📊 Phase 1-2: Launching Playwright browser...')
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  })

  // Load cookies if provided
  if (cookieFile) {
    console.log(`🍪 Loading cookies from ${cookieFile}...`)
    const cookies = loadCookiesFromFile(cookieFile)
    await loadCookiesIntoContext(context, cookies)
    console.log(`✅ Loaded ${cookies.length} cookies\n`)
  }

  const page = await context.newPage()

  // Navigate to retailer and optionally wait for manual login
  if (requireAuth && !cookieFile) {
    await page.goto(retailer.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForManualLogin(page, retailer)
  }

  // Phase 1: Web Vitals
  console.log('🌐 Running Web Vitals test...')
  const webVitalsResult = await runWebVitalsCollection(page, retailer.url)
  console.log('✅ Web Vitals test complete\n')

  // Phase 2: Resource Timing
  console.log('📦 Running Resource Timing analysis...')
  await page.goto(retailer.url, { waitUntil: 'load', timeout: 90000 })
  await page.waitForTimeout(3000) // Wait for additional resources to load
  const resourceTimingResult = await analyzeResourceTiming(page, budgets.resourceTiming)
  console.log('✅ Resource Timing analysis complete\n')

  await browser.close()

  // ============================================================================
  // Phase 3: Lighthouse (Separate Chrome Instance)
  // ============================================================================

  console.log('💡 Running Lighthouse audit (separate Chrome instance)...')

  // If authentication is required, extract cookies for Lighthouse
  const cookies = requireAuth ? await context.cookies() : undefined

  const lighthouseResult = await runLighthouse({
    url: retailer.url,
    authenticate: requireAuth,
    loginFn: requireAuth ? async (lighthousePage) => {
      await lighthousePage.goto(retailer.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitForManualLogin(lighthousePage, retailer)
    } : undefined,
    budgets,
    reportDir: `./reports/${retailer.id}`,
  })
  console.log('✅ Lighthouse audit complete\n')

  // ============================================================================
  // Generate Reports
  // ============================================================================

  const timestamp = new Date().toISOString()

  const totalTests =
    webVitalsResult.evaluations.length +
    lighthouseResult.evaluations.length +
    resourceTimingResult.evaluations.length

  const passed =
    webVitalsResult.summary.good +
    lighthouseResult.summary.good +
    resourceTimingResult.summary.good

  const warnings =
    webVitalsResult.summary.needsImprovement +
    lighthouseResult.summary.needsImprovement +
    resourceTimingResult.summary.needsImprovement

  const failed =
    webVitalsResult.summary.poor +
    lighthouseResult.summary.poor +
    resourceTimingResult.summary.poor

  const success = failed === 0

  const comprehensiveResult: ComprehensiveTestResult = {
    success,
    webVitals: webVitalsResult,
    lighthouse: lighthouseResult,
    resourceTiming: resourceTimingResult,
    summary: {
      totalTests,
      passed,
      warnings,
      failed,
    },
    timestamp,
  }

  // Console report
  const consoleReport = generateComprehensiveConsoleReport(comprehensiveResult)
  console.log(consoleReport)

  // Save reports
  mkdirSync(`./reports/${retailer.id}`, { recursive: true })

  const jsonReport = generateComprehensiveJSONReport(comprehensiveResult)
  const jsonPath = `./reports/${retailer.id}/comprehensive-report.json`
  writeFileSync(jsonPath, jsonReport, 'utf-8')
  console.log(`📄 JSON report saved: ${jsonPath}`)

  const htmlReport = generateComprehensiveHTMLReport(comprehensiveResult)
  const htmlPath = `./reports/${retailer.id}/comprehensive-report.html`
  writeFileSync(htmlPath, htmlReport, 'utf-8')
  console.log(`📄 HTML dashboard saved: ${htmlPath}`)

  console.log(`📄 Lighthouse HTML: ./reports/${retailer.id}/lighthouse-report.html`)
  console.log(`📄 Lighthouse JSON: ./reports/${retailer.id}/lighthouse-report.json`)
  console.log('')

  return comprehensiveResult
}

/**
 * Test all retailers sequentially
 */
async function testAllRetailers(requireAuth: boolean = false, cookieFile?: string): Promise<void> {
  const config = loadRetailers()
  const results: Array<{ retailer: Retailer; result: ComprehensiveTestResult }> = []

  console.log(`\n🚀 Testing all ${config.retailers.length} retailers...\n`)
  if (requireAuth) {
    console.log('🔐 Manual authentication will be required for each retailer\n')
  }
  if (cookieFile) {
    console.log(`🍪 Using cookies from ${cookieFile} for all retailers\n`)
  }

  for (const retailer of config.retailers) {
    try {
      const result = await testRetailer(retailer, requireAuth, cookieFile)
      results.push({ retailer, result })
    } catch (error) {
      console.error(`❌ Error testing ${retailer.name}:`, error)
      results.push({
        retailer,
        result: null as any, // Mark as failed
      })
    }
  }

  // Generate summary report
  console.log('\n' + '='.repeat(80))
  console.log('📊 ALL RETAILERS SUMMARY')
  console.log('='.repeat(80))
  console.log('')

  results.forEach(({ retailer, result }) => {
    if (!result) {
      console.log(`❌ ${retailer.name.padEnd(30)} - FAILED TO TEST`)
      return
    }

    const status = result.success ? '✅' : '❌'
    const perfScore = result.lighthouse.metrics.performanceScore.toFixed(0)
    const lcp = result.webVitals.metrics.lcp || 0

    console.log(
      `${status} ${retailer.name.padEnd(30)} ` +
      `Perf: ${perfScore}/100  LCP: ${lcp.toFixed(0)}ms  ` +
      `Passed: ${result.summary.passed}/${result.summary.totalTests}`
    )
  })

  console.log('')
  console.log('='.repeat(80))
  console.log(`\n✅ Tested ${results.length} retailers`)
  console.log(`📁 Reports saved in ./reports/<retailer-id>/\n`)

  // Save summary JSON
  const summaryPath = './reports/all-retailers-summary.json'
  const summary = {
    timestamp: new Date().toISOString(),
    totalRetailers: results.length,
    results: results.map(({ retailer, result }) => ({
      id: retailer.id,
      name: retailer.name,
      url: retailer.url,
      success: result?.success || false,
      performanceScore: result?.lighthouse.metrics.performanceScore || 0,
      lcp: result?.webVitals.metrics.lcp || 0,
      totalResources: result?.resourceTiming.metrics.totalResources || 0,
    })),
  }
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8')
  console.log(`📄 Summary report: ${summaryPath}\n`)
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)

  // Check for --auth flag
  const requireAuth = args.includes('--auth')
  let filteredArgs = args.filter(arg => arg !== '--auth')

  // Check for --cookies flag
  let cookieFile: string | undefined
  const cookiesIndex = filteredArgs.indexOf('--cookies')
  if (cookiesIndex !== -1 && cookiesIndex + 1 < filteredArgs.length) {
    cookieFile = filteredArgs[cookiesIndex + 1]
    filteredArgs = filteredArgs.filter((_, i) => i !== cookiesIndex && i !== cookiesIndex + 1)
  }

  // Handle --list flag
  if (filteredArgs.includes('--list') || filteredArgs.includes('-l')) {
    listRetailers()
    return
  }

  // Handle --all flag
  if (filteredArgs.includes('--all') || filteredArgs.includes('-a')) {
    await testAllRetailers(requireAuth, cookieFile)
    return
  }

  // Get retailer ID from arguments
  const retailerId = filteredArgs[0]
  if (!retailerId) {
    console.error('\n❌ Error: Please specify a retailer ID\n')
    console.log('Usage:')
    console.log('  tsx tests/retailer-test.ts <retailer-id>                       # Test without login')
    console.log('  tsx tests/retailer-test.ts <retailer-id> --auth               # Test with manual login')
    console.log('  tsx tests/retailer-test.ts <retailer-id> --cookies <file>     # Test with saved cookies')
    console.log('  tsx tests/retailer-test.ts --list                             # List all retailers')
    console.log('  tsx tests/retailer-test.ts --all                              # Test all retailers')
    console.log('  tsx tests/retailer-test.ts --all --cookies <file>             # Test all with cookies\n')
    listRetailers()
    process.exit(1)
  }

  // Get retailer
  const retailer = getRetailer(retailerId)
  if (!retailer) {
    console.error(`\n❌ Error: Retailer "${retailerId}" not found\n`)
    listRetailers()
    process.exit(1)
  }

  // Test the retailer
  const result = await testRetailer(retailer, requireAuth, cookieFile)

  if (!result.success) {
    console.error(`\n❌ Performance tests failed for ${retailer.name}`)
    process.exit(1)
  }

  console.log(`\n✅ Performance tests passed for ${retailer.name}!`)
}

// Run
main().catch((error) => {
  console.error('❌ Test error:', error)
  process.exit(1)
})
