# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Runs Test Command                       │
│  $ npm run test:comprehensive                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              comprehensive-test.ts (Orchestrator)                │
│  - Coordinates all three testing methods                        │
│  - Manages authentication (single login)                        │
│  - Generates unified reports                                    │
└────┬────────────────────┬───────────────────┬────────────────────┘
     │                    │                   │
     ▼                    ▼                   ▼
┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐
│ Web Vitals  │  │ Resource Timing  │  │   Lighthouse    │
│    Test     │  │      Test        │  │      Test       │
└─────┬───────┘  └────────┬─────────┘  └────────┬────────┘
      │                   │                      │
      │                   │                      │
      ▼                   ▼                      ▼
┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐
│lib/web-     │  │lib/resource-     │  │lib/lighthouse-  │
│vitals-      │  │analyzer.ts       │  │runner.ts        │
│collector.ts │  │                  │  │                 │
└─────┬───────┘  └────────┬─────────┘  └────────┬────────┘
      │                   │                      │
      └───────────────────┴──────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │lib/report-generator.ts│
              │                       │
              │ - Console reports     │
              │ - JSON reports        │
              │ - HTML dashboards     │
              └──────────┬────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   reports/ folder    │
              │                      │
              │ - HTML dashboards    │
              │ - JSON data          │
              │ - Lighthouse reports │
              └──────────────────────┘
```

## Test Flow Diagram

### Comprehensive Test Flow

```
START
  │
  ├─► Launch Playwright Browser (headless=false)
  │
  ├─► Authenticate Once (loginToInstacart)
  │     └─► Store session/cookies
  │
  ├─► Method 1: Web Vitals
  │     ├─► Inject web-vitals library
  │     ├─► Navigate to /store
  │     ├─► Simulate user interactions
  │     ├─► Collect metrics (LCP, FID, CLS, INP, TTFB, FCP)
  │     └─► Evaluate against thresholds
  │
  ├─► Method 2: Resource Timing
  │     ├─► Navigate to /store (fresh)
  │     ├─► Collect Resource Timing API data
  │     ├─► Categorize resources
  │     ├─► Identify bottlenecks
  │     └─► Evaluate against thresholds
  │
  ├─► Close Playwright Browser
  │
  ├─► Method 3: Lighthouse
  │     ├─► Extract cookies from Playwright session
  │     ├─► Launch separate Chrome (with debugging port)
  │     ├─► Run Lighthouse with auth cookies
  │     ├─► Extract performance metrics
  │     ├─► Generate Lighthouse reports
  │     ├─► Close Chrome instance
  │     └─► Evaluate against thresholds
  │
  ├─► Generate Unified Reports
  │     ├─► Combine all three method results
  │     ├─► Create HTML dashboard
  │     ├─► Create JSON report
  │     └─► Print console summary
  │
  └─► EXIT (code 0 if all pass, code 1 if any fail)
```

## Shared Components

### Authentication (auth.ts)

```
┌──────────────────────────────────────────┐
│            auth.ts                       │
│                                          │
│  - BASE_URL (configurable)               │
│  - EMAIL (configurable)                  │
│  - VERIFICATION_CODE (configurable)      │
│                                          │
│  loginToInstacart(page):                 │
│    1. Navigate to /store                 │
│    2. Call GraphQL mutation              │
│    3. Inject authentication              │
│    4. Reload page with session           │
│                                          │
│  Used by: ALL test methods               │
└──────────────────────────────────────────┘
```

### Type System (lib/metrics-types.ts)

```
┌──────────────────────────────────────────┐
│       lib/metrics-types.ts               │
│                                          │
│  Defines TypeScript interfaces for:      │
│                                          │
│  - WebVitalsMetrics                      │
│  - LighthouseMetrics                     │
│  - ResourceTimingMetrics                 │
│  - PerformanceBudgets                    │
│  - MetricEvaluation                      │
│  - TestResults (all methods)             │
│                                          │
│  Ensures type safety across suite        │
└──────────────────────────────────────────┘
```

### Performance Budgets (performance-budgets.json)

```
┌──────────────────────────────────────────┐
│     performance-budgets.json             │
│                                          │
│  {                                       │
│    "webVitals": {                        │
│      "lcp": { "good": 2500, ... }        │
│    },                                    │
│    "lighthouse": {                       │
│      "performanceScore": { "good": 90 }  │
│    },                                    │
│    "resourceTiming": {                   │
│      "totalResources": { "target": 150 } │
│    }                                     │
│  }                                       │
│                                          │
│  Read by: ALL test methods               │
└──────────────────────────────────────────┘
```

## Data Flow

### Web Vitals Data Flow

```
Browser Page
    │
    ├─► web-vitals IIFE injected via page.addInitScript()
    │
    ├─► Listeners set up on window.__webVitalsMetrics
    │     ├─► onLCP() → captures LCP value
    │     ├─► onFID() → captures FID value
    │     ├─► onCLS() → captures CLS value
    │     ├─► onINP() → captures INP value
    │     ├─► onTTFB() → captures TTFB value
    │     └─► onFCP() → captures FCP value
    │
    ├─► User interactions simulated (clicks, scrolls)
    │
    ├─► page.evaluate() extracts window.__webVitalsMetrics
    │
    ├─► Returned to Node.js as WebVitalsMetrics object
    │
    └─► Evaluated against thresholds from performance-budgets.json
         │
         └─► WebVitalsResult (success, metrics, evaluations, summary)
