# Automated Browser Performance Testing

**Comprehensive performance testing suite** for Instacart storefront with three advanced testing methods:
- **Web Vitals**: Core Web Vitals monitoring (LCP, FID, CLS, INP, TTFB, FCP)
- **Lighthouse**: Programmatic Lighthouse audits with authentication
- **Resource Timing**: Network & resource performance analysis

All tests support authentication and can be run individually or as a unified comprehensive suite.

🛒 **[Test Any of 16 Retailers](./RETAILER-TESTING.md)** - Performance test any configured retailer site with one command.

📖 **[Read the Complete Usage Guide](./USAGE-GUIDE.md)** for in-depth explanations, examples, and troubleshooting.

🔍 **[GraphQL Operations Testing](./GRAPHQL-TESTING.md)** - Track specific GraphQL operations like `FindOffersForUserV2`.

## Prerequisites

- **Bento environment running**: Ensure `customers/proxy` is running on port 8081
  ```bash
  bento status customers/proxy
  bento start customers/proxy  # if not running
  ```

- **Node.js**: Version 18+ recommended

## Setup

```bash
cd ~/code/automated-browser-performance

# Install dependencies
npm install

# Install Playwright browsers
npm run install-browsers
```

## Running Tests

### Comprehensive Test Suite (Recommended)

Run all three testing methods in a single test:

```bash
npm run test:comprehensive
```

This executes:
1. Web Vitals monitoring (LCP, FID, CLS, INP, TTFB, FCP)
2. Resource Timing & Network Analysis
3. Lighthouse programmatic audit

Generates a unified HTML dashboard and JSON reports.

---

### Retailer Testing (NEW!)

Test any of 16 configured retailer sites:

```bash
# List available retailers
npm run test:retailer:list

# Test a specific retailer (public pages)
npm run test:retailer davis-food-drug

# Test with manual authentication
npm run test:retailer davis-food-drug --auth

# Test with saved cookies (fully automated)
npx tsx test-retailer.ts davis-food-drug --cookies cookies/davis.json

# Test all retailers (generates comparison report)
npm run test:retailer:all
```

**Available retailers:** Davis Food & Drug, Broulim's, Bowman's, Digby's, Peterson's, Lee's, Dan's, Dick's, Fresh Market, Lin's, Macey's, Stewart's, Clark's, Kent's, Soelberg's, Blair's

📖 **[See Retailer Testing Guide](./RETAILER-TESTING.md)** for complete details.
🔐 **[See Authentication Guide](./AUTHENTICATION-GUIDE.md)** for manual login instructions.
🍪 **[See Cookie Guide](./COOKIE-GUIDE.md)** for saving cookies and automated authenticated testing.

---

### GraphQL Operations Testing (NEW!)

Track specific GraphQL operations and their performance:

```bash
# Track FindOffersForUserV2 operation
npx tsx graphql-test.ts https://shop.davisfoodanddrug.com/store/davis-food-drug/pages/in-store-deals
```

**Reports:**
- Duration of `FindOffersForUserV2`
- Response size and status
- All GraphQL operations on the page
- Performance assessment (good/fair/slow)

🔍 **[See GraphQL Testing Guide](./GRAPHQL-TESTING.md)** for complete details.

---

### Individual Test Methods

#### Web Vitals Test

Monitors Google's Core Web Vitals metrics:

```bash
npm run test:web-vitals
```

**Metrics Collected:**
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)
- Interaction to Next Paint (INP)
- Time to First Byte (TTFB)
- First Contentful Paint (FCP)

#### Lighthouse Test

Programmatic Lighthouse audit with authentication:

```bash
npm run test:lighthouse
```

**Metrics Collected:**
- Performance Score (0-100)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Total Blocking Time (TBT)
- Cumulative Layout Shift (CLS)
- Speed Index

#### Resource Timing Test

Network and resource performance analysis:

```bash
npm run test:resource-timing
```

**Analysis Includes:**
- Resource categorization (scripts, styles, images, fonts, XHR)
- Render-blocking resource detection
- Slowest resources (top 10)
- Compression analysis
- Total transfer size breakdown

---

### Legacy Tests

#### Basic Performance Test (No Authentication)

```bash
npm test
```

#### Authenticated Performance Test

```bash
npm run test:authenticated
```

#### Lighthouse CLI Test

```bash
npm run test:lighthouse-cli
```

### Custom Configuration

#### Environment Variables

```bash
# Use different base URL
BASE_URL=http://www.instacart.com.test:8081 npm run test:comprehensive

# Use different test account
EMAIL=your-test@instacart.com VERIFICATION_CODE=123456 npm run test:comprehensive
```

