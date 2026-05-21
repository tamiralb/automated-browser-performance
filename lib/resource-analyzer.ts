/**
 * Resource Timing analysis utilities
 * Collects and analyzes Resource Timing API data from the browser
 */

import type { Page } from 'playwright'
import type {
  ResourceEntry,
  ResourceCategoryStats,
  ResourceTimingMetrics,
  ResourceTimingResult,
  ResourceThresholdRange,
  MetricEvaluation,
  MetricStatus,
  PerformanceBudgets,
} from './metrics-types.js'

// ============================================================================
// Resource Collection
// ============================================================================

/**
 * Collects all resource timing entries from the page via the Resource Timing API
 */
export async function collectResourceEntries(page: Page): Promise<ResourceEntry[]> {
  return page.evaluate(() => {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

    return entries.map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      duration: entry.duration,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      renderBlockingStatus: (entry as any).renderBlockingStatus || undefined,
      startTime: entry.startTime,
    }))
  })
}

// ============================================================================
// Resource Categorization
// ============================================================================

type ResourceCategory = keyof ResourceTimingMetrics['categories']

const CATEGORY_MAP: Record<string, ResourceCategory> = {
  script: 'script',
  link: 'stylesheet',
  css: 'stylesheet',
  img: 'image',
  font: 'font',
  xmlhttprequest: 'xhr',
  fetch: 'fetch',
}

function categorizeResource(entry: ResourceEntry): ResourceCategory {
  return CATEGORY_MAP[entry.initiatorType] || 'other'
}

function createEmptyStats(): ResourceCategoryStats {
  return { count: 0, totalSize: 0, totalDuration: 0, averageDuration: 0 }
}

/**
 * Categorizes resources and computes aggregate stats per category
 */
export function categorizeResources(
  entries: ResourceEntry[]
): ResourceTimingMetrics['categories'] {
  const categories: ResourceTimingMetrics['categories'] = {
    script: createEmptyStats(),
    stylesheet: createEmptyStats(),
    image: createEmptyStats(),
    font: createEmptyStats(),
    xhr: createEmptyStats(),
    fetch: createEmptyStats(),
    other: createEmptyStats(),
  }

  for (const entry of entries) {
    const category = categorizeResource(entry)
    const stats = categories[category]
    stats.count++
    stats.totalSize += entry.transferSize
    stats.totalDuration += entry.duration
  }

  // Compute averages
  for (const stats of Object.values(categories)) {
    stats.averageDuration = stats.count > 0 ? stats.totalDuration / stats.count : 0
  }

  return categories
}

// ============================================================================
// Bottleneck Detection
// ============================================================================

const SLOW_RESOURCE_THRESHOLD_MS = 500
const LARGE_RESOURCE_THRESHOLD_BYTES = 500 * 1024 // 500 KB

/**
 * Identifies performance bottlenecks among resources
 */
export function identifyBottlenecks(
  entries: ResourceEntry[]
): ResourceTimingMetrics['bottlenecks'] {
  const slowest = [...entries]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10)

  const renderBlocking = entries.filter(
    (entry) => entry.renderBlockingStatus === 'blocking'
  )

  const largeResources = entries
    .filter((entry) => entry.transferSize > LARGE_RESOURCE_THRESHOLD_BYTES)
    .sort((a, b) => b.transferSize - a.transferSize)

  return { slowest, renderBlocking, largeResources }
}

// ============================================================================
// Compression Analysis
// ============================================================================

/**
 * Analyzes compression across all resources
 */
export function analyzeCompression(
  entries: ResourceEntry[]
): ResourceTimingMetrics['compression'] {
  let totalEncoded = 0
  let totalDecoded = 0

  for (const entry of entries) {
    totalEncoded += entry.encodedBodySize
    totalDecoded += entry.decodedBodySize
  }

  const compressionRatio = totalEncoded > 0 ? totalDecoded / totalEncoded : 1

  return { totalEncoded, totalDecoded, compressionRatio }
}

