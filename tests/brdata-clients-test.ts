#!/usr/bin/env tsx
/**
 * Test All BRData Clients - Customer Simple Endpoint
 *
 * This script tests the customer-simple endpoint for all BRData retailers
 * with 500 requests each to measure performance and reliability.
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface BRDataClient {
  name: string
  displayName: string
  retailerId?: number
  storeConfigId?: number
  clientId: string
  secretKey: string
  appId: string
}

interface ClientTestResult {
  client: string
  displayName: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  successRate: number
  minLatency: number
  maxLatency: number
  avgLatency: number
  p50: number
  p90: number
  p95: number
  p99: number
  errorMessages: string[]
  startTime: string
  endTime: string
  duration: number
}

interface OverallSummary {
  totalClients: number
  testedClients: number
  failedClients: number
  totalRequests: number
  totalSuccessful: number
  totalFailed: number
  overallSuccessRate: number
  averageP90: number
  averageP95: number
  clientResults: ClientTestResult[]
  testDate: string
  testStartTime: string
  testEndTime: string
  testDuration: number
  testDurationFormatted: string
}

// Load BRData client credentials from gitignored config file
// Copy config/brdata-clients.example.json to config/brdata-clients.json and fill in credentials
const clientsConfigPath = path.resolve(__dirname, '..', 'config', 'brdata-clients.json')
if (!fs.existsSync(clientsConfigPath)) {
  console.error(`\n❌ Missing credentials file: ${clientsConfigPath}`)
  console.error('   Copy config/brdata-clients.example.json to config/brdata-clients.json')
  console.error('   and fill in the real clientId and secretKey values.\n')
  process.exit(1)
}
const BRDATA_CLIENTS: BRDataClient[] = JSON.parse(fs.readFileSync(clientsConfigPath, 'utf-8'))

// BRData base URL
const BRDATA_BASE_URL = 'https://webservices.brdata.com'

// Test customer numbers (from VCR cassettes)
const TEST_CUSTOMER_NUMBERS = [
  '41000000098',
  '41000025923',
]

const REQUESTS_PER_CLIENT = 500
const REPORT_DIR = path.join(process.cwd(), 'reports')
const RESULTS_FILE = path.join(REPORT_DIR, 'brdata-all-clients-results.json')
const SUMMARY_FILE = path.join(REPORT_DIR, 'brdata-all-clients-summary.md')
const CSV_FILE = path.join(REPORT_DIR, 'brdata-all-clients-results.csv')

/**
 * Test a single client with multiple requests
 */
