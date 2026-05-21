/**
 * Cookie-based authentication
 * Load cookies from a file or JSON to authenticate without manual login
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { Page, BrowserContext } from 'playwright'

export interface CookieData {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface SavedCookies {
  cookies: CookieData[]
  savedAt: string
  url: string
  description?: string
}

/**
 * Load cookies from a JSON file
 */
export function loadCookiesFromFile(filePath: string): CookieData[] {
  if (!existsSync(filePath)) {
    throw new Error(`Cookie file not found: ${filePath}`)
  }

  const content = readFileSync(filePath, 'utf-8')
  const data: SavedCookies = JSON.parse(content)

  console.log(`📂 Loaded ${data.cookies.length} cookies from ${filePath}`)
  console.log(`   Saved at: ${data.savedAt}`)
  if (data.description) {
    console.log(`   Description: ${data.description}`)
  }

  return data.cookies
}

/**
 * Save cookies to a JSON file
 */
export function saveCookiesToFile(
  cookies: CookieData[],
  filePath: string,
  url: string,
  description?: string
): void {
  const data: SavedCookies = {
    cookies,
    savedAt: new Date().toISOString(),
    url,
    description,
  }

  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`💾 Saved ${cookies.length} cookies to ${filePath}`)
}

/**
 * Extract cookies from browser context
 */
export async function extractCookies(context: BrowserContext): Promise<CookieData[]> {
  return await context.cookies()
}

/**
 * Load cookies into browser context
 */
export async function loadCookiesIntoContext(
  context: BrowserContext,
  cookies: CookieData[]
): Promise<void> {
  await context.addCookies(cookies)
  console.log(`🍪 Loaded ${cookies.length} cookies into browser`)
}

/**
 * Load cookies into page (for Lighthouse with auth)
 */
export function cookiesToHeaderString(cookies: CookieData[]): string {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

/**
 * Parse cookies from Netscape/curl format
 * Format: domain	flag	path	secure	expiration	name	value
 */
export function parseCookiesFromNetscape(content: string): CookieData[] {
  const cookies: CookieData[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') continue

    const parts = line.split('\t')
    if (parts.length < 7) continue

    const [domain, , path, secure, expires, name, value] = parts

    cookies.push({
      name,
      value,
      domain,
      path,
      expires: parseInt(expires, 10),
      secure: secure === 'TRUE',
      httpOnly: false,
    })
  }

  return cookies
}

/**
 * Parse cookies from browser DevTools JSON export
 * (Chrome DevTools > Application > Cookies > right-click > Copy)
 */
export function parseCookiesFromDevTools(jsonString: string): CookieData[] {
  try {
    const parsed = JSON.parse(jsonString)

    // If it's already in our format
    if (Array.isArray(parsed) && parsed[0]?.name && parsed[0]?.value) {
      return parsed as CookieData[]
    }

    // If it's a single cookie object
    if (parsed.name && parsed.value) {
      return [parsed as CookieData]
    }

    throw new Error('Unknown cookie format')
  } catch (error) {
    throw new Error(`Failed to parse cookies JSON: ${error}`)
  }
}

/**
 * Interactive cookie input from command line
 */
export function promptForCookieJSON(): CookieData[] {
  console.log('\n📋 Paste your cookies JSON and press ENTER twice:')
  console.log('   (Get from Chrome DevTools > Application > Cookies > right-click > Copy)')
  console.log('')

  // This would need readline in practice
  // For now, we'll support file-based only
  throw new Error('Interactive input not implemented. Please use a file instead.')
}

/**
 * Get default cookie file path
 */
export function getDefaultCookieFilePath(retailerOrSite: string): string {
  return resolve(process.cwd(), `cookies-${retailerOrSite}.json`)
}
