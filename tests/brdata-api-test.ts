/**
 * BRData API Performance Test
 *
 * Tests the BRData "Get Coupons for Customer - Simple" endpoint
 * This endpoint returns offer IDs grouped by status (available, clipped, redeemed)
 *
 * Usage:
 *   npm run test:brdata -- --appId <appId> --customerNum <customerNum> --token <bearerToken>
 *   npm run test:brdata -- --appId 33 --customerNum 1234567890 --token abc123... --count 10
 *   npm run test:brdata -- --appId 33 --customerNum 1234567890 --token abc123... --volume 100 --concurrency 10
 *
 * Options:
 *   --appId          BRData application ID (required)
 *   --customerNum    Customer/loyalty number (required)
 *   --token          Bearer authentication token (required)
 *   --count          Number of sequential requests (default: 1)
 *   --volume         Total requests for volume test (use with --concurrency)
 *   --concurrency    Concurrent requests (use with --volume)
 *   --baseUrl        Override base URL (default: https://webservices.brdata.com)
 */

import { writeFileSync, mkdirSync } from 'fs'
import {
  executeAPIRequest,
  executeWithConcurrency,
  analyzeAPIResults,
  generateAPIReport,
  formatResultsAsCSV,
  type APITestConfig,
  type APITestResult,
} from '../lib/api-tester.js'

interface BRDataConfig {
  appId: string
  customerNum: string
  bearerToken: string
  baseUrl: string
}

interface BRDataSimpleOffersResponse {
  available: string[]
  clipped: string[]
  redeemed: string[]
}

/**
 * Build the BRData API request configuration
 */
