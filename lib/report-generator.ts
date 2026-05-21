/**
 * Unified reporting utilities for all performance tests
 */

import type {
  MetricEvaluation,
  MetricStatus,
  WebVitalsResult,
  LighthouseResult,
  ResourceTimingResult,
  ComprehensiveTestResult,
  ConsoleReport,
  JSONReport,
} from './metrics-types.js'

// ============================================================================
// Status Helpers
// ============================================================================

export function getStatusEmoji(status: MetricStatus): string {
  switch (status) {
    case 'good':
      return '✅'
    case 'needs-improvement':
      return '⚠️'
    case 'poor':
      return '❌'
  }
}

export function getStatusColor(status: MetricStatus): string {
  switch (status) {
    case 'good':
      return '\x1b[32m' // Green
    case 'needs-improvement':
      return '\x1b[33m' // Yellow
    case 'poor':
      return '\x1b[31m' // Red
  }
}

const RESET_COLOR = '\x1b[0m'

// ============================================================================
// Console Report Generation
// ============================================================================

export function generateConsoleReport(
  title: string,
  evaluations: MetricEvaluation[],
  summary: { good: number; needsImprovement: number; poor: number }
): string {
  const lines: string[] = []

  lines.push('')
  lines.push('='.repeat(60))
  lines.push(`📊 ${title}`)
  lines.push('='.repeat(60))
  lines.push('')

  evaluations.forEach((evaluation) => {
    const emoji = getStatusEmoji(evaluation.status)
    const color = getStatusColor(evaluation.status)
    const valueStr = `${evaluation.value.toFixed(evaluation.unit === 'score' ? 3 : 0)}${evaluation.unit}`

    lines.push(`${emoji} ${color}${evaluation.name}: ${valueStr}${RESET_COLOR}`)
  })

  lines.push('')
  lines.push('📈 Summary:')
  lines.push(`   ✅ Good: ${summary.good}`)
  lines.push(`   ⚠️  Needs Improvement: ${summary.needsImprovement}`)
  lines.push(`   ❌ Poor: ${summary.poor}`)
  lines.push('')
  lines.push('='.repeat(60))
  lines.push('')

  return lines.join('\n')
}

// ============================================================================
// Web Vitals Report
// ============================================================================

export function generateWebVitalsConsoleReport(result: WebVitalsResult): string {
  return generateConsoleReport(
    'WEB VITALS TEST RESULTS',
    result.evaluations,
    result.summary
  )
}

export function generateWebVitalsJSONReport(result: WebVitalsResult): JSONReport {
  return {
    testType: 'web-vitals',
    timestamp: result.timestamp,
    success: result.success,
    metrics: result.metrics,
    evaluations: result.evaluations,
    summary: result.summary,
  }
}

// ============================================================================
// Lighthouse Report
// ============================================================================

export function generateLighthouseConsoleReport(result: LighthouseResult): string {
  return generateConsoleReport(
    'LIGHTHOUSE TEST RESULTS',
    result.evaluations,
    result.summary
  )
}

export function generateLighthouseJSONReport(result: LighthouseResult): JSONReport {
  return {
    testType: 'lighthouse',
    timestamp: result.timestamp,
    success: result.success,
    metrics: result.metrics,
    evaluations: result.evaluations,
    summary: result.summary,
  }
}

// ============================================================================
// Resource Timing Report
// ============================================================================

