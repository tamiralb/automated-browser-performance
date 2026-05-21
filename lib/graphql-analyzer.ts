/**
 * GraphQL Operation Analysis
 *
 * Tracks specific GraphQL operations and their performance
 */

import type { Page } from 'playwright'

export interface GraphQLOperation {
  operationName: string
  url: string
  duration: number
  startTime: number
  responseStatus: number
  size: number
  variables?: any
  timestamp: string
}

export interface GraphQLAnalysis {
  operations: GraphQLOperation[]
  findOffersForUserV2?: GraphQLOperation
  totalGraphQLCalls: number
  averageGraphQLDuration: number
  slowestGraphQLOperation?: GraphQLOperation
}

/**
 * Extract GraphQL operation name from URL
 */
function extractOperationName(url: string): string | null {
  const match = url.match(/operationName=([^&]+)/)
  return match ? match[1] : null
}

/**
 * Collect GraphQL operations from Resource Timing API
 */
export async function collectGraphQLOperations(page: Page): Promise<GraphQLOperation[]> {
  return page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const graphqlOps: GraphQLOperation[] = []

    resources.forEach((entry) => {
      // Check if this is a GraphQL request
      if (entry.name.includes('/graphql') && entry.name.includes('operationName=')) {
        const url = new URL(entry.name)
        const operationName = url.searchParams.get('operationName')

        if (operationName) {
          graphqlOps.push({
            operationName,
            url: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            responseStatus: 0, // Not available from Resource Timing
            size: entry.transferSize,
            timestamp: new Date().toISOString(),
          })
        }
      }
    })

    return graphqlOps
  })
}

/**
 * Intercept and track GraphQL operations in real-time
 */
export async function interceptGraphQLOperations(page: Page): Promise<void> {
  // Store GraphQL operations on the page
  await page.addInitScript(() => {
    (window as any).__graphqlOperations = []
  })

  // Intercept network requests
  await page.route('**/graphql**', async (route) => {
    const request = route.request()
    const startTime = Date.now()

    // Continue with the request
    const response = await route.fetch()
    const endTime = Date.now()
    const duration = endTime - startTime

    // Extract operation name
    const url = request.url()
    const operationName = new URL(url).searchParams.get('operationName')

    if (operationName) {
      // Store operation data
      await page.evaluate((data) => {
        (window as any).__graphqlOperations.push(data)
      }, {
        operationName,
        url,
        duration,
        startTime,
        responseStatus: response.status(),
        size: (await response.body()).length,
        timestamp: new Date(startTime).toISOString(),
      })
    }

    // Continue with the response
    await route.fulfill({ response })
  })
}

/**
 * Get intercepted GraphQL operations
 */
export async function getInterceptedGraphQLOperations(page: Page): Promise<GraphQLOperation[]> {
  return page.evaluate(() => {
    return (window as any).__graphqlOperations || []
  })
}

/**
 * Analyze GraphQL operations
 */
export function analyzeGraphQLOperations(operations: GraphQLOperation[]): GraphQLAnalysis {
  if (operations.length === 0) {
    return {
      operations: [],
      totalGraphQLCalls: 0,
      averageGraphQLDuration: 0,
    }
  }

  // Find specific operation: FindOffersForUserV2
  const findOffersOp = operations.find(op => op.operationName === 'FindOffersForUserV2')

  // Calculate average duration
  const totalDuration = operations.reduce((sum, op) => sum + op.duration, 0)
  const averageGraphQLDuration = totalDuration / operations.length

  // Find slowest operation
  const slowestGraphQLOperation = [...operations].sort((a, b) => b.duration - a.duration)[0]

  return {
    operations,
    findOffersForUserV2: findOffersOp,
    totalGraphQLCalls: operations.length,
    averageGraphQLDuration,
    slowestGraphQLOperation,
  }
}

/**
 * Full GraphQL analysis pipeline
 */
export async function runGraphQLAnalysis(page: Page): Promise<GraphQLAnalysis> {
  // Try to get intercepted operations first (more accurate)
  let operations = await getInterceptedGraphQLOperations(page)

  // Fallback to Resource Timing API if no intercepted operations
  if (operations.length === 0) {
    operations = await collectGraphQLOperations(page)
  }

  return analyzeGraphQLOperations(operations)
}

/**
 * Generate GraphQL report
 */
export function generateGraphQLReport(analysis: GraphQLAnalysis): string {
  const lines: string[] = []

  lines.push('')
  lines.push('='.repeat(60))
  lines.push('🔍 GRAPHQL OPERATIONS ANALYSIS')
  lines.push('='.repeat(60))
  lines.push('')

  if (analysis.totalGraphQLCalls === 0) {
    lines.push('❌ No GraphQL operations detected')
    lines.push('')
    return lines.join('\n')
  }

  lines.push(`📊 Total GraphQL Calls: ${analysis.totalGraphQLCalls}`)
  lines.push(`⏱️  Average Duration: ${analysis.averageGraphQLDuration.toFixed(0)}ms`)
  lines.push('')

  // Highlight FindOffersForUserV2 if found
  if (analysis.findOffersForUserV2) {
    const op = analysis.findOffersForUserV2
    lines.push('🎯 FindOffersForUserV2 Operation:')
    lines.push(`   Duration: ${op.duration.toFixed(0)}ms`)
    lines.push(`   Size: ${(op.size / 1024).toFixed(2)} KB`)
    lines.push(`   Status: ${op.responseStatus || 'N/A'}`)
    lines.push('')
  } else {
    lines.push('⚠️  FindOffersForUserV2 operation not found')
    lines.push('')
  }

  // Show slowest operation
  if (analysis.slowestGraphQLOperation) {
    const op = analysis.slowestGraphQLOperation
    lines.push('🐌 Slowest GraphQL Operation:')
    lines.push(`   ${op.operationName}: ${op.duration.toFixed(0)}ms`)
    lines.push('')
  }

  // List all operations
  if (analysis.operations.length > 0) {
    lines.push('📋 All GraphQL Operations:')
    const sortedOps = [...analysis.operations].sort((a, b) => b.duration - a.duration)
    sortedOps.forEach((op, index) => {
      const highlight = op.operationName === 'FindOffersForUserV2' ? ' 🎯' : ''
      lines.push(`   ${index + 1}. ${op.operationName}${highlight}: ${op.duration.toFixed(0)}ms`)
    })
    lines.push('')
  }

  lines.push('='.repeat(60))
  lines.push('')

  return lines.join('\n')
}