// ============================================================================
// Metrics Aggregation
// ============================================================================

/**
 * Builds full ResourceTimingMetrics from raw resource entries
 */
export function buildResourceTimingMetrics(
  entries: ResourceEntry[]
): ResourceTimingMetrics {
  const totalResources = entries.length
  const totalTransferSize = entries.reduce((sum, e) => sum + e.transferSize, 0)
  const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0)
  const categories = categorizeResources(entries)
  const bottlenecks = identifyBottlenecks(entries)
  const compression = analyzeCompression(entries)

  return {
    totalResources,
    totalTransferSize,
    totalDuration,
    categories,
    bottlenecks,
    compression,
  }
}

// ============================================================================
// Threshold Evaluation
// ============================================================================

function evaluateResourceThreshold(
  value: number,
  threshold: ResourceThresholdRange
): MetricStatus {
  if (value <= threshold.target) return 'good'
  if (value <= threshold.warn) return 'needs-improvement'
  return 'poor'
}

/**
 * Evaluates resource timing metrics against performance budgets
 */
export function evaluateResourceMetrics(
  metrics: ResourceTimingMetrics,
  thresholds: PerformanceBudgets['resourceTiming']
): MetricEvaluation[] {
  const slowResourceCount = metrics.bottlenecks.slowest.filter(
    (r) => r.duration > SLOW_RESOURCE_THRESHOLD_MS
  ).length

  const evaluations: MetricEvaluation[] = [
    {
      name: 'Total Resources',
      value: metrics.totalResources,
      threshold: thresholds.totalResources,
      status: evaluateResourceThreshold(metrics.totalResources, thresholds.totalResources),
      unit: '',
    },
    {
      name: 'Total Transfer Size',
      value: metrics.totalTransferSize / 1024,
      threshold: thresholds.totalTransferSize,
      status: evaluateResourceThreshold(
        metrics.totalTransferSize / 1024,
        thresholds.totalTransferSize
      ),
      unit: ' KB',
    },
    {
      name: 'Total Script Size',
      value: metrics.categories.script.totalSize / 1024,
      threshold: thresholds.totalScriptSize,
      status: evaluateResourceThreshold(
        metrics.categories.script.totalSize / 1024,
        thresholds.totalScriptSize
      ),
      unit: ' KB',
    },
    {
      name: 'Render-Blocking Resources',
      value: metrics.bottlenecks.renderBlocking.length,
      threshold: thresholds.renderBlockingResources,
      status: evaluateResourceThreshold(
        metrics.bottlenecks.renderBlocking.length,
        thresholds.renderBlockingResources
      ),
      unit: '',
    },
    {
      name: 'Slow Resources (>500ms)',
      value: slowResourceCount,
      threshold: thresholds.slowResourcesOver500ms,
      status: evaluateResourceThreshold(slowResourceCount, thresholds.slowResourcesOver500ms),
      unit: '',
    },
  ]

  return evaluations
}

// ============================================================================
// Full Analysis Pipeline
// ============================================================================

/**
 * Runs the full resource timing analysis pipeline:
 * 1. Collects resource entries from the page
 * 2. Builds aggregate metrics
 * 3. Evaluates against thresholds
 * 4. Returns a structured ResourceTimingResult
 */
export async function analyzeResourceTiming(
  page: Page,
  thresholds: PerformanceBudgets['resourceTiming']
): Promise<ResourceTimingResult> {
  const entries = await collectResourceEntries(page)
  const metrics = buildResourceTimingMetrics(entries)
  const evaluations = evaluateResourceMetrics(metrics, thresholds)

  const summary = {
    good: evaluations.filter((e) => e.status === 'good').length,
    needsImprovement: evaluations.filter((e) => e.status === 'needs-improvement').length,
    poor: evaluations.filter((e) => e.status === 'poor').length,
  }

  const success = summary.poor === 0

  return {
    success,
    metrics,
    evaluations,
    summary,
    timestamp: new Date().toISOString(),
  }
}