export function generateResourceTimingConsoleReport(result: ResourceTimingResult): string {
  const lines: string[] = []

  lines.push('')
  lines.push('='.repeat(60))
  lines.push('📊 RESOURCE TIMING TEST RESULTS')
  lines.push('='.repeat(60))
  lines.push('')

  // Overall metrics
  lines.push('📦 Overall Metrics:')
  lines.push(`   Total Resources: ${result.metrics.totalResources}`)
  lines.push(`   Total Transfer Size: ${(result.metrics.totalTransferSize / 1024).toFixed(2)} KB`)
  lines.push(`   Compression Ratio: ${result.metrics.compression.compressionRatio.toFixed(2)}x`)
  lines.push('')

  // Category breakdown
  lines.push('📁 Resource Categories:')
  Object.entries(result.metrics.categories).forEach(([category, stats]) => {
    if (stats.count > 0) {
      lines.push(`   ${category}: ${stats.count} resources, ${(stats.totalSize / 1024).toFixed(2)} KB`)
    }
  })
  lines.push('')

  // Bottlenecks
  if (result.metrics.bottlenecks.slowest.length > 0) {
    lines.push('🐌 Slowest Resources (Top 10):')
    result.metrics.bottlenecks.slowest.slice(0, 10).forEach((resource, index) => {
      const name = resource.name.split('/').pop() || resource.name
      lines.push(`   ${index + 1}. ${name}: ${resource.duration.toFixed(0)}ms`)
    })
    lines.push('')
  }

  if (result.metrics.bottlenecks.renderBlocking.length > 0) {
    lines.push('🚫 Render-Blocking Resources:')
    result.metrics.bottlenecks.renderBlocking.slice(0, 5).forEach((resource) => {
      const name = resource.name.split('/').pop() || resource.name
      lines.push(`   - ${name}`)
    })
    lines.push('')
  }

  // Evaluations
  lines.push('🎯 Threshold Evaluations:')
  result.evaluations.forEach((evaluation) => {
    const emoji = getStatusEmoji(evaluation.status)
    const color = getStatusColor(evaluation.status)
    const valueStr = `${evaluation.value.toFixed(0)}${evaluation.unit}`
    lines.push(`${emoji} ${color}${evaluation.name}: ${valueStr}${RESET_COLOR}`)
  })
  lines.push('')

  // Summary
  lines.push('📈 Summary:')
  lines.push(`   ✅ Good: ${result.summary.good}`)
  lines.push(`   ⚠️  Needs Improvement: ${result.summary.needsImprovement}`)
  lines.push(`   ❌ Poor: ${result.summary.poor}`)
  lines.push('')
  lines.push('='.repeat(60))
  lines.push('')

  return lines.join('\n')
}

export function generateResourceTimingJSONReport(result: ResourceTimingResult): JSONReport {
  return {
    testType: 'resource-timing',
    timestamp: result.timestamp,
    success: result.success,
    metrics: result.metrics,
    evaluations: result.evaluations,
    summary: result.summary,
  }
}

// ============================================================================
// Comprehensive Report
// ============================================================================

export function generateComprehensiveConsoleReport(result: ComprehensiveTestResult): string {
  const lines: string[] = []

  lines.push('')
  lines.push('='.repeat(80))
  lines.push('🎯 COMPREHENSIVE PERFORMANCE TEST RESULTS')
  lines.push('='.repeat(80))
  lines.push('')

  // Overall summary
  lines.push('📊 Overall Summary:')
  lines.push(`   Total Tests: ${result.summary.totalTests}`)
  lines.push(`   ✅ Passed: ${result.summary.passed}`)
  lines.push(`   ⚠️  Warnings: ${result.summary.warnings}`)
  lines.push(`   ❌ Failed: ${result.summary.failed}`)
  lines.push(`   Success: ${result.success ? '✅ YES' : '❌ NO'}`)
  lines.push('')

  // Web Vitals summary
  lines.push('🌐 Web Vitals:')
  lines.push(`   Good: ${result.webVitals.summary.good}, Needs Improvement: ${result.webVitals.summary.needsImprovement}, Poor: ${result.webVitals.summary.poor}`)
  result.webVitals.evaluations.forEach((evaluation) => {
    const emoji = getStatusEmoji(evaluation.status)
    lines.push(`   ${emoji} ${evaluation.name}: ${evaluation.value.toFixed(evaluation.unit === 'score' ? 3 : 0)}${evaluation.unit}`)
  })
  lines.push('')

  // Lighthouse summary
  lines.push('💡 Lighthouse:')
  lines.push(`   Good: ${result.lighthouse.summary.good}, Needs Improvement: ${result.lighthouse.summary.needsImprovement}, Poor: ${result.lighthouse.summary.poor}`)
  result.lighthouse.evaluations.forEach((evaluation) => {
    const emoji = getStatusEmoji(evaluation.status)
    lines.push(`   ${emoji} ${evaluation.name}: ${evaluation.value.toFixed(evaluation.unit === 'score' ? 1 : 0)}${evaluation.unit}`)
  })
  lines.push('')

  // Resource Timing summary
  lines.push('📦 Resource Timing:')
  lines.push(`   Good: ${result.resourceTiming.summary.good}, Needs Improvement: ${result.resourceTiming.summary.needsImprovement}, Poor: ${result.resourceTiming.summary.poor}`)
  lines.push(`   Total Resources: ${result.resourceTiming.metrics.totalResources}`)
  lines.push(`   Total Transfer: ${(result.resourceTiming.metrics.totalTransferSize / 1024).toFixed(2)} KB`)
  lines.push(`   Render-Blocking: ${result.resourceTiming.metrics.bottlenecks.renderBlocking.length}`)
  lines.push('')

  lines.push('='.repeat(80))
  lines.push('')

  return lines.join('\n')
}

