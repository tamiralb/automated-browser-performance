/**
 * API Performance Tester Library
 *
 * Provides utilities for testing REST API endpoints and measuring performance
 */

export interface APITestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  timeout?: number
}

export interface APITestResult {
  url: string
  method: string
  statusCode: number
  duration: number
  ttfb: number // Time to First Byte
  downloadTime: number
  size: number
  timestamp: string
  success: boolean
  error?: string
  responseBody?: any
  responseHeaders?: Record<string, string>
}

export interface APIPerformanceMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  p50Duration: number
  p90Duration: number
  p95Duration: number
  p99Duration: number
  avgTTFB: number
  avgDownloadTime: number
  totalDataTransferred: number
  avgResponseSize: number
  successRate: number
  results: APITestResult[]
}

/**
 * Execute a single API request and measure performance
 */
export async function executeAPIRequest(config: APITestConfig): Promise<APITestResult> {
  const startTime = Date.now()
  let ttfb = 0
  let downloadTime = 0

  try {
    const controller = new AbortController()
    const timeoutId = config.timeout
      ? setTimeout(() => controller.abort(), config.timeout)
      : null

    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: controller.signal,
    })

    if (timeoutId) clearTimeout(timeoutId)

    // Time to first byte (when headers are received)
    ttfb = Date.now() - startTime

    // Read response body
    const responseText = await response.text()
    const endTime = Date.now()

    // Download time
    downloadTime = endTime - startTime - ttfb
    const duration = endTime - startTime

    let responseBody: any
    try {
      responseBody = JSON.parse(responseText)
    } catch {
      responseBody = responseText
    }

    // Extract response headers
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    return {
      url: config.url,
      method: config.method,
      statusCode: response.status,
      duration,
      ttfb,
      downloadTime,
      size: responseText.length,
      timestamp: new Date(startTime).toISOString(),
      success: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      responseBody,
      responseHeaders,
    }
  } catch (error: any) {
    const endTime = Date.now()
    return {
      url: config.url,
      method: config.method,
      statusCode: 0,
      duration: endTime - startTime,
      ttfb: 0,
      downloadTime: 0,
      size: 0,
      timestamp: new Date(startTime).toISOString(),
      success: false,
      error: error.message || String(error),
    }
  }
}

/**
 * Execute multiple API requests concurrently
 */
export async function executeParallelRequests(
  config: APITestConfig,
  count: number
): Promise<APITestResult[]> {
  const promises = Array(count).fill(null).map(() => executeAPIRequest(config))
  return Promise.all(promises)
}

/**
 * Execute API requests with specified concurrency
 */
export async function executeWithConcurrency(
  config: APITestConfig,
  totalRequests: number,
  concurrency: number
): Promise<APITestResult[]> {
  const results: APITestResult[] = []
  const batches = Math.ceil(totalRequests / concurrency)

  for (let i = 0; i < batches; i++) {
    const batchSize = Math.min(concurrency, totalRequests - i * concurrency)
    console.log(`  Batch ${i + 1}/${batches}: Executing ${batchSize} requests...`)

    const batchResults = await executeParallelRequests(config, batchSize)
    results.push(...batchResults)
  }

  return results
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1
  return sortedValues[Math.max(0, index)]
}

/**
 * Analyze API test results and generate metrics
 */
export function analyzeAPIResults(results: APITestResult[]): APIPerformanceMetrics {
  const successfulRequests = results.filter(r => r.success)
  const failedRequests = results.filter(r => !r.success)

  const durations = results.map(r => r.duration).sort((a, b) => a - b)
  const ttfbs = results.map(r => r.ttfb).filter(t => t > 0)
  const downloadTimes = results.map(r => r.downloadTime).filter(t => t > 0)

  return {
    totalRequests: results.length,
    successfulRequests: successfulRequests.length,
    failedRequests: failedRequests.length,
    avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length || 0,
    minDuration: durations[0] || 0,
    maxDuration: durations[durations.length - 1] || 0,
    p50Duration: calculatePercentile(durations, 50),
    p90Duration: calculatePercentile(durations, 90),
    p95Duration: calculatePercentile(durations, 95),
    p99Duration: calculatePercentile(durations, 99),
    avgTTFB: ttfbs.reduce((sum, t) => sum + t, 0) / ttfbs.length || 0,
    avgDownloadTime: downloadTimes.reduce((sum, t) => sum + t, 0) / downloadTimes.length || 0,
    totalDataTransferred: results.reduce((sum, r) => sum + r.size, 0),
    avgResponseSize: results.reduce((sum, r) => sum + r.size, 0) / results.length || 0,
    successRate: (successfulRequests.length / results.length) * 100,
    results,
  }
}

