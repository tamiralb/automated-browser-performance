/**
 * BRData Bearer Token Generator
 *
 * Fetches a bearer token from BRData authentication endpoint
 *
 * Usage:
 *   npx tsx get-brdata-token.ts --clientId <clientId> --appId <appId> --secretKey <secretKey>
 *   npx tsx get-brdata-token.ts --clientId abc --appId 33 --secretKey xyz123
 */

import * as crypto from 'crypto'

interface BRDataAuthConfig {
  baseUrl: string
  clientId: string
  appId: string
  secretKey: string
}

/**
 * Generate HMAC-SHA256 signature
 */
function generateSignature(clientId: string, appId: string, timestamp: number, secretKey: string): string {
  const payload = `${clientId}${appId}${timestamp}`
  const hmac = crypto.createHmac('sha256', secretKey)
  hmac.update(payload)
  return hmac.digest('hex')
}

/**
 * Fetch bearer token from BRData
 */
async function fetchBearerToken(config: BRDataAuthConfig): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = generateSignature(config.clientId, config.appId, timestamp, config.secretKey)

  console.log('🔐 Generating bearer token...')
  console.log(`   Base URL: ${config.baseUrl}`)
  console.log(`   Client ID: ${config.clientId}`)
  console.log(`   App ID: ${config.appId}`)
  console.log(`   Timestamp: ${timestamp}`)
  console.log(`   Signature: ${signature.substring(0, 20)}...`)
  console.log('')

  const url = `${config.baseUrl}/api/loyalty/token`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'clientid': config.clientId,
        'appid': config.appId,
        'timestamp': timestamp.toString(),
        'signature': signature,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`)
    }

    const data = await response.json()

    if (!data.JWTAccessToken) {
      throw new Error('No JWTAccessToken in response')
    }

    return data.JWTAccessToken
  } catch (error: any) {
    console.error('❌ Failed to fetch bearer token:', error.message)
    throw error
  }
}

/**
 * Test the simple offers endpoint
 */
async function testSimpleEndpoint(
  baseUrl: string,
  appId: string,
  customerNum: string,
  bearerToken: string
) {
  console.log('🧪 Testing simple offers endpoint...')
  console.log(`   URL: ${baseUrl}/api/Loyalty/${appId}/quotient/${customerNum}/offers/simple`)
  console.log('')

  const startTime = Date.now()

  try {
    const response = await fetch(
      `${baseUrl}/api/Loyalty/${appId}/quotient/${customerNum}/offers/simple`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Accept': 'application/json',
        },
      }
    )

    const endTime = Date.now()
    const duration = endTime - startTime

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`)
    }

    const data = await response.json()

    console.log('✅ API call successful!')
    console.log(`   Duration: ${duration}ms`)
    console.log(`   Status: ${response.status}`)
    console.log('')

    console.log('📊 Offer Counts:')
    console.log(`   Available: ${data.available?.length || 0}`)
    console.log(`   Clipped: ${data.clipped?.length || 0}`)
    console.log(`   Redeemed: ${data.redeemed?.length || 0}`)
    console.log(`   Total: ${(data.available?.length || 0) + (data.clipped?.length || 0) + (data.redeemed?.length || 0)}`)
    console.log('')

    // Show sample offer IDs
    if (data.available && data.available.length > 0) {
      console.log('📝 Sample Available Offers:')
      data.available.slice(0, 5).forEach((offerId: string, index: number) => {
        console.log(`   ${index + 1}. ${offerId}`)
      })
      if (data.available.length > 5) {
        console.log(`   ... and ${data.available.length - 5} more`)
      }
      console.log('')
    }

    return data
  } catch (error: any) {
    const endTime = Date.now()
    const duration = endTime - startTime
    console.error('❌ API call failed:', error.message)
    console.error(`   Duration: ${duration}ms`)
    throw error
  }
}

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const parsed: Record<string, string | undefined> = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2)
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true'
      parsed[key] = value
      if (value !== 'true') i++
    }
  }

  return parsed
}

/**
 * Main execution
 */
async function main() {
  const startTime = new Date()
  const args = parseArgs()

  console.log('\n' + '='.repeat(70))
  console.log('  BRData Bearer Token Generator & Simple API Tester')
  console.log('='.repeat(70))
  console.log('')
  console.log(`Execution Time: ${startTime.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })}`)
  console.log('')

  // Validate required arguments
  if (!args.clientId || !args.appId || !args.secretKey) {
    console.error('❌ Error: Missing required arguments\n')
    console.log('Usage:')
    console.log('  npx tsx get-brdata-token.ts --clientId <clientId> --appId <appId> --secretKey <secretKey>\n')
    console.log('Required:')
    console.log('  --clientId       BRData client ID')
    console.log('  --appId          BRData application ID')
    console.log('  --secretKey      BRData secret key for HMAC signature\n')
    console.log('Optional:')
    console.log('  --customerNum    Customer number to test simple endpoint')
    console.log('  --baseUrl        Override base URL (default: https://webservices.brdata.com)\n')
    console.log('Examples:')
    console.log('  # Get token only')
    console.log('  npx tsx get-brdata-token.ts --clientId abc --appId 33 --secretKey xyz123\n')
    console.log('  # Get token and test simple endpoint')
    console.log('  npx tsx get-brdata-token.ts --clientId abc --appId 33 --secretKey xyz123 --customerNum 1234567890\n')
    process.exit(1)
  }

  const config: BRDataAuthConfig = {
    baseUrl: args.baseUrl || 'https://webservices.brdata.com',
    clientId: args.clientId,
    appId: args.appId,
    secretKey: args.secretKey,
  }

  try {
    // Fetch bearer token
    const bearerToken = await fetchBearerToken(config)

    console.log('✅ Bearer token obtained successfully!')
    console.log(`   Token (truncated): ${bearerToken.substring(0, 50)}...`)
    console.log(`   Length: ${bearerToken.length} characters`)
    console.log('')
    console.log(`FULL_TOKEN:${bearerToken}`)
    console.log('')

    // Test simple endpoint if customer number provided
    if (args.customerNum) {
      await testSimpleEndpoint(config.baseUrl, config.appId, args.customerNum, bearerToken)
    }

    console.log('🎯 To use this token with the full API test, run:')
    console.log(`   npm run test:brdata -- --appId ${config.appId} --customerNum <customerNum> --token ${bearerToken.substring(0, 20)}...`)
    console.log('')

    console.log('📋 Token expires in: 29 days')
    console.log('')

    console.log('='.repeat(70))
    console.log('✅ Complete')
    console.log('='.repeat(70))
    console.log('')

    // Copy to clipboard if available (optional)
    console.log('💡 TIP: Save this token for future use. It expires in 29 days.')
    console.log('')

    return bearerToken
  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    console.log('')
    console.log('Troubleshooting:')
    console.log('  - Verify your client ID, app ID, and secret key are correct')
    console.log('  - Check network connectivity to BRData')
    console.log('  - Ensure the base URL is correct')
    console.log('')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error)
  process.exit(1)
})