export function generateComprehensiveJSONReport(result: ComprehensiveTestResult): string {
  return JSON.stringify({
    testType: 'comprehensive',
    timestamp: result.timestamp,
    success: result.success,
    summary: result.summary,
    webVitals: {
      metrics: result.webVitals.metrics,
      evaluations: result.webVitals.evaluations,
      summary: result.webVitals.summary,
    },
    lighthouse: {
      metrics: result.lighthouse.metrics,
      evaluations: result.lighthouse.evaluations,
      summary: result.lighthouse.summary,
    },
    resourceTiming: {
      metrics: result.resourceTiming.metrics,
      evaluations: result.resourceTiming.evaluations,
      summary: result.resourceTiming.summary,
    },
  }, null, 2)
}

// ============================================================================
// HTML Report Generation (Basic)
// ============================================================================

export function generateBasicHTMLReport(
  title: string,
  timestamp: string,
  evaluations: MetricEvaluation[],
  summary: { good: number; needsImprovement: number; poor: number }
): string {
  const getStatusClass = (status: MetricStatus) => {
    switch (status) {
      case 'good': return 'status-good'
      case 'needs-improvement': return 'status-warning'
      case 'poor': return 'status-poor'
    }
  }

  const metricsRows = evaluations.map((evaluation) => `
    <tr class="${getStatusClass(evaluation.status)}">
      <td>${evaluation.name}</td>
      <td>${evaluation.value.toFixed(evaluation.unit === 'score' ? 3 : 0)}${evaluation.unit}</td>
      <td>${evaluation.status}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #0066cc;
      padding-bottom: 10px;
    }
    .timestamp {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 20px;
    }
    .summary {
      display: flex;
      gap: 20px;
      margin: 20px 0;
    }
    .summary-card {
      flex: 1;
      padding: 15px;
      border-radius: 8px;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      font-size: 0.9em;
      color: #666;
    }
    .summary-card .value {
      font-size: 2em;
      font-weight: bold;
    }
    .summary-card.good .value { color: #22c55e; }
    .summary-card.warning .value { color: #f59e0b; }
    .summary-card.poor .value { color: #ef4444; }
    table {
      width: 100%;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-collapse: collapse;
      overflow: hidden;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .status-good { background: #f0fdf4; }
    .status-warning { background: #fffbeb; }
    .status-poor { background: #fef2f2; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="timestamp">Generated: ${timestamp}</div>

  <div class="summary">
    <div class="summary-card good">
      <h3>✅ Good</h3>
      <div class="value">${summary.good}</div>
    </div>
    <div class="summary-card warning">
      <h3>⚠️ Needs Improvement</h3>
      <div class="value">${summary.needsImprovement}</div>
    </div>
    <div class="summary-card poor">
      <h3>❌ Poor</h3>
      <div class="value">${summary.poor}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th>Value</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${metricsRows}
    </tbody>
  </table>
</body>
</html>
  `.trim()
}

// ============================================================================
// Comprehensive HTML Dashboard
// ============================================================================

export function generateComprehensiveHTMLReport(result: ComprehensiveTestResult): string {
  const getStatusClass = (status: MetricStatus) => {
    switch (status) {
      case 'good': return 'status-good'
      case 'needs-improvement': return 'status-warning'
      case 'poor': return 'status-poor'
    }
  }

  const renderMetricsTable = (title: string, evaluations: MetricEvaluation[]) => {
    const rows = evaluations.map((evaluation) => `
      <tr class="${getStatusClass(evaluation.status)}">
        <td>${evaluation.name}</td>
        <td>${evaluation.value.toFixed(evaluation.unit === 'score' ? 3 : 0)}${evaluation.unit}</td>
        <td><span class="status-badge ${getStatusClass(evaluation.status)}">${evaluation.status}</span></td>
      </tr>
    `).join('')

    return `
      <div class="test-section">
        <h2>${title}</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprehensive Performance Test Results</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    header {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1a202c;
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .timestamp {
      color: #718096;
      font-size: 1em;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
    }
    .summary-card h3 {
      font-size: 0.9em;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 15px;
    }
    .summary-card .value {
      font-size: 3em;
      font-weight: bold;
      line-height: 1;
    }
    .summary-card.total .value { color: #4299e1; }
    .summary-card.good .value { color: #48bb78; }
    .summary-card.warning .value { color: #ed8936; }
    .summary-card.poor .value { color: #f56565; }
    .test-section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .test-section h2 {
      color: #1a202c;
      font-size: 1.8em;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 3px solid #667eea;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th {
      background: #f7fafc;
      padding: 15px;
      text-align: left;
      font-weight: 600;
      color: #2d3748;
      border-bottom: 2px solid #e2e8f0;
    }
    td {
      padding: 15px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .status-good { background: #f0fff4; }
    .status-warning { background: #fffaf0; }
    .status-poor { background: #fff5f5; }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.85em;
      font-weight: 600;
      text-transform: capitalize;
    }
    .status-badge.status-good {
      background: #c6f6d5;
      color: #22543d;
    }
    .status-badge.status-warning {
      background: #feebc8;
      color: #7c2d12;
    }
    .status-badge.status-poor {
      background: #fed7d7;
      color: #742a2a;
    }
    .final-verdict {
      background: white;
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .final-verdict h2 {
      font-size: 2em;
      margin-bottom: 10px;
    }
    .final-verdict.success h2 {
      color: #48bb78;
    }
    .final-verdict.failure h2 {
      color: #f56565;
    }
    .final-verdict p {
      color: #718096;
      font-size: 1.1em;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎯 Comprehensive Performance Test Results</h1>
      <div class="timestamp">Generated: ${result.timestamp}</div>
    </header>

    <div class="summary-grid">
      <div class="summary-card total">
        <h3>Total Tests</h3>
        <div class="value">${result.summary.totalTests}</div>
      </div>
      <div class="summary-card good">
        <h3>✅ Passed</h3>
        <div class="value">${result.summary.passed}</div>
      </div>
      <div class="summary-card warning">
        <h3>⚠️ Warnings</h3>
        <div class="value">${result.summary.warnings}</div>
      </div>
      <div class="summary-card poor">
        <h3>❌ Failed</h3>
        <div class="value">${result.summary.failed}</div>
      </div>
    </div>

    ${renderMetricsTable('🌐 Web Vitals', result.webVitals.evaluations)}
    ${renderMetricsTable('💡 Lighthouse Performance', result.lighthouse.evaluations)}
    ${renderMetricsTable('📦 Resource Timing', result.resourceTiming.evaluations)}

    <div class="final-verdict ${result.success ? 'success' : 'failure'}">
      <h2>${result.success ? '✅ All Tests Passed' : '❌ Some Tests Failed'}</h2>
      <p>${result.success
        ? 'All performance metrics are within acceptable thresholds'
        : `${result.summary.failed} metric(s) are in poor status and need attention`
      }</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}
