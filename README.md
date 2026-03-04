# Automated Browser Performance Testing

Automated performance testing for Instacart storefront using Playwright.

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

### Basic Performance Test (No Authentication)

```bash
npm test
```

### Authenticated Performance Test (Recommended)

```bash
npm run test:authenticated
```

### Lighthouse Test

```bash
npm run test:lighthouse
```

### Custom Configuration

```bash
# Use different base URL
BASE_URL=http://www.instacart.com.test:8081 npm run test:authenticated

# Use different test account
EMAIL=your-test@instacart.com VERIFICATION_CODE=123456 npm run test:authenticated
```

## Test Credentials (Local/Bento Only)

**Default test account:**
- Email: `anvar.gazizov@instacart.com`
- Verification Code: `671415`
- Base URL: `http://www.instacart.com.test:8081`

⚠️ **Note**: The verification code `671415` is a static test code that only works in local/bento environments.

## Performance Targets

| Metric                   | Target  | Warning | Critical |
|--------------------------|---------|---------|----------|
| **HTML Size (compressed)**| <300 KB | >400 KB | >800 KB  |
| **Total Scripts**        | <90     | >100    | >120     |
| **Blocking Scripts**     | 0       | >2      | >5       |
| **First Paint**          | <1800ms | >2500ms | >3500ms  |
| **DOM Content Loaded**   | <2500ms | >3500ms | >5000ms  |

## What Gets Measured

### Performance Metrics
- ⏱️ Total page load time
- 📦 HTML size (compressed & uncompressed)
- 🗜️ Compression ratio
- 📜 Script count (total & blocking)
- ⚡ First Paint timing
- 📊 DOM Content Loaded timing
- ✅ Load Complete timing

### Compression Check
- Verifies gzip/brotli compression is enabled
- Reports compression ratio

### Script Analysis
- Total number of `<script>` tags
- Number of blocking scripts (without async/defer)

## Files

```
automated-browser-performance/
├── package.json                        # Dependencies and scripts
├── auth.ts                            # Login/authentication logic
├── performance-test.ts                # Basic test (no auth)
├── performance-test-authenticated.ts  # Full test with login
├── README.md                          # This file
└── reports/                           # Generated reports (gitignored)
    └── lighthouse-report.html
```

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

## CI Integration

The authenticated test returns structured metrics that can be used in CI:

```typescript
const metrics = await runAuthenticatedPerformanceTest()
if (metrics.htmlSize > 400000) {
  throw new Error('HTML size exceeds threshold')
}
```

## Related Documentation

- [Store Performance Test Plan](../carrot/customers/store/client/crossRetailerExperience/docs/projects/performance-analysis/home/TEST-PLAN.md)
- [Monitoring Strategy](../carrot/customers/store/client/crossRetailerExperience/docs/projects/performance-analysis/home/MONITORING-STRATEGY.md)
- [Web Vitals Implementation](../carrot/customers/store/client/store/platform/shared/performance/WebVitals.tsx)

## License

MIT