async function testClient(client: BRDataClient): Promise<ClientTestResult> {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  Testing: ${client.displayName}`)
  console.log(`${'='.repeat(70)}`)

  const startTime = new Date()
  const customerNum = TEST_CUSTOMER_NUMBERS[0] // Use first test customer

  const result: ClientTestResult = {
    client: client.name,
    displayName: client.displayName,
    totalRequests: REQUESTS_PER_CLIENT,
    successfulRequests: 0,
    failedRequests: 0,
    successRate: 0,
    minLatency: Infinity,
    maxLatency: 0,
    avgLatency: 0,
    p50: 0,
    p90: 0,
    p95: 0,
    p99: 0,
    errorMessages: [],
    startTime: startTime.toISOString(),
    endTime: '',
    duration: 0,
  }

  try {
    console.log(`📊 Step 1: Generating bearer token...`)
    console.log(`   Client ID: ${client.clientId}`)
    console.log(`   App ID: ${client.appId}`)

    // First, generate the bearer token using client-specific credentials
    const tokenCommand = `npx tsx utils/get-brdata-token.ts \
      --clientId "${client.clientId}" \
      --appId "${client.appId}" \
      --secretKey "${client.secretKey}"`

    const tokenOutput = execSync(tokenCommand, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    // Extract token from output (look for FULL_TOKEN: line)
    const tokenMatch = tokenOutput.match(/FULL_TOKEN:([A-Za-z0-9._+/=-]+)/)
    if (!tokenMatch) {
      throw new Error('Failed to extract bearer token from output')
    }
    const bearerToken = tokenMatch[1]

    console.log(`✅ Token generated successfully`)
    console.log(`   Token length: ${bearerToken.length} characters`)
    console.log('')

    console.log(`📊 Step 2: Running ${REQUESTS_PER_CLIENT} requests...`)
    console.log(`   Customer Number: ${customerNum}`)
    console.log(`   App ID: ${client.appId}`)
    console.log('')

    // Run the test using the bearer token
    const testCommand = `npx tsx tests/brdata-api-test.ts \
      --appId "${client.appId}" \
      --customerNum "${customerNum}" \
      --token "${bearerToken}" \
      --baseUrl "${BRDATA_BASE_URL}" \
      --count ${REQUESTS_PER_CLIENT}`

    const testOutput = execSync(testCommand, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    // Parse the results from the JSON report
    const resultsPath = path.join(REPORT_DIR, 'brdata-api-results.json')
    if (fs.existsSync(resultsPath)) {
      const testResults = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'))

      result.successfulRequests = testResults.summary.successfulRequests || 0
      result.failedRequests = testResults.summary.failedRequests || 0
      result.successRate = testResults.summary.successRate || 0
      result.minLatency = testResults.latency.min || 0
      result.maxLatency = testResults.latency.max || 0
      result.avgLatency = testResults.latency.average || 0
      result.p50 = testResults.latency.p50 || 0
      result.p90 = testResults.latency.p90 || 0
      result.p95 = testResults.latency.p95 || 0
      result.p99 = testResults.latency.p99 || 0
    }

    console.log(`\n✅ Test completed successfully`)
    console.log(`   Success Rate: ${result.successRate.toFixed(1)}%`)
    console.log(`   P50 Latency: ${result.p50}ms`)
    console.log(`   P90 Latency: ${result.p90}ms`)
    console.log(`   P95 Latency: ${result.p95}ms`)

  } catch (error: any) {
    console.log(`\n❌ Test failed for ${client.displayName}`)

    // Check if it's a 401 error (invalid credentials)
    if (error.message && error.message.includes('401')) {
      result.errorMessages.push('HTTP 401: Invalid credentials (test fixtures)')
      result.failedRequests = REQUESTS_PER_CLIENT
      console.log(`   Error: Invalid credentials (expected with test fixtures)`)
    } else {
      result.errorMessages.push(error.message || 'Unknown error')
      result.failedRequests = REQUESTS_PER_CLIENT
      console.log(`   Error: ${error.message}`)
    }
  }

  const endTime = new Date()
  result.endTime = endTime.toISOString()
  result.duration = endTime.getTime() - startTime.getTime()

  return result
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
 * Generate summary report
 */
function generateSummary(results: ClientTestResult[], startTime: Date, endTime: Date): OverallSummary {
  const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0)
  const totalSuccessful = results.reduce((sum, r) => sum + r.successfulRequests, 0)
  const totalFailed = results.reduce((sum, r) => sum + r.failedRequests, 0)
  const failedClients = results.filter(r => r.successfulRequests === 0).length
  const successfulClients = results.filter(r => r.successfulRequests > 0)

  const avgP90 = successfulClients.length > 0
    ? successfulClients.reduce((sum, r) => sum + r.p90, 0) / successfulClients.length
    : 0

  const avgP95 = successfulClients.length > 0
    ? successfulClients.reduce((sum, r) => sum + r.p95, 0) / successfulClients.length
    : 0

  const testDuration = endTime.getTime() - startTime.getTime()

  return {
    totalClients: results.length,
    testedClients: results.length,
    failedClients,
    totalRequests,
    totalSuccessful,
    totalFailed,
    overallSuccessRate: totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0,
    averageP90: avgP90,
    averageP95: avgP95,
    clientResults: results,
    testDate: new Date().toISOString(),
    testStartTime: startTime.toISOString(),
    testEndTime: endTime.toISOString(),
    testDuration,
    testDurationFormatted: formatDuration(testDuration),
  }
}

/**
 * Save reports
 */
function saveReports(summary: OverallSummary) {
  // Ensure reports directory exists
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true })
  }

  // Save JSON report
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2))
  console.log(`\n📄 JSON report saved: ${RESULTS_FILE}`)

  // Save Markdown summary
  const markdown = generateMarkdownReport(summary)
  fs.writeFileSync(SUMMARY_FILE, markdown)
  console.log(`📄 Markdown report saved: ${SUMMARY_FILE}`)

  // Save CSV
  const csv = generateCSVReport(summary)
  fs.writeFileSync(CSV_FILE, csv)
  console.log(`📄 CSV report saved: ${CSV_FILE}`)
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(summary: OverallSummary): string {
  const startDate = new Date(summary.testStartTime)
  const endDate = new Date(summary.testEndTime)

  const lines = [
    '# BRData All Clients Performance Test Results',
    '',
    '## Test Execution Details',
    '',
    `**Start Time:** ${startDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    })}`,
    `**End Time:** ${endDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    })}`,
    `**Total Duration:** ${summary.testDurationFormatted}`,
    `**Requests Per Client:** ${REQUESTS_PER_CLIENT}`,
    '',
    '## Overall Summary',
    '',
    `- **Total Clients Tested:** ${summary.totalClients}`,
    `- **Successful Clients:** ${summary.testedClients - summary.failedClients}`,
    `- **Failed Clients:** ${summary.failedClients}`,
    `- **Total Requests:** ${summary.totalRequests.toLocaleString()}`,
    `- **Successful Requests:** ${summary.totalSuccessful.toLocaleString()} (${summary.overallSuccessRate.toFixed(1)}%)`,
    `- **Failed Requests:** ${summary.totalFailed.toLocaleString()}`,
    `- **Average P90 Latency:** ${Math.round(summary.averageP90)}ms`,
    `- **Average P95 Latency:** ${Math.round(summary.averageP95)}ms`,
    '',
    '## Client Results',
    '',
    '| Client | Success Rate | P50 | P90 | P95 | P99 | Avg | Min | Max |',
    '|--------|--------------|-----|-----|-----|-----|-----|-----|-----|',
  ]

  // Sort by success rate (desc) then by P90 (asc)
  const sortedResults = [...summary.clientResults].sort((a, b) => {
    if (a.successRate !== b.successRate) return b.successRate - a.successRate
    return a.p90 - b.p90
  })

  for (const result of sortedResults) {
    const status = result.successRate === 100 ? '✅' : result.successRate > 0 ? '⚠️' : '❌'
    lines.push(
      `| ${status} ${result.displayName} | ${result.successRate.toFixed(1)}% | ` +
      `${result.p50}ms | ${result.p90}ms | ${result.p95}ms | ${result.p99}ms | ` +
      `${Math.round(result.avgLatency)}ms | ${result.minLatency}ms | ${result.maxLatency}ms |`
    )
  }

  lines.push('')
  lines.push('## Error Summary')
  lines.push('')

  const clientsWithErrors = summary.clientResults.filter(r => r.errorMessages.length > 0)
  if (clientsWithErrors.length === 0) {
    lines.push('No errors encountered.')
  } else {
    for (const result of clientsWithErrors) {
      lines.push(`### ${result.displayName}`)
      lines.push('')
      for (const error of result.errorMessages) {
        lines.push(`- ${error}`)
      }
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push('## Configuration')
  lines.push('')
  lines.push('**BRData Configuration:**')
  lines.push(`- Base URL: ${BRDATA_BASE_URL}`)
  lines.push(`- Total Clients: ${summary.totalClients}`)
  lines.push(`- Each client uses unique credentials (clientId, appId, secretKey)`)
  lines.push('')
  lines.push('**Test Customer Numbers:**')
  for (const num of TEST_CUSTOMER_NUMBERS) {
    lines.push(`- ${num}`)
  }
  lines.push('')
  lines.push('**Note:** Using production BRData credentials for each retailer.')
  lines.push('')

  return lines.join('\n')
}

