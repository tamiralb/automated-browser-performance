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

Add `--auto` to skip the "press ENTER" prompt — instead the cookies are saved automatically when you close the browser window:

```bash
npx tsx utils/save-cookies.ts https://shop.maceys.com cookies/maceys.json --auto
```

### Check Auth Status

```bash
npm run check-auth -- cookies/davis.json
```

---

## In-Store Deals Automation

Clip every available coupon on a retailer's deals page, then add every matching product to your cart. Works on all 16 configured retailers (same Instacart-powered storefront platform).

### Quick start

```bash
# 1) Save cookies once (logs into the retailer in a browser)
npx tsx utils/save-cookies.ts https://shop.maceys.com cookies/maceys.json --auto

# 2) Run the full workflow (clip + add in one browser session)
npm run deals:workflow -- --retailer maceys

# Or just one phase
npm run deals:clip -- --retailer maceys
npm run deals:add  -- --retailer maceys
```

The `--retailer <id>` flag auto-derives every other path:

| Flag | Auto-resolves to |
|---|---|
| `--retailer maceys` | URL from `config/retailers.json` |
| | Cookies → `cookies/maceys.json` |
| | State (resume) → `reports/maceys-state.json` |
| | Report → `reports/maceys-added.csv` |

Override any of those with `--cookies`, `--state`, or `--report`. Add `--headless` to run without a visible browser.

Convenience shortcuts (no `--retailer` flag needed):

```bash
npm run lins:workflow      # Lin's Fresh Market
npm run maceys:workflow    # Macey's
```

### Features

| Feature | How |
|---|---|
| **Resume after crash** | State saved to JSON after every coupon — re-run picks up where it stopped |
| **Cookie freshness check** | Warns on startup if cookies are expired |
| **Headless mode** | Pass `--headless` to any script |
| **Skip phases** | `--skip-clip` or `--skip-add` on the workflow script |
| **CSV report** | `reports/<retailer>-added.csv` with every product added |
| **Skip tracking** | Coupons with no Add buttons (out of stock) tracked separately in state |

### Supported retailers

All 16 retailers in `config/retailers.json` work out of the box:

`blairs`, `bowmans`, `broulims`, `clarks`, `dans`, `davis-food-drug`, `dicks`, `digbys`, `fresh-market`, `kents`, `lees`, `lins`, `maceys`, `petersons`, `soelbergs`, `stewarts`

### Example output

```
🛒 [Macey's] navigating to in-store deals (headed)...
✅ Logged in

━━━ Phase 1: clipping coupons ━━━
Round 1: 30 unclipped coupons
...
✅ Clipped 287 total

━━━ Phase 2: adding products ━━━
  🎫 Save $1Save $1.00Expires in 2 days
     +2 (total 2)
  🎫 Save $3Save $3.00Expires in 2 days
     +1 (total 3)
...

━━━ [Macey's] Summary ━━━
  Clipped:  +287 (total 287)
  Added:    +542 (total 542)
  Coupons processed: 287
  Skipped (no Add buttons): 18
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
│   ├── deals-automation.ts      # Shared deals workflow (retailer lookup, state, reports)
│   ├── report-generator.ts      # Console, JSON, and HTML report output
│   └── metrics-types.ts         # Shared TypeScript interfaces
├── utils/
│   ├── save-cookies.ts          # Interactive cookie saver
│   ├── check-auth.ts            # Validate a saved cookie file
│   ├── clip-coupons.ts          # Clip every available coupon on deals page
│   ├── add-coupon-products.ts   # Add every clipped coupon's products to cart
│   ├── deals-workflow.ts        # Clip + add in one browser session
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