#### Performance Budgets

Modify `performance-budgets.json` to customize thresholds for your project:

```json
{
  "webVitals": {
    "lcp": {
      "good": 2500,
      "needsImprovement": 4000
    }
  },
  "lighthouse": {
    "performanceScore": {
      "good": 90,
      "needsImprovement": 50
    }
  },
  "resourceTiming": {
    "totalResources": {
      "target": 150,
      "warn": 200,
      "critical": 300
    }
  }
}
```

## Test Credentials (Local/Bento Only)

**Default test account:**
- Email: `anvar.gazizov@instacart.com`
- Verification Code: `671415`
- Base URL: `http://www.instacart.com.test:8081`

⚠️ **Note**: The verification code `671415` is a static test code that only works in local/bento environments.

## Performance Budgets

All performance budgets are configured in `performance-budgets.json` and follow Google's recommended thresholds.

### Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** | ≤2500ms | ≤4000ms | >4000ms |
| **FID** | ≤100ms | ≤300ms | >300ms |
| **CLS** | ≤0.1 | ≤0.25 | >0.25 |
| **INP** | ≤200ms | ≤500ms | >500ms |
| **TTFB** | ≤800ms | ≤1800ms | >1800ms |
| **FCP** | ≤1800ms | ≤3000ms | >3000ms |

### Lighthouse Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **Performance Score** | ≥90 | ≥50 | <50 |
| **FCP** | ≤1800ms | ≤3000ms | >3000ms |
| **LCP** | ≤2500ms | ≤4000ms | >4000ms |
| **TTI** | ≤3800ms | ≤7300ms | >7300ms |
| **TBT** | ≤200ms | ≤600ms | >600ms |
| **CLS** | ≤0.1 | ≤0.25 | >0.25 |

### Resource Timing Thresholds

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| **Total Resources** | ≤150 | ≤200 | >300 |
| **Total Transfer Size** | ≤2MB | ≤3MB | >5MB |
| **Total Script Size** | ≤800KB | ≤1.2MB | >2MB |
| **Render-Blocking** | ≤5 | ≤10 | >20 |
| **Slow Resources** | ≤5 | ≤10 | >20 |

## What Gets Measured

### Web Vitals (Method 2)
- **LCP**: Largest Contentful Paint - measures loading performance
- **FID**: First Input Delay - measures interactivity
- **CLS**: Cumulative Layout Shift - measures visual stability
- **INP**: Interaction to Next Paint - measures responsiveness
- **TTFB**: Time to First Byte - measures server response time
- **FCP**: First Contentful Paint - measures initial render

### Lighthouse Audit (Method 3)
- **Performance Score**: Overall performance rating (0-100)
- **FCP**: First Contentful Paint
- **LCP**: Largest Contentful Paint
- **TTI**: Time to Interactive
- **TBT**: Total Blocking Time - measures main thread blocking
- **CLS**: Cumulative Layout Shift
- **Speed Index**: Measures how quickly content is visually displayed

### Resource Timing (Method 4)
- **Resource Categorization**: Scripts, stylesheets, images, fonts, XHR, fetch
- **Aggregate Metrics**: Count, total size, total duration per category
- **Bottleneck Detection**:
  - Top 10 slowest resources
  - Render-blocking resources
  - Large resources (>500KB)
- **Compression Analysis**: Encoded vs decoded size comparison
- **Network Performance**: Transfer sizes, timing breakdowns

### Legacy Tests
- ⏱️ Total page load time
- 📦 HTML size (compressed & uncompressed)
- 🗜️ Compression ratio
- 📜 Script count (total & blocking)
- ⚡ First Paint timing
- 📊 DOM Content Loaded timing

## File Structure

```
automated-browser-performance/
├── package.json                         # Dependencies and scripts
├── performance-budgets.json             # Performance threshold configuration
├── auth.ts                              # Shared authentication logic
├── lib/                                 # Shared utilities
│   ├── metrics-types.ts                 # TypeScript interfaces
│   ├── web-vitals-collector.ts          # Web Vitals collection
│   ├── resource-analyzer.ts             # Resource Timing analysis
│   ├── lighthouse-runner.ts             # Lighthouse programmatic API
│   └── report-generator.ts              # Unified reporting (console, JSON, HTML)
├── web-vitals-test.ts                   # Web Vitals standalone test
├── lighthouse-test.ts                   # Lighthouse standalone test
├── resource-timing-test.ts              # Resource Timing standalone test
├── comprehensive-test.ts                # Unified test runner (all 3 methods)
├── performance-test.ts                  # Legacy: Basic test (no auth)
├── performance-test-authenticated.ts    # Legacy: Full test with login
├── README.md                            # This file
└── reports/                             # Generated reports (gitignored)
    ├── comprehensive-report.html        # Unified HTML dashboard
    ├── comprehensive-report.json        # Unified JSON report
    ├── web-vitals-report.json           # Web Vitals metrics
    ├── resource-timing-report.json      # Resource Timing metrics
    ├── lighthouse-report.json           # Lighthouse metrics
    └── lighthouse-report.html           # Lighthouse HTML report
```

