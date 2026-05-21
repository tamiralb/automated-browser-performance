/**
 * GraphQL Operations Performance Test
 *
 * Tracks specific GraphQL operations like FindOffersForUserV2
 *
 * Usage:
 *   npx tsx graphql-test.ts <url>
 *   npx tsx graphql-test.ts https://shop.davisfoodanddrug.com/store/davis-food-drug/pages/in-store-deals
 */

import { chromium, devices } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'
import * as readline from 'readline'
import { interceptGraphQLOperations, getInterceptedGraphQLOperations, analyzeGraphQLOperations, generateGraphQLReport } from '../lib/graphql-analyzer.js'
import { loadCookiesFromFile, loadCookiesIntoContext } from '../lib/cookie-auth.js'
import type { GraphQLOperation } from '../lib/graphql-analyzer.js'

async function waitForManualLogin(url: string): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log('MANUAL LOGIN REQUIRED')
  console.log('='.repeat(60))
  console.log('')
  console.log(`A browser window has opened to: ${url}`)
  console.log('')
  console.log('Steps:')
  console.log('  1. Sign in to your account in the browser')
  console.log('  2. Wait until fully logged in')
  console.log('  3. Come back here and press ENTER')
  console.log('')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise<void>((resolve) => {
    rl.question('Press ENTER when you are signed in and ready: ', () => {
      rl.close()
      resolve()
    })
  })

  console.log('\nContinuing with GraphQL test...\n')
}

async function testGraphQLOperations(url: string, requireAuth: boolean = false, cookieFile?: string) {
  console.log('\n🚀 Starting GraphQL Operations Test...')
  console.log(`📍 URL: ${url}`)
  if (requireAuth) {
    console.log('🔐 Authentication: Manual login required')
  }
  if (cookieFile) {
    console.log(`🍪 Using cookies from: ${cookieFile}`)
  }
  console.log('')

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
    const cookies = loadCookiesFromFile(cookieFile)
    await loadCookiesIntoContext(context, cookies)
  }

  const page = await context.newPage()

  // Navigate and wait for manual login if --auth flag is set
  if (requireAuth && !cookieFile) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForManualLogin(url)
  }

  console.log('🔍 Setting up GraphQL operation interceptor...')

  // Store GraphQL operations
  const graphqlOperations: GraphQLOperation[] = []

  // Intercept GraphQL requests
  await page.route('**/graphql**', async (route) => {
    const request = route.request()
    const startTime = Date.now()

    console.log(`📡 GraphQL request: ${new URL(request.url()).searchParams.get('operationName') || 'Unknown'}`)

    // Continue with the request
    const response = await route.fetch()
    const endTime = Date.now()
    const duration = endTime - startTime

    // Extract operation name
    const urlObj = new URL(request.url())
    const operationName = urlObj.searchParams.get('operationName')

    if (operationName) {
      const body = await response.body()
      const operation: GraphQLOperation = {
        operationName,
        url: request.url(),
        duration,
        startTime,
        responseStatus: response.status(),
        size: body.length,
        timestamp: new Date(startTime).toISOString(),
      }

      graphqlOperations.push(operation)

      console.log(`   ✅ ${operationName}: ${duration.toFixed(0)}ms (${(body.length / 1024).toFixed(2)} KB)`)
    }

    // Continue with the response
    await route.fulfill({ response })
  })

  console.log('📊 Loading page and tracking GraphQL operations...\n')

  // Navigate to page
  await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })

  console.log('✅ Page loaded\n')

  // Wait a bit for any delayed GraphQL calls
  await page.waitForTimeout(2000)

  await browser.close()

  // Analyze operations
  const analysis = analyzeGraphQLOperations(graphqlOperations)

  // Generate report
  const report = generateGraphQLReport(analysis)
  console.log(report)

  // Highlight FindOffersForUserV2 specifically
  if (analysis.findOffersForUserV2) {
    console.log('🎯 FINDOFFERSFORUSERV2 DETAILS:')
    console.log('='.repeat(60))
    console.log(`Duration: ${analysis.findOffersForUserV2.duration.toFixed(0)}ms`)
    console.log(`Size: ${(analysis.findOffersForUserV2.size / 1024).toFixed(2)} KB`)
    console.log(`Status: ${analysis.findOffersForUserV2.responseStatus}`)
    console.log(`URL: ${analysis.findOffersForUserV2.url}`)
    console.log('='.repeat(60))
    console.log('')

    // Check if it's slow
    if (analysis.findOffersForUserV2.duration > 1000) {
      console.log('⚠️  WARNING: FindOffersForUserV2 took over 1 second!')
    } else if (analysis.findOffersForUserV2.duration > 500) {
      console.log('⚠️  NOTICE: FindOffersForUserV2 took over 500ms')
    } else {
      console.log('✅ FindOffersForUserV2 performance is good (<500ms)')
    }
    console.log('')
  } else {
    console.log('❌ FindOffersForUserV2 operation was not detected!')
    console.log('   This may mean:')
    console.log('   - The page doesn\'t load this operation')
    console.log('   - The operation has a different name')
    console.log('   - Authentication is required')
    console.log('')
  }

  // Save JSON report
  mkdirSync('./reports', { recursive: true })
  const jsonReport = {
    url,
    timestamp: new Date().toISOString(),
    analysis,
  }
  const jsonPath = './reports/graphql-analysis.json'
  writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8')
  console.log(`📄 JSON report saved: ${jsonPath}\n`)

  return analysis
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const requireAuth = args.includes('--auth')
  const url = args.find(arg => !arg.startsWith('--'))
  const cookiesIndex = args.indexOf('--cookies')
  const cookieFile = cookiesIndex >= 0 ? args[cookiesIndex + 1] : undefined

  if (!url) {
    console.error('\n❌ Error: Please specify a URL\n')
    console.log('Usage:')
    console.log('  npx tsx graphql-test.ts <url>')
    console.log('  npx tsx graphql-test.ts <url> --auth')
    console.log('  npx tsx graphql-test.ts <url> --cookies <cookie-file>')
    console.log('\nExamples:')
    console.log('  npx tsx graphql-test.ts https://shop.broulims.com/store/broulims-supermarket/pages/in-store-deals --auth')
    console.log('  npx tsx graphql-test.ts https://shop.davisfoodanddrug.com/store/davis-food-drug/pages/in-store-deals --cookies davis-cookies.json')
    console.log('')
    process.exit(1)
  }

  await testGraphQLOperations(url, requireAuth, cookieFile)
}

main().catch((error) => {
  console.error('❌ Test error:', error)
  process.exit(1)
})
