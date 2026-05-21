# Usage Guide

## Authentication

### Save cookies (one-time setup)
```bash
npm run save-cookies -- <url> cookies/<retailer>.json
# Example:
npm run save-cookies -- https://shop.broulims.com cookies/broulims.json
```

### Check authentication status
```bash
npm run check-auth -- cookies/broulims.json
```

---

## Browser Performance Tests

### Test a specific retailer
```bash
# With saved cookies (recommended)
npm run test:retailer -- broulims --cookies cookies/broulims.json

# With manual login (opens browser, waits for ENTER)
npm run test:retailer:auth -- broulims

# Without authentication (public pages)
npm run test:retailer -- broulims
```

### List available retailers
```bash
npm run test:retailer:list
```

### Test all retailers
```bash
npm run test:retailer:all -- --cookies cookies/broulims.json
npm run test:retailer:all:auth
```

---

## GraphQL Tests

### Single-page GraphQL analysis
```bash
# With cookies
npm run test:graphql -- <url> --cookies cookies/broulims.json

# With manual login
npm run test:graphql -- <url> --auth
```

### Volume / soak test (multiple browsers)
```bash
npm run test:volume -- <url> --cookies cookies/broulims.json \
  --browsers 10 --refresh 10 --duration 1800

# Broulims example (10 browsers, 10s refresh, 30 minutes):
npx tsx tests/volume-test.ts \
  "https://shop.broulims.com/store/broulims-supermarket/pages/in-store-deals" \
  --cookies cookies/broulims.json \
  --browsers 10 --refresh 10 --duration 1800
```

---

## BRData API Tests

### Single retailer
```bash
npm run test:brdata -- \
  --appId <appId> \
  --customerNum <customerNum> \
  --token <bearerToken>

# Sequential requests
npm run test:brdata -- --appId 33 --customerNum 1234567890 --token abc123 --count 10

# Volume test with concurrency
npm run test:brdata -- --appId 33 --customerNum 1234567890 --token abc123 \
  --volume 100 --concurrency 10
```

### All BRData clients
```bash
# Requires config/brdata-clients.json (copy from config/brdata-clients.example.json)
npm run test:brdata:all
```

### Generate BRData bearer token
```bash
npm run brdata:token -- --clientId <id> --appId <appId> --secretKey <key>
```

---

## Reports

All reports are saved to `reports/`:
- `reports/<retailer-id>/comprehensive-report.html` — HTML dashboard
- `reports/<retailer-id>/comprehensive-report.json` — JSON data
- `reports/<retailer-id>/lighthouse-report.html` — Lighthouse audit
- `reports/graphql-analysis.json` — GraphQL operation analysis
- `reports/brdata-api-results.json` / `.csv` — BRData API results
- `reports/brdata-all-clients-results.json` / `.md` / `.csv` — All-clients summary

---

## Configuration

| File | Purpose |
|------|---------|
| `config/retailers.json` | Retailer IDs, names, and URLs |
| `config/performance-budgets.json` | Thresholds for LCP, CLS, TTI, etc. |
| `config/brdata-clients.json` | BRData credentials (gitignored — copy from `.example.json`) |
| `cookies/<retailer>.json` | Saved auth cookies (gitignored) |