/**
 * Generate a formatted report from API metrics
 */
export function generateAPIReport(metrics: APIPerformanceMetrics, title: string): string {
  const report: string[] = []

  report.push('='.repeat(70))
  report.push(`  ${title}`)
  report.push('='.repeat(70))
  report.push('')

  report.push('📊 REQUEST SUMMARY:')
  report.push(`   Total Requests:      ${metrics.totalRequests}`)
  report.push(`   Successful:          ${metrics.successfulRequests} (${metrics.successRate.toFixed(1)}%)`)
  report.push(`   Failed:              ${metrics.failedRequests}`)
  report.push('')

  report.push('⏱️  LATENCY METRICS:')
  report.push(`   Min:                 ${metrics.minDuration.toFixed(0)}ms`)
  report.push(`   P50 (Median):        ${metrics.p50Duration.toFixed(0)}ms`)
  report.push(`   P90:                 ${metrics.p90Duration.toFixed(0)}ms`)
  report.push(`   P95:                 ${metrics.p95Duration.toFixed(0)}ms`)
  report.push(`   P99:                 ${metrics.p99Duration.toFixed(0)}ms`)
  report.push(`   Max:                 ${metrics.maxDuration.toFixed(0)}ms`)
  report.push(`   Average:             ${metrics.avgDuration.toFixed(0)}ms`)
  report.push('')

  report.push('🔍 TIMING BREAKDOWN:')
  report.push(`   Avg TTFB:            ${metrics.avgTTFB.toFixed(0)}ms`)
  report.push(`   Avg Download Time:   ${metrics.avgDownloadTime.toFixed(0)}ms`)
  report.push('')

  report.push('📦 DATA TRANSFER:')
  report.push(`   Total Transferred:   ${(metrics.totalDataTransferred / 1024 / 1024).toFixed(2)} MB`)
  report.push(`   Avg Response Size:   ${(metrics.avgResponseSize / 1024).toFixed(2)} KB`)
  report.push('')

  // Performance assessment
  const p90 = metrics.p90Duration
  let assessment = ''
  let emoji = ''

  if (p90 < 100) {
    emoji = '🟢'
    assessment = 'Excellent - Very fast response times'
  } else if (p90 < 500) {
    emoji = '🟡'
    assessment = 'Good - Acceptable response times'
  } else if (p90 < 1000) {
    emoji = '🟠'
    assessment = 'Fair - Response times could be improved'
  } else {
    emoji = '🔴'
    assessment = 'Poor - Response times need optimization'
  }

  report.push('📈 PERFORMANCE ASSESSMENT:')
  report.push(`   ${emoji} ${assessment}`)
  report.push(`   P90 Latency: ${p90.toFixed(0)}ms`)
  report.push('')

  report.push('='.repeat(70))

  return report.join('\n')
}

/**
 * Format API test results as CSV
 */
export function formatResultsAsCSV(results: APITestResult[]): string {
  const headers = [
    'Timestamp',
    'URL',
    'Method',
    'Status Code',
    'Duration (ms)',
    'TTFB (ms)',
    'Download Time (ms)',
    'Size (bytes)',
    'Success',
    'Error',
  ]

  const rows = results.map(r => [
    r.timestamp,
    r.url,
    r.method,
    r.statusCode.toString(),
    r.duration.toFixed(0),
    r.ttfb.toFixed(0),
    r.downloadTime.toFixed(0),
    r.size.toString(),
    r.success.toString(),
    r.error || '',
  ])

  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ]

  return csvLines.join('\n')
}
