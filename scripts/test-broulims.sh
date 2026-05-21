#!/bin/bash

# Test BRData API for Broulims
#
# This script will prompt for credentials and run the test
# Broulims SFP Configuration:
#   - Retailer ID: 2475
#   - Store Configuration ID: 1450
#   - Uses BRData plugin

set -e

echo ""
echo "======================================================================"
echo "  BRData API Test - Broulims"
echo "======================================================================"
echo ""

# Check if we're in the right directory
cd "$(dirname "$0")"

echo "Broulims Configuration:"
echo "  Retailer ID: 2475"
echo "  Store Configuration ID: 1450"
echo "  Plugin: BRData"
echo ""

echo "To run this test, you need BRData credentials."
echo ""
echo "Options to get credentials:"
echo "  1. Check 1Password for 'BRData' credentials"
echo "  2. Ask Professional Services team"
echo "  3. Check AWS Secrets Manager"
echo "  4. Run from Integrations service Rails console:"
echo "     > Current.settings.dig(:brdata, :client_id)"
echo "     > Current.settings.dig(:brdata, :app_id)"
echo "     > Current.settings.dig(:brdata, :secret_key)"
echo ""

read -p "Do you have the BRData credentials? (y/n): " HAS_CREDS

if [ "$HAS_CREDS" != "y" ] && [ "$HAS_CREDS" != "Y" ]; then
    echo ""
    echo "Please obtain the credentials first, then run this script again."
    echo ""
    exit 0
fi

echo ""
echo "Enter BRData credentials:"
echo ""

read -p "Client ID: " CLIENT_ID
read -p "App ID (typically 33): " APP_ID
read -s -p "Secret Key: " SECRET_KEY
echo ""
read -p "Customer/Loyalty Number (for testing): " CUSTOMER_NUM
echo ""

# Validate inputs
if [ -z "$CLIENT_ID" ] || [ -z "$APP_ID" ] || [ -z "$SECRET_KEY" ] || [ -z "$CUSTOMER_NUM" ]; then
    echo "❌ Error: All fields are required"
    exit 1
fi

echo ""
echo "Configuration:"
echo "  Client ID: $CLIENT_ID"
echo "  App ID: $APP_ID"
echo "  Secret Key: ${SECRET_KEY:0:10}..."
echo "  Customer Number: $CUSTOMER_NUM"
echo ""

read -p "Proceed with test? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "======================================================================"
echo "  Step 1: Generating Bearer Token"
echo "======================================================================"
echo ""

# Generate token and test
npx tsx get-brdata-token.ts \
    --clientId "$CLIENT_ID" \
    --appId "$APP_ID" \
    --secretKey "$SECRET_KEY" \
    --customerNum "$CUSTOMER_NUM"

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================================================"
    echo "  ✅ Broulims Test Complete!"
    echo "======================================================================"
    echo ""
    echo "The simple endpoint was tested successfully."
    echo ""
    echo "To run a full performance test, extract the token from above and run:"
    echo "  npm run test:brdata -- \\"
    echo "    --appId $APP_ID \\"
    echo "    --customerNum $CUSTOMER_NUM \\"
    echo "    --token <TOKEN_FROM_ABOVE>"
    echo ""
else
    echo ""
    echo "❌ Test failed. Please check the error messages above."
    echo ""
    exit 1
fi
