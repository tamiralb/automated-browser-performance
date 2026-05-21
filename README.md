# Automated Browser Performance Testing

Performance testing suite for retailer storefronts (Instacart-powered) using Playwright. Supports browser-based metrics collection, GraphQL operation tracking, volume/soak testing, and direct BRData API testing.

## Prerequisites

- Node.js 18+
- Chromium (installed via Playwright)

```bash
npm install
npm run install-browsers
```

## Tests

### Retailer Performance Test

Runs a full performance audit (Web Vitals, Resource Timing, Lighthouse) on any configured retailer.

```bash
# List available retailers
npm run test:retailer:list

# Test a specific retailer (public, no auth)
npm run test:retailer davis-food-drug

# Test with manual browser login
npm run test:retailer:auth davis-food-drug

# Test with saved cookies (automated)
npm run test:retailer:cookies davis-food-drug -- --cookies cookies/davis.json

# Test all 16 retailers and generate a comparison report
npm run test:retailer:all
```

**Available retailers:** Davis Food & Drug, Broulim's, Bowman's, Digby's, Peterson's, Lee's, Dan's, Dick's, Fresh Market, Lin's, Macey's, Stewart's, Clark's, Kent's, Soelberg's, Blair's

Retailer URLs are configured in [`config/retailers.json`](config/retailers.json).

---

### GraphQL Operations Test

Intercepts and profiles all GraphQL operations fired during a page load. Useful for tracking specific operations like `FindOffersForUserV2`.

```bash
npm run test:graphql -- https://shop.davisfoodanddrug.com/store/davis-food-drug/pages/in-store-deals
```

Optionally pass a cookie file for authenticated runs:
```bash
npm run test:graphql -- <url> --cookies cookies/davis.json
```

---

### Volume / Soak Test

Opens multiple concurrent browser instances repeatedly loading a URL. Useful for measuring GraphQL performance under load.

```bash
npm run test:volume -- <url> --cookies <cookie-file> --browsers 10 --duration 60
```

| Option | Default | Description |
|--------|---------|-------------|
| `--browsers` | 5 | Number of concurrent browser instances |
| `--duration` | 60 | Test duration in seconds (0 = infinite) |
| `--cookies` | — | Path to cookie file for authenticated runs |

---

### BRData API Test

Directly tests the BRData "Get Coupons for Customer" API endpoint. No browser required.

```bash
# Single request
npm run test:brdata -- --appId 33 --customerNum 1234567890 --token <token>

# Sequential requests (consistency check)
npm run test:brdata -- --appId 33 --customerNum 1234567890 --token <token> --count 10

# Volume test (concurrent requests)
npm run test:brdata -- --appId 33 --customerNum 1234567890 --token <token> --volume 100 --concurrency 10
```

See [`config/brdata-config.example.json`](config/brdata-config.example.json) for all options. Copy it to `config/brdata-config.json` and fill in your credentials (this file is gitignored).

#### Getting a BRData Token

```bash
npm run brdata:token
```

Or run with env vars directly:
```bash
npm run brdata:run
```

---

### BRData Multi-Client Test

Tests BRData across all configured retailer clients in one run.

```bash
npm run test:brdata:all
```

Client configuration lives in [`config/brdata-clients.example.json`](config/brdata-clients.example.json). Copy to `config/brdata-clients.json` and add your credentials.

---

## Authentication

### Save Cookies (one-time setup)

Opens a browser, lets you log in manually, then saves the session cookies to a file for reuse in automated runs.

```bash
npm run save-cookies -- https://shop.davisfoodanddrug.com cookies/davis.json
```

### Check Auth Status

```bash
npm run check-auth -- cookies/davis.json
```

---

## File Structure

```
├── tests/
│   ├── retailer-test.ts         # Browser perf test for any configured retailer
│   ├── graphql-test.ts          # GraphQL operation interceptor & profiler
│   ├── volume-test.ts           # Concurrent browser soak test
│   ├── brdata-api-test.ts       # BRData API performance test
│   └── brdata-clients-test.ts   # BRData multi-client test
├── lib/
│   ├── web-vitals-collector.ts  # Core Web Vitals (LCP, FID, CLS, INP, TTFB, FCP)
│   ├── resource-analyzer.ts     # Resource Timing API analysis
│   ├── lighthouse-runner.ts     # Programmatic Lighthouse
│   ├── graphql-analyzer.ts      # GraphQL interception & analysis
│   ├── api-tester.ts            # BRData HTTP client & concurrency helpers
│   ├── cookie-auth.ts           # Cookie save/load utilities
│   ├── report-generator.ts      # Console, JSON, and HTML report output
│   └── metrics-types.ts         # Shared TypeScript interfaces
├── utils/
│   ├── save-cookies.ts          # Interactive cookie saver
│   ├── check-auth.ts            # Validate a saved cookie file
│   ├── get-brdata-token.ts      # Fetch a BRData bearer token
│   └── run-brdata-from-env.ts   # Run BRData test from env vars
├── config/
│   ├── retailers.json           # Retailer IDs and URLs
│   ├── performance-budgets.json # Performance thresholds
│   ├── brdata-config.example.json
│   └── brdata-clients.example.json
├── scripts/
│   ├── test-broulims.sh
│   ├── test-all-brdata-clients.sh
│   └── run-brdata-test-interactive.sh
└── cookies/                     # Saved cookie files (gitignored)
```

## Performance Budgets

Thresholds are defined in [`config/performance-budgets.json`](config/performance-budgets.json).

### Web Vitals

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤2500ms | ≤4000ms | >4000ms |
| FID | ≤100ms | ≤300ms | >300ms |
| CLS | ≤0.1 | ≤0.25 | >0.25 |
| INP | ≤200ms | ≤500ms | >500ms |
| TTFB | ≤800ms | ≤1800ms | >1800ms |
| FCP | ≤1800ms | ≤3000ms | >3000ms |

### Resource Timing

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Total resources | ≤150 | ≤200 | >300 |
| Total transfer size | ≤2MB | ≤3MB | >5MB |
| Total script size | ≤800KB | ≤1.2MB | >2MB |
| Render-blocking | ≤5 | ≤10 | >20 |

## Reports

Test runs write output to `reports/` (gitignored):
- `reports/*.html` — HTML dashboard
- `reports/*.json` — structured metrics for CI consumption

## CI Integration

All tests exit with code `1` if any metric is in "poor" status, making them drop-in CI gates.

```yaml
- name: Run retailer performance test
  run: npm run test:retailer davis-food-drug
- name: Upload reports
  uses: actions/upload-artifact@v3
  with:
    name: perf-reports
    path: reports/
```
