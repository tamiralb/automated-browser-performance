/**
 * Web Vitals collector using Playwright and the web-vitals library
 *
 * Injects the web-vitals library into the page context via page.addInitScript()
 * and collects LCP, FID, CLS, INP, TTFB, and FCP metrics.
 */

import type { Page } from 'playwright'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type {
  WebVitalsMetrics,
  WebVitalsResult,
  MetricEvaluation,
  MetricStatus,
  ThresholdRange,
  PerformanceBudgets,
} from './metrics-types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Resolve the path to the web-vitals library UMD bundle
 */
function getWebVitalsScript(): string {
  const webVitalsPath = resolve(__dirname, '..', 'node_modules', 'web-vitals', 'dist', 'web-vitals.iife.js')
  return readFileSync(webVitalsPath, 'utf-8')
}

/**
 * Load performance budgets from the JSON config
 */
function loadPerformanceBudgets(): PerformanceBudgets {
  const budgetsPath = resolve(__dirname, '..', 'config', 'performance-budgets.json')
  return JSON.parse(readFileSync(budgetsPath, 'utf-8'))
}

/**
 * Evaluate a metric value against a threshold range
 */
function evaluateMetric(value: number, threshold: ThresholdRange): MetricStatus {
  if (value <= threshold.good) return 'good'
  if (value <= threshold.needsImprovement) return 'needs-improvement'
  return 'poor'
}

/**
 * Inject the web-vitals library into the page and set up metric listeners.
 *
 * This must be called BEFORE navigating to the target page so that
 * page.addInitScript() runs before any page script executes.
 */
export async function injectWebVitals(page: Page): Promise<void> {
  const webVitalsScript = getWebVitalsScript()

  await page.addInitScript({
    content: `
      ${webVitalsScript}

      // Store collected metrics on the window object
      window.__webVitalsMetrics = {
        lcp: null,
        fid: null,
        cls: null,
        inp: null,
        ttfb: null,
        fcp: null,
      };

      // Set up listeners for each metric
      if (typeof webVitals !== 'undefined') {
        webVitals.onLCP(function(metric) {
          window.__webVitalsMetrics.lcp = metric.value;
        });
        webVitals.onFID(function(metric) {
          window.__webVitalsMetrics.fid = metric.value;
        });
        webVitals.onCLS(function(metric) {
          window.__webVitalsMetrics.cls = metric.value;
        });
        webVitals.onINP(function(metric) {
          window.__webVitalsMetrics.inp = metric.value;
        });
        webVitals.onTTFB(function(metric) {
          window.__webVitalsMetrics.ttfb = metric.value;
        });
        webVitals.onFCP(function(metric) {
          window.__webVitalsMetrics.fcp = metric.value;
        });
      }
    `,
  })
}

/**
 * Simulate user interactions on the page to trigger FID and INP metrics.
 * These metrics require actual user input to be measured.
 */
export async function simulateUserInteractions(page: Page): Promise<void> {
  // Click on the page body to trigger FID
  await page.mouse.click(640, 400)
  await page.waitForTimeout(500)

  // Scroll down to trigger layout and paint events
  await page.mouse.wheel(0, 300)
  await page.waitForTimeout(500)

  // Click again to help trigger INP
  await page.mouse.click(640, 300)
  await page.waitForTimeout(500)

  // Scroll back up
  await page.mouse.wheel(0, -150)
  await page.waitForTimeout(500)
}

/**
 * Collect the Web Vitals metrics from the page context.
 * Should be called after navigation and user interactions.
 */
export async function collectWebVitalsMetrics(page: Page): Promise<WebVitalsMetrics> {
  return await page.evaluate(() => {
    const m = (window as any).__webVitalsMetrics
    if (!m) {
      return {
        lcp: null,
        fid: null,
        cls: null,
        inp: null,
        ttfb: null,
        fcp: null,
      }
    }
    return {
      lcp: m.lcp,
      fid: m.fid,
      cls: m.cls,
      inp: m.inp,
      ttfb: m.ttfb,
      fcp: m.fcp,
    }
  })
}

/**
 * Evaluate all collected Web Vitals metrics against the performance budgets
 * and return a structured result.
 */
export function evaluateWebVitals(metrics: WebVitalsMetrics): WebVitalsResult {
  const budgets = loadPerformanceBudgets()
  const thresholds = budgets.webVitals
  const evaluations: MetricEvaluation[] = []
  let good = 0
  let needsImprovement = 0
  let poor = 0

  const metricDefs: Array<{
    key: keyof WebVitalsMetrics
    name: string
    thresholdKey: keyof typeof thresholds
    unit: string
  }> = [
    { key: 'lcp', name: 'Largest Contentful Paint', thresholdKey: 'lcp', unit: 'ms' },
    { key: 'fid', name: 'First Input Delay', thresholdKey: 'fid', unit: 'ms' },
    { key: 'cls', name: 'Cumulative Layout Shift', thresholdKey: 'cls', unit: 'score' },
    { key: 'inp', name: 'Interaction to Next Paint', thresholdKey: 'inp', unit: 'ms' },
    { key: 'ttfb', name: 'Time to First Byte', thresholdKey: 'ttfb', unit: 'ms' },
    { key: 'fcp', name: 'First Contentful Paint', thresholdKey: 'fcp', unit: 'ms' },
  ]

  for (const def of metricDefs) {
    const value = metrics[def.key]
    if (value === null) continue

    const threshold = thresholds[def.thresholdKey]
    const status = evaluateMetric(value, threshold)

    evaluations.push({
      name: def.name,
      value,
      threshold,
      status,
      unit: def.unit,
    })

    if (status === 'good') good++
    else if (status === 'needs-improvement') needsImprovement++
    else poor++
  }

  const hasPoor = poor > 0
  return {
    success: !hasPoor,
    metrics,
    evaluations,
    summary: { good, needsImprovement, poor },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Full Web Vitals collection pipeline:
 * 1. Inject web-vitals library
 * 2. Navigate to URL
 * 3. Wait for page to settle
 * 4. Simulate user interactions
 * 5. Collect and evaluate metrics
 */
export async function runWebVitalsCollection(
  page: Page,
  url: string,
): Promise<WebVitalsResult> {
  // Step 1: Inject before navigation
  await injectWebVitals(page)

  // Step 2: Navigate to the target URL
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  })

  // Step 3: Wait for the page to settle and metrics to fire
  await page.waitForTimeout(5000)

  // Step 4: Simulate user interactions to trigger FID/INP
  await simulateUserInteractions(page)

  // Step 5: Give metrics a moment to finalize
  await page.waitForTimeout(1000)

  // Step 6: Collect and evaluate
  const metrics = await collectWebVitalsMetrics(page)
  return evaluateWebVitals(metrics)
}