```

### Resource Timing Data Flow

```
Browser Page
    │
    ├─► Page loads, resources downloaded
    │
    ├─► Browser populates performance.getEntriesByType('resource')
    │
    ├─► page.evaluate() extracts all PerformanceResourceTiming entries
    │     │
    │     └─► Returns array of ResourceEntry objects
    │
    ├─► Node.js receives resource entries
    │
    ├─► categorizeResources() → Groups by type (script, stylesheet, etc.)
    │
    ├─► identifyBottlenecks() → Finds slow/blocking/large resources
    │
    ├─► analyzeCompression() → Calculates compression ratios
    │
    ├─► buildResourceTimingMetrics() → Aggregates all data
    │
    └─► evaluateResourceMetrics() → Compares against thresholds
         │
         └─► ResourceTimingResult (success, metrics, evaluations, summary)
```

### Lighthouse Data Flow

```
Playwright Browser (authentication)
    │
    ├─► loginToInstacart(page)
    │
    ├─► context.cookies() → Extract all cookies
    │
    └─► Format as "Cookie: name1=value1; name2=value2"
         │
         ▼
Chrome Instance (Lighthouse)
    │
    ├─► chrome-launcher.launch() → Start Chrome with debugging port
    │
    ├─► lighthouse(url, {
    │     port: chrome.port,
    │     extraHeaders: { Cookie: cookieHeader }
    │   })
    │
    ├─► Lighthouse runs performance audit
    │
    ├─► Returns lhr (Lighthouse HTML Report) object
    │     │
    │     ├─► lhr.categories.performance.score
    │     └─► lhr.audits['first-contentful-paint'].numericValue
    │           lhr.audits['largest-contentful-paint'].numericValue
    │           ... (all metrics)
    │
    ├─► Extract metrics from lhr
    │
    ├─► Save JSON and HTML reports
    │
    ├─► chrome.kill() → Close Chrome
    │
    └─► evaluateMetrics() → Compare against thresholds
         │
         └─► LighthouseResult (success, metrics, evaluations, summary)
```

## Module Dependencies

```
comprehensive-test.ts
    │
    ├─── imports ───┐
    │               │
    │               ├─► auth.ts (BASE_URL, loginToInstacart)
    │               │
    │               ├─► lib/web-vitals-collector.ts
    │               │      └─► imports: lib/metrics-types.ts
    │               │
    │               ├─► lib/resource-analyzer.ts
    │               │      └─► imports: lib/metrics-types.ts
    │               │
    │               ├─► lib/lighthouse-runner.ts
    │               │      ├─► imports: lib/metrics-types.ts
    │               │      ├─► imports: chrome-launcher (npm)
    │               │      ├─► imports: lighthouse (npm)
    │               │      └─► imports: playwright (npm)
    │               │
    │               └─► lib/report-generator.ts
    │                      └─► imports: lib/metrics-types.ts
    │
    └─── reads ─────► performance-budgets.json
```

## Report Generation Pipeline

```
Test Results (all three methods)
    │
    ├─► WebVitalsResult
    ├─► LighthouseResult
    └─► ResourceTimingResult
         │
         ▼