## Architecture

The testing suite follows a **modular architecture** with shared utilities:

### Shared Components
- **`auth.ts`**: Single authentication implementation reused by all tests
- **`lib/metrics-types.ts`**: TypeScript interfaces for type safety across the suite
- **`lib/report-generator.ts`**: Unified reporting for consistent output formats
- **`performance-budgets.json`**: Centralized threshold configuration

### Individual Test Methods
Each testing method is self-contained and can run independently:

1. **Web Vitals** (`web-vitals-test.ts`): Injects the `web-vitals` library into the page context, simulates user interactions to trigger FID/INP, and collects all Core Web Vitals metrics.

2. **Lighthouse** (`lighthouse-test.ts`): Launches a separate Chrome instance with debugging port, authenticates via Playwright to extract cookies, runs Lighthouse programmatically with cookies injected.

3. **Resource Timing** (`resource-timing-test.ts`): Uses browser's native Resource Timing API to analyze all network requests, categorizes resources, and identifies performance bottlenecks.

### Comprehensive Suite
The comprehensive test (`comprehensive-test.ts`) orchestrates all three methods efficiently:
- Authenticates once with Playwright
- Runs Web Vitals and Resource Timing in the same session
- Runs Lighthouse in a separate Chrome instance (required for accurate Lighthouse results)
- Generates unified reports combining all metrics

## Troubleshooting

### "Failed to launch chromium"
```bash
npm run install-browsers
```

### "Navigation timeout"
Ensure bento proxy is running:
```bash
bento restart customers/proxy
```

### "Login failed"
Verify you're using the correct test credentials for your environment.

### Port 8081 not accessible
Check if the store service is running:
```bash
bento status customers/proxy
ss -tlnp | grep 8081
```

## CI/CD Integration

All tests return structured metrics and exit with code 1 if any metric is in "poor" status, making them suitable for CI/CD pipelines.

### Example CI Integration

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Install browsers
        run: npm run install-browsers

      - name: Start bento
        run: bento start customers/proxy

      - name: Run comprehensive performance test
        run: npm run test:comprehensive

      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: performance-reports
          path: reports/
```

### Programmatic Usage

```typescript
import { runWebVitalsCollection } from './lib/web-vitals-collector.js'
import { analyzeResourceTiming } from './lib/resource-analyzer.js'
import { runLighthouse } from './lib/lighthouse-runner.js'

// Run individual tests programmatically
const webVitalsResult = await runWebVitalsCollection(page, url)
const resourceTimingResult = await analyzeResourceTiming(page, budgets.resourceTiming)
const lighthouseResult = await runLighthouse({ url, authenticate: true, loginFn, budgets })

// Check for failures
if (!webVitalsResult.success) {
  console.error('Web Vitals test failed:', webVitalsResult.summary)
  process.exit(1)
}
```

### JSON Output Format

All tests generate structured JSON reports in `reports/` that can be consumed by monitoring tools:

```json
{
  "testType": "web-vitals",
  "timestamp": "2026-03-04T14:30:00.000Z",
  "success": true,
  "metrics": {
    "lcp": 2341,
    "fid": 87,
    "cls": 0.08,
    "inp": 156,
    "ttfb": 623,
    "fcp": 1654
  },
  "evaluations": [...],
  "summary": {
    "good": 5,
    "needsImprovement": 1,
    "poor": 0
  }
}
```

## Related Documentation

- [Store Performance Test Plan](../carrot/customers/store/client/crossRetailerExperience/docs/projects/performance-analysis/home/TEST-PLAN.md)
- [Monitoring Strategy](../carrot/customers/store/client/crossRetailerExperience/docs/projects/performance-analysis/home/MONITORING-STRATEGY.md)
- [Web Vitals Implementation](../carrot/customers/store/client/store/platform/shared/performance/WebVitals.tsx)

## License

MIT