/**
 * Generate CSV report
 */
function generateCSVReport(summary: OverallSummary): string {
  const lines = [
    'Client,Display Name,Total Requests,Successful,Failed,Success Rate %,Min ms,Max ms,Avg ms,P50 ms,P90 ms,P95 ms,P99 ms,Errors'
  ]

  for (const result of summary.clientResults) {
    lines.push([
      result.client,
      result.displayName,
      result.totalRequests,
      result.successfulRequests,
      result.failedRequests,
      result.successRate.toFixed(2),
      result.minLatency,
      result.maxLatency,
      Math.round(result.avgLatency),
      result.p50,
      result.p90,
      result.p95,
      result.p99,
      result.errorMessages.join('; '),
    ].join(','))
  }

  return lines.join('\n')
}

/**
 * Main execution
 */
async function main() {
  const overallStartTime = new Date()

  console.log('\n' + '='.repeat(70))
  console.log('  BRData All Clients Performance Test')
  console.log('='.repeat(70))
  console.log('')
  console.log(`Start Time: ${overallStartTime.toLocaleString('en-US', {
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
  console.log(`Total Clients: ${BRDATA_CLIENTS.length}`)
  console.log(`Requests Per Client: ${REQUESTS_PER_CLIENT}`)
  console.log(`Total Requests: ${BRDATA_CLIENTS.length * REQUESTS_PER_CLIENT}`)
  console.log('')
  console.log('🔐 Using production BRData credentials')
  console.log('   Each client uses unique credentials (clientId, appId, secretKey)')
  console.log('')

  const results: ClientTestResult[] = []

  for (let i = 0; i < BRDATA_CLIENTS.length; i++) {
    const client = BRDATA_CLIENTS[i]
    console.log(`\n[${i + 1}/${BRDATA_CLIENTS.length}] Testing ${client.displayName}...`)

    const result = await testClient(client)
    results.push(result)

    // Small delay between clients to avoid overwhelming the API
    if (i < BRDATA_CLIENTS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const overallEndTime = new Date()

  console.log('\n' + '='.repeat(70))
  console.log('  All Tests Complete - Generating Reports')
  console.log('='.repeat(70))
  console.log('')
  console.log(`End Time: ${overallEndTime.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })}`)
  console.log(`Total Duration: ${formatDuration(overallEndTime.getTime() - overallStartTime.getTime())}`)
  console.log('')

  const summary = generateSummary(results, overallStartTime, overallEndTime)
  saveReports(summary)

  console.log('')
  console.log('📊 Overall Results:')
  console.log(`   Total Clients: ${summary.totalClients}`)
  console.log(`   Total Requests: ${summary.totalRequests.toLocaleString()}`)
  console.log(`   Success Rate: ${summary.overallSuccessRate.toFixed(1)}%`)
  console.log(`   Average P90: ${Math.round(summary.averageP90)}ms`)
  console.log(`   Average P95: ${Math.round(summary.averageP95)}ms`)
  console.log('')
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message)
  process.exit(1)
})