lib/report-generator.ts
    │
    ├─► generateComprehensiveConsoleReport()
    │     └─► Console output with colors and emojis
    │
    ├─► generateComprehensiveJSONReport()
    │     └─► Structured JSON for CI/CD
    │
    └─► generateComprehensiveHTMLReport()
          └─► Interactive HTML dashboard
               │
               ├─► Summary cards (total, passed, warnings, failed)
               ├─► Web Vitals table
               ├─► Lighthouse table
               ├─► Resource Timing table
               └─► Final verdict (pass/fail)
```

## CI/CD Integration Flow

```
GitHub Actions Workflow
    │
    ├─► Checkout code
    │
    ├─► Setup Node.js
    │
    ├─► npm install
    │
    ├─► npm run install-browsers
    │
    ├─► Start bento/server
    │
    ├─► npm run test:comprehensive
    │     │
    │     ├─► Exit code 0 → All tests passed
    │     └─► Exit code 1 → Some tests failed (CI fails)
    │
    ├─► Upload reports as artifacts
    │     └─► reports/comprehensive-report.html
    │         reports/comprehensive-report.json
    │         ...
    │
    └─► (Optional) Send to monitoring service
          └─► Parse JSON reports
              └─► Track metrics over time
```

## Performance Budget Evaluation

```
Each Test Method
    │
    ├─► Collects raw metrics
    │
    ├─► Reads performance-budgets.json
    │
    └─► For each metric:
         │
         ├─► Compare value against thresholds
         │     │
         │     ├─► value ≤ good → ✅ "good"
         │     ├─► value ≤ needsImprovement → ⚠️ "needs-improvement"
         │     └─► value > needsImprovement → ❌ "poor"
         │
         └─► Create MetricEvaluation object
              │
              └─► Added to evaluations array
                   │
                   └─► Summary: count(good), count(needs-improvement), count(poor)
                        │
                        └─► success = (poor === 0)
```

## Key Design Decisions

### Why Separate Chrome Instance for Lighthouse?

```
Playwright Browser          Lighthouse Chrome
     (Test 1 & 2)              (Test 3)
         │                         │
         ├─ Web Vitals            ├─ Performance audit
         ├─ Resource Timing       ├─ Lab environment
         │                        ├─ Specific Chrome flags
         │                        └─ Clean state
         │
    Shared session          Isolated for accuracy
    (realistic UX)          (consistent results)
```

**Reason:** Lighthouse requires specific Chrome flags and a clean environment for consistent, accurate lab metrics. Running it in the same Playwright session could interfere with results.

### Why Inject web-vitals vs Use RUM?

```
Injection Method (Current)        RUM (Real User Monitoring)
         │                                  │
         ├─ Automated testing              ├─ Production data
         ├─ Controlled environment         ├─ Real user devices
         ├─ Repeatable results             ├─ Varies by user
         ├─ CI/CD integration              └─ Requires analytics setup
         └─ Catches regressions
```

**Reason:** Injection allows automated, repeatable testing in development/staging before production deployment.

### Why TypeScript?

- **Type safety** across all modules
- **Autocomplete** in IDEs
- **Catch errors** at compile time
- **Better refactoring** support
- **Clear interfaces** for metrics and results

## Extension Points

### Adding a New Test Method

```
1. Create lib/new-method.ts
   └─► Import types from lib/metrics-types.ts
   └─► Implement collection logic
   └─► Evaluate against budgets
   └─► Return structured result

2. Create new-method-test.ts
   └─► Import from lib/new-method.ts
   └─► Use loginToInstacart() from auth.ts
   └─► Generate reports

3. Add to comprehensive-test.ts
   └─► Import new method
   └─► Add to test sequence
   └─► Include in unified reports

4. Add thresholds to performance-budgets.json
   └─► Define "good" and "needsImprovement" values

5. Update lib/report-generator.ts
   └─► Add report generation for new method
```

### Adding Custom Metrics

```
1. Update lib/metrics-types.ts
   └─► Add new metric to relevant interface

2. Update collection logic
   └─► Extract new metric from browser/API

3. Update performance-budgets.json
   └─► Add thresholds for new metric

4. Update evaluation logic
   └─► Compare new metric against thresholds

5. Update report templates
   └─► Include new metric in reports
```

## Summary

This architecture provides:

✅ **Modularity** - Each test method is independent
✅ **Reusability** - Shared authentication and utilities
✅ **Type Safety** - TypeScript throughout
✅ **Flexibility** - Easy to customize and extend
✅ **CI/CD Ready** - Structured outputs and exit codes
✅ **Maintainability** - Clear separation of concerns

The comprehensive test orchestrates all three methods efficiently while maintaining clean, testable code.
