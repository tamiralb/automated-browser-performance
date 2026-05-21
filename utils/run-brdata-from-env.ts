#!/usr/bin/env tsx
/**
 * Run BRData API Test - Auto-detect credentials
 *
 * This script attempts to extract BRData credentials from:
 * 1. Environment variables
 * 2. .env.local file
 * 3. Fall back to prompting user
 */

import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import * as readline from 'readline'

interface BRDataCredentials {
  clientId: string
  appId: string
  secretKey: string
  baseUrl: string
}

/**
 * Parse YAML-like configuration string
 */
function parseYamlConfig(content: string, key: string): string | null {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith(`${key}:`)) {
      const value = line.split(':')[1]?.trim()
      if (value && value !== key && !value.includes('SECRET') && !value.includes('PLACEHOLDER')) {
        return value
      }
    }
  }
  return null
}

/**
 * Extract BRData credentials from .env file
 */
function extractFromEnvFile(envPath: string): Partial<BRDataCredentials> | null {
  if (!existsSync(envPath)) {
    return null
  }

  try {
    const content = readFileSync(envPath, 'utf-8')

    // Try to find any BRData configuration block
    const brdataMatch = content.match(/brdata:\s*\n([\s\S]*?)(?=\n\w+:|$)/m)
    if (!brdataMatch) {
      return null
    }

    const brdataConfig = brdataMatch[1]

    const clientId = parseYamlConfig(brdataConfig, 'client_id')
    const appId = parseYamlConfig(brdataConfig, 'app_id')
    const secretKey = parseYamlConfig(brdataConfig, 'secret_key')
    const baseUrl = parseYamlConfig(brdataConfig, 'base_url')

    if (clientId && appId && secretKey) {
      return {
        clientId,
        appId,
        secretKey,
        baseUrl: baseUrl || 'https://webservices.brdata.com',
      }
    }

    return null
  } catch (error) {
    console.error(`Error reading ${envPath}:`, error)
    return null
  }
}

/**
 * Try to extract from Rails environment (if running)
 */
function extractFromRails(): Partial<BRDataCredentials> | null {
  try {
    const clientId = execSync(
      'cd ~/Code/carrot/integrations && bundle exec rails runner "puts Current.settings.dig(:brdata, :client_id)" 2>/dev/null',
      { encoding: 'utf-8', timeout: 10000 }
    ).trim()

    const appId = execSync(
      'cd ~/Code/carrot/integrations && bundle exec rails runner "puts Current.settings.dig(:brdata, :app_id)" 2>/dev/null',
      { encoding: 'utf-8', timeout: 10000 }
    ).trim()

    const secretKey = execSync(
      'cd ~/Code/carrot/integrations && bundle exec rails runner "puts Current.settings.dig(:brdata, :secret_key)" 2>/dev/null',
      { encoding: 'utf-8', timeout: 10000 }
    ).trim()

    if (clientId && appId && secretKey && !clientId.includes('Error')) {
      return {
        clientId,
        appId,
        secretKey,
        baseUrl: 'https://webservices.brdata.com',
      }
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * Prompt user for credentials
 */
async function promptForCredentials(): Promise<BRDataCredentials> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve)
    })
  }

  console.log('\n⚠️  Could not auto-detect credentials. Please enter them manually:\n')

  const clientId = await question('Client ID: ')
  const appId = await question('App ID (e.g., 33): ')
  const secretKey = await question('Secret Key: ')

  rl.close()

  return {
    clientId: clientId.trim(),
    appId: appId.trim(),
    secretKey: secretKey.trim(),
    baseUrl: 'https://webservices.brdata.com',
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(70))
  console.log('  BRData API Test - Auto-detect Credentials')
  console.log('='.repeat(70))
  console.log('')

  let credentials: Partial<BRDataCredentials> | null = null

  // Try 1: Environment variables
  console.log('🔍 Checking environment variables...')
  if (process.env.BRDATA_CLIENT_ID && process.env.BRDATA_APP_ID && process.env.BRDATA_SECRET_KEY) {
    credentials = {
      clientId: process.env.BRDATA_CLIENT_ID,
      appId: process.env.BRDATA_APP_ID,
      secretKey: process.env.BRDATA_SECRET_KEY,
      baseUrl: process.env.BRDATA_BASE_URL || 'https://webservices.brdata.com',
    }
    console.log('✅ Found credentials in environment variables')
  } else {
    console.log('❌ Not found in environment variables')
  }

  // Try 2: .env.local
  if (!credentials) {
    console.log('🔍 Checking .env.local...')
    credentials = extractFromEnvFile('../carrot/integrations/.env.local')
    if (credentials?.clientId) {
      console.log('✅ Found credentials in .env.local')
    } else {
      console.log('❌ Not found in .env.local')
    }
  }

  // Try 3: .env.development (might have real values)
  if (!credentials) {
    console.log('🔍 Checking .env.development...')
    credentials = extractFromEnvFile('../carrot/integrations/.env.development')
    if (credentials?.clientId) {
      console.log('✅ Found credentials in .env.development')
    } else {
      console.log('❌ Not found in .env.development (likely has placeholders)')
    }
  }

  // Try 4: Rails runner (if Rails is available)
  if (!credentials) {
    console.log('🔍 Trying to extract from Rails console...')
    credentials = extractFromRails()
    if (credentials?.clientId) {
      console.log('✅ Found credentials from Rails')
    } else {
      console.log('❌ Could not extract from Rails')
    }
  }

  // Try 5: Prompt user
  if (!credentials?.clientId || !credentials?.appId || !credentials?.secretKey) {
    const fullCredentials = await promptForCredentials()
    credentials = fullCredentials
  }

  if (!credentials.clientId || !credentials.appId || !credentials.secretKey) {
    console.error('\n❌ Error: Could not obtain valid credentials\n')
    process.exit(1)
  }

  console.log('')
  console.log('Configuration:')
  console.log(`  Client ID: ${credentials.clientId}`)
  console.log(`  App ID: ${credentials.appId}`)
  console.log(`  Secret Key: ${credentials.secretKey.substring(0, 10)}...`)
  console.log(`  Base URL: ${credentials.baseUrl}`)
  console.log('')

  // Get customer number
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const customerNum = await new Promise<string>((resolve) => {
    rl.question('Enter Customer/Loyalty Number for testing: ', resolve)
  })
  rl.close()

  if (!customerNum.trim()) {
    console.error('\n❌ Error: Customer number is required\n')
    process.exit(1)
  }

  console.log('')
  console.log('='.repeat(70))
  console.log('  Running BRData API Test')
  console.log('='.repeat(70))
  console.log('')

  // Run the test
  try {
    execSync(
      `npx tsx utils/get-brdata-token.ts ` +
      `--clientId "${credentials.clientId}" ` +
      `--appId "${credentials.appId}" ` +
      `--secretKey "${credentials.secretKey}" ` +
      `--customerNum "${customerNum.trim()}" ` +
      `--baseUrl "${credentials.baseUrl}"`,
      { stdio: 'inherit' }
    )

    console.log('')
    console.log('='.repeat(70))
    console.log('  ✅ Test Complete!')
    console.log('='.repeat(70))
    console.log('')
  } catch (error) {
    console.error('\n❌ Test failed\n')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
