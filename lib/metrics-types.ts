/**
 * TypeScript interfaces for all performance metrics, thresholds, and report formats
 */

// ============================================================================
// Threshold Definitions
// ============================================================================

export interface ThresholdRange {
  good: number
  needsImprovement: number
}

export interface ResourceThresholdRange {
  target: number
  warn: number
  critical: number
}

export interface PerformanceBudgets {
  webVitals: {
    lcp: ThresholdRange
    fid: ThresholdRange
    cls: ThresholdRange
    inp: ThresholdRange
    ttfb: ThresholdRange
    fcp: ThresholdRange
  }
  lighthouse: {
    performanceScore: ThresholdRange
    firstContentfulPaint: ThresholdRange
    largestContentfulPaint: ThresholdRange
    timeToInteractive: ThresholdRange
    totalBlockingTime: ThresholdRange
    cumulativeLayoutShift: ThresholdRange
    speedIndex: ThresholdRange
  }
  resourceTiming: {
    totalResources: ResourceThresholdRange
    totalTransferSize: ResourceThresholdRange
    totalScriptSize: ResourceThresholdRange
    renderBlockingResources: ResourceThresholdRange
    slowResourcesOver500ms: ResourceThresholdRange
  }
}

// ============================================================================
// Web Vitals Metrics
// ============================================================================

export interface WebVitalsMetrics {
  lcp: number | null  // Largest Contentful Paint (ms)
  fid: number | null  // First Input Delay (ms)
  cls: number | null  // Cumulative Layout Shift (score)
  inp: number | null  // Interaction to Next Paint (ms)
  ttfb: number | null // Time to First Byte (ms)
  fcp: number | null  // First Contentful Paint (ms)
}

export interface WebVitalsResult {
  success: boolean
  metrics: WebVitalsMetrics
  evaluations: MetricEvaluation[]
  summary: {
    good: number
    needsImprovement: number
    poor: number
  }
  timestamp: string
}

// ============================================================================
// Lighthouse Metrics
// ============================================================================

export interface LighthouseMetrics {
  performanceScore: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  timeToInteractive: number
  totalBlockingTime: number
  cumulativeLayoutShift: number
  speedIndex: number
}

export interface LighthouseResult {
  success: boolean
  metrics: LighthouseMetrics
  evaluations: MetricEvaluation[]
  summary: {
    good: number
    needsImprovement: number
    poor: number
  }
  timestamp: string
  reportPaths: {
    json?: string
    html?: string
  }
}

// ============================================================================
// Resource Timing Metrics
// ============================================================================

export interface ResourceEntry {
  name: string
  initiatorType: string
  duration: number
  transferSize: number
  encodedBodySize: number
  decodedBodySize: number
  renderBlockingStatus?: string
  startTime: number
}

export interface ResourceCategoryStats {
  count: number
  totalSize: number
  totalDuration: number
  averageDuration: number
}

export interface ResourceTimingMetrics {
  totalResources: number
  totalTransferSize: number
  totalDuration: number
  categories: {
    script: ResourceCategoryStats
    stylesheet: ResourceCategoryStats
    image: ResourceCategoryStats
    font: ResourceCategoryStats
    xhr: ResourceCategoryStats
    fetch: ResourceCategoryStats
    other: ResourceCategoryStats
  }
  bottlenecks: {
    slowest: ResourceEntry[]
    renderBlocking: ResourceEntry[]
    largeResources: ResourceEntry[]
  }
  compression: {
    totalEncoded: number
    totalDecoded: number
    compressionRatio: number
  }
}

export interface ResourceTimingResult {
  success: boolean
  metrics: ResourceTimingMetrics
  evaluations: MetricEvaluation[]
  summary: {
    good: number
    needsImprovement: number
    poor: number
  }
  timestamp: string
}

// ============================================================================
// Comprehensive Test Result
// ============================================================================

export interface ComprehensiveTestResult {
  success: boolean
  webVitals: WebVitalsResult
  lighthouse: LighthouseResult
  resourceTiming: ResourceTimingResult
  summary: {
    totalTests: number
    passed: number
    warnings: number
    failed: number
  }
  timestamp: string
}

// ============================================================================
// Metric Evaluation
// ============================================================================

export type MetricStatus = 'good' | 'needs-improvement' | 'poor'

export interface MetricEvaluation {
  name: string
  value: number
  threshold: ThresholdRange | ResourceThresholdRange
  status: MetricStatus
  unit: string
}

// ============================================================================
// Report Formats
// ============================================================================

export interface ConsoleReport {
  title: string
  sections: ConsoleSection[]
  summary: string
}

export interface ConsoleSection {
  heading: string
  lines: string[]
}

export interface JSONReport {
  testType: string
  timestamp: string
  success: boolean
  metrics: any
  evaluations: MetricEvaluation[]
  summary: any
}

export interface HTMLReport {
  title: string
  timestamp: string
  content: string
}
