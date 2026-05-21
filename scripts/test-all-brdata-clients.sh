#!/bin/bash

# Test All BRData Clients - Shell Wrapper
#
# This script provides an easy way to test all BRData clients
# with production credentials.

set -e

cd "$(dirname "$0")"

echo ""
echo "======================================================================"
echo "  BRData All Clients Performance Test"
echo "======================================================================"
echo ""
echo "This will test 20 BRData clients with 500 requests each."
echo "Total requests: 10,000"
echo ""
echo "⚠️  IMPORTANT: You need production BRData credentials to run this test."
echo "   The .env.development credentials are test fixtures and will fail."
echo ""

read -p "Do you have production BRData credentials? (y/n): " HAS_CREDS

if [ "$HAS_CREDS" != "y" ] && [ "$HAS_CREDS" != "Y" ]; then
    echo ""
    echo "To obtain production credentials:"
    echo "  1. Check AWS Secrets Manager: aws secretsmanager get-secret-value --secret-id brdata-api-credentials"
    echo "  2. Check 1Password: Search for 'BRData API Credentials'"
    echo "  3. Check Rails console: Current.settings.dig(:brdata, :client_id)"
    echo "  4. Ask your team lead"
    echo ""
    echo "Once you have credentials, edit test-all-brdata-clients.ts:"
    echo "  - Update BRDATA_CONFIG.clientId"
    echo "  - Update BRDATA_CONFIG.appId"
    echo "  - Update BRDATA_CONFIG.secretKey"
    echo ""
    exit 0
fi

echo ""
echo "Credentials configured in test-all-brdata-clients.ts:"
echo "  - Client ID, App ID, Secret Key"
echo ""

read -p "Are the credentials updated in the script? (y/n): " CREDS_UPDATED

if [ "$CREDS_UPDATED" != "y" ] && [ "$CREDS_UPDATED" != "Y" ]; then
    echo ""
    echo "Please update BRDATA_CONFIG in test-all-brdata-clients.ts first."
    echo ""
    exit 0
fi

echo ""
echo "======================================================================"
echo "  Starting Test Run"
echo "======================================================================"
echo ""
echo "This will take approximately 30-60 minutes to complete."
echo "Progress will be shown for each client."
echo ""

read -p "Start testing now? (y/n): " START_TEST

if [ "$START_TEST" != "y" ] && [ "$START_TEST" != "Y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting test run..."
echo ""

# Run the test
npx tsx test-all-brdata-clients.ts

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "======================================================================"
    echo "  ✅ All Tests Complete!"
    echo "======================================================================"
    echo ""
    echo "Reports generated:"
    echo "  - reports/brdata-all-clients-results.json"
    echo "  - reports/brdata-all-clients-summary.md"
    echo "  - reports/brdata-all-clients-results.csv"
    echo ""
else
    echo ""
    echo "======================================================================"
    echo "  ❌ Tests Failed"
    echo "======================================================================"
    echo ""
    echo "Check the error messages above for details."
    echo ""
    exit $EXIT_CODE
fi
