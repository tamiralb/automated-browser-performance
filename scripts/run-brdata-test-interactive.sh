#!/bin/bash

# BRData API Test - Interactive Runner
# This script will prompt for credentials and run the test

set -e

echo ""
echo "======================================================================"
echo "  BRData API Test - Interactive Runner"
echo "======================================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from the automated-browser-performance directory"
    exit 1
fi

echo "This script will:"
echo "  1. Prompt for your BRData credentials"
echo "  2. Generate a bearer token"
echo "  3. Test the simple offers endpoint"
echo ""

# Prompt for credentials
read -p "Enter BRData Client ID: " CLIENT_ID
read -p "Enter BRData App ID (e.g., 33): " APP_ID
read -s -p "Enter BRData Secret Key: " SECRET_KEY
echo ""
read -p "Enter Customer/Loyalty Number (optional, press Enter to skip): " CUSTOMER_NUM
echo ""

# Validate inputs
if [ -z "$CLIENT_ID" ] || [ -z "$APP_ID" ] || [ -z "$SECRET_KEY" ]; then
    echo "❌ Error: Client ID, App ID, and Secret Key are required"
    exit 1
fi

echo ""
echo "Configuration:"
echo "  Client ID: $CLIENT_ID"
echo "  App ID: $APP_ID"
echo "  Secret Key: ${SECRET_KEY:0:10}..."
if [ -n "$CUSTOMER_NUM" ]; then
    echo "  Customer Number: $CUSTOMER_NUM"
fi
echo ""

read -p "Is this correct? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "======================================================================"
echo "  Step 1: Generating Bearer Token"
echo "======================================================================"
echo ""

# Generate token
if [ -n "$CUSTOMER_NUM" ]; then
    # With customer number - will also test the endpoint
    npx tsx get-brdata-token.ts \
        --clientId "$CLIENT_ID" \
        --appId "$APP_ID" \
        --secretKey "$SECRET_KEY" \
        --customerNum "$CUSTOMER_NUM"

    TOKEN_EXIT_CODE=$?

    if [ $TOKEN_EXIT_CODE -ne 0 ]; then
        echo ""
        echo "❌ Failed to generate token or test endpoint"
        exit 1
    fi

    echo ""
    echo "======================================================================"
    echo "  ✅ Test Complete!"
    echo "======================================================================"
    echo ""
    echo "The simple endpoint was already tested above."
    echo ""
else
    # Without customer number - just get token
    OUTPUT=$(npx tsx get-brdata-token.ts \
        --clientId "$CLIENT_ID" \
        --appId "$APP_ID" \
        --secretKey "$SECRET_KEY" 2>&1)

    echo "$OUTPUT"

    # Extract token from output
    BEARER_TOKEN=$(echo "$OUTPUT" | grep "Token:" | sed 's/.*Token: //' | sed 's/\.\.\.//' | tr -d '\n' | tr -d ' ')

    if [ -z "$BEARER_TOKEN" ]; then
        echo ""
        echo "❌ Failed to extract bearer token"
        exit 1
    fi

    echo ""
    echo "======================================================================"
    echo "  Step 2: Run Full Performance Test (Optional)"
    echo "======================================================================"
    echo ""
    echo "To run a full performance test, you need a customer/loyalty number."
    echo ""
    read -p "Enter Customer Number (or press Enter to skip): " CUSTOMER_NUM_TEST

    if [ -n "$CUSTOMER_NUM_TEST" ]; then
        echo ""
        read -p "How many requests? (default: 1): " REQUEST_COUNT
        REQUEST_COUNT=${REQUEST_COUNT:-1}

        echo ""
        echo "Running test with $REQUEST_COUNT request(s)..."
        echo ""

        if [ "$REQUEST_COUNT" -eq 1 ]; then
            npm run test:brdata -- \
                --appId "$APP_ID" \
                --customerNum "$CUSTOMER_NUM_TEST" \
                --token "$BEARER_TOKEN"
        else
            npm run test:brdata -- \
                --appId "$APP_ID" \
                --customerNum "$CUSTOMER_NUM_TEST" \
                --token "$BEARER_TOKEN" \
                --count "$REQUEST_COUNT"
        fi

        echo ""
        echo "======================================================================"
        echo "  ✅ Test Complete!"
        echo "======================================================================"
        echo ""
        echo "Reports saved to:"
        echo "  - ./reports/brdata-api-results.json"
        echo "  - ./reports/brdata-api-results.csv"
        echo ""
    else
        echo ""
        echo "Skipped full test."
        echo ""
        echo "To run later, use:"
        echo "  npm run test:brdata -- \\"
        echo "    --appId $APP_ID \\"
        echo "    --customerNum <CUSTOMER_NUMBER> \\"
        echo "    --token $BEARER_TOKEN"
        echo ""
    fi
fi

echo ""
echo "💡 TIP: The bearer token is valid for 29 days."
echo "   Save it securely to reuse without regenerating."
echo ""