function buildBRDataRequest(config: BRDataConfig): APITestConfig {
  const url = `${config.baseUrl}/api/Loyalty/${config.appId}/quotient/${config.customerNum}/offers/simple`

  return {
    url,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.bearerToken}`,
      'Accept': 'application/json',
    },
    timeout: 45000, // 45 second timeout (same as current BRData integration)
  }
}

/**
 * Execute a single BRData API test
 */
async function testBRDataAPI(config: BRDataConfig): Promise<APITestResult> {
  console.log('🚀 Executing BRData API Request...')
  console.log(`   URL: ${config.baseUrl}/api/Loyalty/${config.appId}/quotient/${config.customerNum}/offers/simple`)
  console.log('')

  const requestConfig = buildBRDataRequest(config)
  const result = await executeAPIRequest(requestConfig)

  // Display immediate results
  if (result.success) {
    console.log(`✅ Request Successful`)
    console.log(`   Status: ${result.statusCode}`)
    console.log(`   Duration: ${result.duration.toFixed(0)}ms`)
    console.log(`   TTFB: ${result.ttfb.toFixed(0)}ms`)
    console.log(`   Download: ${result.downloadTime.toFixed(0)}ms`)
    console.log(`   Size: ${(result.size / 1024).toFixed(2)} KB`)

    // Parse response
    if (result.responseBody && typeof result.responseBody === 'object') {
      const offers = result.responseBody as BRDataSimpleOffersResponse
      console.log('')
      console.log('📊 Offer Counts:')
      console.log(`   Available: ${offers.available?.length || 0}`)
      console.log(`   Clipped: ${offers.clipped?.length || 0}`)
      console.log(`   Redeemed: ${offers.redeemed?.length || 0}`)
      console.log(`   Total: ${(offers.available?.length || 0) + (offers.clipped?.length || 0) + (offers.redeemed?.length || 0)}`)
    }
  } else {
    console.log(`❌ Request Failed`)
    console.log(`   Error: ${result.error}`)
    console.log(`   Duration: ${result.duration.toFixed(0)}ms`)
  }

  console.log('')
  return result
}

/**
 * Execute multiple sequential requests
 */
async function testSequential(config: BRDataConfig, count: number): Promise<APITestResult[]> {
  console.log(`🔄 Running ${count} sequential requests...\n`)

  const results: APITestResult[] = []
  const requestConfig = buildBRDataRequest(config)

  for (let i = 0; i < count; i++) {
    console.log(`Request ${i + 1}/${count}:`)
    const result = await executeAPIRequest(requestConfig)

    if (result.success) {
      console.log(`  ✅ ${result.duration.toFixed(0)}ms (${(result.size / 1024).toFixed(2)} KB)`)
    } else {
      console.log(`  ❌ Failed: ${result.error}`)
    }

    results.push(result)
  }

  console.log('')
  return results
}

/**
 * Execute volume test with concurrency
 */
async function testVolume(
  config: BRDataConfig,
  totalRequests: number,
  concurrency: number
): Promise<APITestResult[]> {
  console.log(`🔥 Running volume test...`)
  console.log(`   Total Requests: ${totalRequests}`)
  console.log(`   Concurrency: ${concurrency}`)
  console.log('')

  const requestConfig = buildBRDataRequest(config)
  const results = await executeWithConcurrency(requestConfig, totalRequests, concurrency)

  console.log('✅ Volume test complete\n')
  return results
}

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const parsed: Record<string, string | undefined> = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2)
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true'
      parsed[key] = value
      if (value !== 'true') i++ // Skip next arg if it was a value
    }
  }

  return parsed
}

/**
 * Format duration in human-readable format
 */
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    const remainingSeconds = seconds % 60
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Main execution
 */
async function main() {
  const testStartTime = new Date()

  const args = parseArgs()

  // Validate required arguments
  if (!args.appId || !args.customerNum || !args.token) {
    console.error('\n❌ Error: Missing required arguments\n')
    console.log('Usage:')
    console.log('  npm run test:brdata -- --appId <appId> --customerNum <customerNum> --token <bearerToken>\n')
    console.log('Required:')
    console.log('  --appId          BRData application ID')
    console.log('  --customerNum    Customer/loyalty number')
    console.log('  --token          Bearer authentication token\n')
    console.log('Optional:')
    console.log('  --count          Number of sequential requests (default: 1)')
    console.log('  --volume         Total requests for volume test')
    console.log('  --concurrency    Concurrent requests (use with --volume)')
    console.log('  --baseUrl        Override base URL\n')
    console.log('Examples:')
    console.log('  npm run test:brdata -- --appId 33 --customerNum 1234567890 --token abc123...')
    console.log('  npm run test:brdata -- --appId 33 --customerNum 1234567890 --token abc123... --count 10')
    console.log('  npm run test:brdata -- --appId 33 --customerNum 1234567890 --token abc123... --volume 100 --concurrency 10\n')
    process.exit(1)
  }

  const config: BRDataConfig = {
    appId: args.appId,
    customerNum: args.customerNum,
    bearerToken: args.token,
    baseUrl: args.baseUrl || 'https://webservices.brdata.com',
  }

  console.log('\n' + '='.repeat(70))
  console.log('  BRData API Performance Test')
  console.log('='.repeat(70))
  console.log('')
  console.log(`Start Time: ${testStartTime.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })}`)
  console.log('')
  console.log('Configuration:')
  console.log(`  App ID:        ${config.appId}`)
  console.log(`  Customer Num:  ${config.customerNum}`)
  console.log(`  Base URL:      ${config.baseUrl}`)
  console.log(`  Token:         ${config.bearerToken.substring(0, 20)}...`)
  console.log('')

  let results: APITestResult[]

  // Determine test mode
  if (args.volume && args.concurrency) {
    // Volume test with concurrency
    results = await testVolume(
      config,
      parseInt(args.volume),
      parseInt(args.concurrency)
    )
  } else if (args.count) {
    // Sequential requests
    results = await testSequential(config, parseInt(args.count))
  } else {
    // Single request
    results = [await testBRDataAPI(config)]
  }

  // Capture end time
  const testEndTime = new Date()
  const testDuration = testEndTime.getTime() - testStartTime.getTime()

  // Analyze results
  const metrics = analyzeAPIResults(results)

  // Generate and display report
  const report = generateAPIReport(metrics, 'BRData API Performance Results')
  console.log(report)

  // Display execution time
  console.log('\n⏱️  EXECUTION TIME:\n')
  console.log(`Start Time:     ${testStartTime.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })}`)
  console.log(`End Time:       ${testEndTime.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })}`)
  console.log(`Total Duration: ${formatDuration(testDuration)}`)

  // Performance warnings
  console.log('\n⚠️  PERFORMANCE ANALYSIS:\n')

  if (metrics.p90Duration > 10000) {
    console.log('🔴 CRITICAL: P90 latency > 10 seconds')
    console.log('   This matches the baseline performance issue.')
    console.log('   Recommendation: Implement caching (30min TTL)')
  } else if (metrics.p90Duration > 5000) {
    console.log('🟠 WARNING: P90 latency > 5 seconds')
    console.log('   Performance could be improved.')
  } else if (metrics.p90Duration > 1000) {
    console.log('🟡 NOTICE: P90 latency > 1 second')
    console.log('   Performance is acceptable but could be optimized.')
  } else {
    console.log('🟢 EXCELLENT: P90 latency < 1 second')
    console.log('   Performance is very good.')
  }

  if (metrics.successRate < 100) {
    console.log(`\n🔴 ERROR RATE: ${(100 - metrics.successRate).toFixed(1)}% of requests failed`)
    console.log('   Check authentication and network connectivity.')
  }

  console.log('')

  // Save detailed results
  mkdirSync('./reports', { recursive: true })

  // JSON report
  const jsonReport = {
    testExecution: {
      startTime: testStartTime.toISOString(),
      endTime: testEndTime.toISOString(),
      duration: testDuration,
      durationFormatted: formatDuration(testDuration),
      timestamp: new Date().toISOString(),
    },
    config: {
      appId: config.appId,
      customerNum: config.customerNum,
      baseUrl: config.baseUrl,
    },
    summary: metrics,
    results: results.slice(0, 100), // Limit to first 100 for file size
  }
  const jsonPath = './reports/brdata-api-results.json'
  writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8')
  console.log(`📄 JSON report saved: ${jsonPath}`)

  // CSV report
  const csvContent = formatResultsAsCSV(results)
  const csvPath = './reports/brdata-api-results.csv'
  writeFileSync(csvPath, csvContent, 'utf-8')
  console.log(`📊 CSV report saved: ${csvPath}`)

  console.log('')

  // Comparison to baseline
  console.log('📈 COMPARISON TO BASELINE:')
  console.log('   Baseline P90 (Integrations):  12,300ms')
  console.log(`   Current Test P90:             ${metrics.p90Duration.toFixed(0)}ms`)

  if (metrics.p90Duration > 12000) {
    console.log('   Status: ⚠️  Slower than baseline (network/auth overhead)')
  } else if (metrics.p90Duration < 11000) {
    console.log('   Status: ✅ Faster than baseline')
  } else {
    console.log('   Status: ≈ Similar to baseline')
  }

  console.log('')
  console.log('='.repeat(70))
  console.log('✅ Test Complete')
  console.log('='.repeat(70))
  console.log('')
}

main().catch((error) => {
  console.error('❌ Test error:', error)
  process.exit(1)
})
