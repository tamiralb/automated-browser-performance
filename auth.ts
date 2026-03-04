import type { Page } from 'playwright'

export const BASE_URL = process.env.BASE_URL || 'http://www.instacart.com.test:8081'
export const EMAIL = process.env.EMAIL || 'anvar.gazizov@instacart.com'
export const VERIFICATION_CODE = process.env.VERIFICATION_CODE || '671415'

interface LoginResponse {
  status: number
  ok: boolean
  data: unknown
}

/**
 * Logs into Instacart using verification code authentication
 * This is designed for local/bento test environments only
 */
export async function loginToInstacart(page: Page): Promise<void> {
  console.log('🔐 Logging in...')

  await page.goto(`${BASE_URL}/store`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })

  const graphqlUrl = `${BASE_URL}/graphql?operationName=CreateUserSessionFromVerificationCode`

  const response = await page.evaluate(
    async ({
      url,
      email,
      verificationCode,
      baseUrl,
    }: {
      url: string
      email: string
      verificationCode: string
      baseUrl: string
    }) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-identifier': 'web',
          Origin: baseUrl,
          Referer: `${baseUrl}/`,
        },
        body: JSON.stringify({
          operationName: 'CreateUserSessionFromVerificationCode',
          variables: {
            identifier: email,
            identifier_type: 'email',
            verification_code: verificationCode,
          },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: '79d3f635ea7a24c79c9621938c5e879634040bdd0b20b32f28f2eda9b1a0860a',
            },
          },
        }),
        credentials: 'include',
      })

      return {
        status: res.status,
        ok: res.ok,
        data: await res.json().catch(() => null),
      }
    },
    { url: graphqlUrl, email: EMAIL, verificationCode: VERIFICATION_CODE, baseUrl: BASE_URL }
  )

  const { status, data } = response as LoginResponse
  if (status !== 200) {
    throw new Error(`Login failed (${status}): ${JSON.stringify(data)}`)
  }

  console.log('✅ Login successful')

  // Reload to ensure session is applied
  await page.goto(`${BASE_URL}/store`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
}
