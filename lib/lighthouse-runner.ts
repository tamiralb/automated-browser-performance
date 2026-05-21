/**
 * Lighthouse programmatic runner with optional authentication support
 *
 * Launches Chrome via chrome-launcher, optionally authenticates using
 * Playwright to extract cookies, then runs Lighthouse with those cookies
 * injected via extraHeaders.
 */

import { launch as launchChrome } from 'chrome-launcher'
import { chromium, devices } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

import type {
  LighthouseMetrics,
  LighthouseResult,
  MetricEvaluation,
  MetricStatus,
  ThresholdRange,
  PerformanceBudgets,
} from './metrics-types.js'

// Lighthouse is CJS and has no named exports — use default import
import lighthouse from 'lighthouse'

// ============================================================================
// Types
// ============================================================================

interface LighthouseRunnerOptions {
  url: string
  authenticate?: boolean
  loginFn?: (page: import('playwright').Page) => Promise<void>
  budgets: PerformanceBudgets
  reportDir?: string
}

interface CookieData {
  name: string
  value: string
  domain: string
  path: string
}

// ============================================================================
// Cookie Extraction via Playwright
// ============================================================================

async function extractCookiesWithPlaywright(
  url: string,
  loginFn: (page: import('playwright').Page) => Promise<void>,
): Promise<string> {
  console.log('  Launching Playwright to authenticate...')

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  })

  const page = await context.newPage()

  await loginFn(page)

  const cookies: CookieData[] = await context.cookies()
  await browser.close()

  // Format cookies as a "Cookie" header value
  const cookieHeader = cookies
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')

  console.log(`  Extracted ${cookies.length} cookies from authenticated session`)
  return cookieHeader
}

// ============================================================================
// Lighthouse Execution
// ============================================================================

export async function runLighthouse(options: LighthouseRunnerOptions): Promise<LighthouseResult> {
  const { url, authenticate = false, loginFn, budgets, reportDir = './reports' } = options
  const timestamp = new Date().toISOString()

  console.log('\n--- Lighthouse Programmatic Test ---')
  console.log(`URL: ${url}`)
  console.log(`Authenticated: ${authenticate}`)

  // Step 1: Optionally extract cookies
  let cookieHeader: string | undefined
  if (authenticate) {
    if (!loginFn) {
      throw new Error('loginFn is required when authenticate is true')
    }
    cookieHeader = await extractCookiesWithPlaywright(url, loginFn)
  }

  // Step 2: Launch Chrome with a remote debugging port
  console.log('  Launching Chrome for Lighthouse...')
  const chrome = await launchChrome({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
  })

  try {
    // Step 3: Build Lighthouse config
    const lighthouseFlags: Record<string, unknown> = {
      port: chrome.port,
      output: ['json', 'html'] as string[],
      logLevel: 'error' as const,
      onlyCategories: ['performance'],
    }

    if (cookieHeader) {
      lighthouseFlags.extraHeaders = { Cookie: cookieHeader }
    }

    // Step 4: Run Lighthouse
    console.log('  Running Lighthouse audit...')
    const result = await lighthouse(url, lighthouseFlags)

    if (!result || !result.lhr) {
      throw new Error('Lighthouse returned no results')
    }

    const { lhr } = result

    // Step 5: Extract metrics from the Lighthouse HTML Report object (lhr)
    const audits = lhr.audits
    const perfCategory = lhr.categories?.performance

    const metrics: LighthouseMetrics = {
      performanceScore: (perfCategory?.score ?? 0) * 100,
      firstContentfulPaint: audits['first-contentful-paint']?.numericValue ?? 0,
      largestContentfulPaint: audits['largest-contentful-paint']?.numericValue ?? 0,
      timeToInteractive: audits['interactive']?.numericValue ?? 0,
      totalBlockingTime: audits['total-blocking-time']?.numericValue ?? 0,
      cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue ?? 0,
      speedIndex: audits['speed-index']?.numericValue ?? 0,
    }

    // Step 6: Save reports
    fs.mkdirSync(reportDir, { recursive: true })

    const reportPaths: { json?: string; html?: string } = {}

    // result.report is an array when multiple outputs are requested: [json, html]
    const reports = result.report as string | string[]
    const reportArray = Array.isArray(reports) ? reports : [reports]

    if (reportArray[0]) {
      const jsonPath = path.join(reportDir, 'lighthouse-report.json')
      fs.writeFileSync(jsonPath, reportArray[0], 'utf-8')
      reportPaths.json = jsonPath
      console.log(`  JSON report saved: ${jsonPath}`)
    }

    if (reportArray[1]) {
      const htmlPath = path.join(reportDir, 'lighthouse-report.html')
      fs.writeFileSync(htmlPath, reportArray[1], 'utf-8')
      reportPaths.html = htmlPath
      console.log(`  HTML report saved: ${htmlPath}`)
    }

    // Step 7: Evaluate against thresholds
    const evaluations = evaluateMetrics(metrics, budgets)
    const summary = summarizeEvaluations(evaluations)
    const success = summary.poor === 0

    return {
      success,
      metrics,
      evaluations,
      summary,
      timestamp,
      reportPaths,
    }
  } finally {
    // Step 8: Always close Chrome
    await chrome.kill()
    console.log('  Chrome instance closed')
  }
}

// ============================================================================
// Threshold Evaluation
// ============================================================================

function evaluateMetric(
  name: string,
  value: number,
  threshold: ThresholdRange,
  unit: string,
): MetricEvaluation {
  let status: MetricStatus

  // For performanceScore higher is better (inverted comparison)
  if (name === 'Performance Score') {
    if (value >= threshold.good) {
      status = 'good'
    } else if (value >= threshold.needsImprovement) {
      status = 'needs-improvement'
    } else {
      status = 'poor'
    }
  } else {
    // For timing metrics, lower is better
    if (value <= threshold.good) {
      status = 'good'
    } else if (value <= threshold.needsImprovement) {
      status = 'needs-improvement'
    } else {
      status = 'poor'
    }
  }

  return { name, value, threshold, status, unit }
}

function evaluateMetrics(
  metrics: LighthouseMetrics,
  budgets: PerformanceBudgets,
): MetricEvaluation[] {
  const thresholds = budgets.lighthouse

  return [
    evaluateMetric('Performance Score', metrics.performanceScore, thresholds.performanceScore, ''),
    evaluateMetric('First Contentful Paint', metrics.firstContentfulPaint, thresholds.firstContentfulPaint, 'ms'),
    evaluateMetric('Largest Contentful Paint', metrics.largestContentfulPaint, thresholds.largestContentfulPaint, 'ms'),
    evaluateMetric('Time to Interactive', metrics.timeToInteractive, thresholds.timeToInteractive, 'ms'),
    evaluateMetric('Total Blocking Time', metrics.totalBlockingTime, thresholds.totalBlockingTime, 'ms'),
    evaluateMetric('Cumulative Layout Shift', metrics.cumulativeLayoutShift, thresholds.cumulativeLayoutShift, 'score'),
    evaluateMetric('Speed Index', metrics.speedIndex, thresholds.speedIndex, 'ms'),
  ]
}

function summarizeEvaluations(evaluations: MetricEvaluation[]): {
  good: number
  needsImprovement: number
  poor: number
} {
  return {
    good: evaluations.filter((e) => e.status === 'good').length,
    needsImprovement: evaluations.filter((e) => e.status === 'needs-improvement').length,
    poor: evaluations.filter((e) => e.status === 'poor').length,
  }
}
