import dns from 'node:dns/promises'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const E164_REGEX = /^\+[1-9]\d{7,14}$/
const DNS_TIMEOUT_MS = 2500
const domainCheckCache = new Map()

function withTimeout(promise, ms = DNS_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('dns-timeout')), ms)),
  ])
}

function toText(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function normalizeEmail(email) {
  return toText(email).toLowerCase()
}

function inferCountryCode(location = '') {
  const loc = toText(location).toLowerCase()
  if (!loc) return ''
  if (loc.includes('india') || loc.includes('mumbai') || loc.includes('delhi') || loc.includes('bangalore')) return '91'
  if (loc.includes('usa') || loc.includes('united states') || loc.includes('new york') || loc.includes('california')) return '1'
  if (loc.includes('uk') || loc.includes('united kingdom') || loc.includes('london')) return '44'
  return ''
}

function normalizePhoneToE164(phone, location = '') {
  const raw = toText(phone)
  if (!raw) return ''

  if (E164_REGEX.test(raw)) return raw

  if (raw.startsWith('00')) {
    const candidate = `+${raw.slice(2).replace(/\D+/g, '')}`
    if (E164_REGEX.test(candidate)) return candidate
  }

  const digits = raw.replace(/\D+/g, '')
  if (!digits) return ''

  if (digits.length >= 11 && digits.length <= 15 && digits[0] !== '0') {
    const candidate = `+${digits}`
    if (E164_REGEX.test(candidate)) return candidate
  }

  if (digits.length === 10) {
    const cc = inferCountryCode(location) || '91'
    const candidate = `+${cc}${digits}`
    if (E164_REGEX.test(candidate)) return candidate
  }

  return ''
}

async function checkDomain(domain) {
  if (domainCheckCache.has(domain)) return domainCheckCache.get(domain)

  const job = (async () => {
    let hasMx = false
    let hasAddress = false

    try {
      const mx = await withTimeout(dns.resolveMx(domain))
      hasMx = Array.isArray(mx) && mx.length > 0
    } catch (_err) {
      hasMx = false
    }

    try {
      const addresses = await withTimeout(dns.resolve(domain))
      hasAddress = Array.isArray(addresses) && addresses.length > 0
    } catch (_err) {
      hasAddress = false
    }

    return {
      hasMx,
      hasAddress,
      domainExists: hasMx || hasAddress,
    }
  })()

  domainCheckCache.set(domain, job)
  return job
}

export async function validateContactInfo({
  email,
  phone,
  location,
}) {
  const normalizedEmail = normalizeEmail(email)
  const hasEmail = Boolean(normalizedEmail)
  const emailFormatValid = hasEmail && EMAIL_REGEX.test(normalizedEmail)

  let emailDomain = ''
  let emailDomainExists = false
  let emailMxValid = false

  if (emailFormatValid) {
    emailDomain = normalizedEmail.split('@')[1] || ''
    if (emailDomain) {
      const domainCheck = await checkDomain(emailDomain)
      emailDomainExists = domainCheck.domainExists
      emailMxValid = domainCheck.hasMx
    }
  }

  const normalizedPhone = normalizePhoneToE164(phone, location)
  const hasPhone = Boolean(toText(phone))
  const phoneE164Valid = Boolean(normalizedPhone) && E164_REGEX.test(normalizedPhone)

  const emailVerified = hasEmail && emailFormatValid && emailDomainExists && emailMxValid
  const phoneVerified = hasPhone && phoneE164Valid
  const contactStatus = emailVerified || phoneVerified ? 'verified' : 'unverified'

  return {
    email_normalized: normalizedEmail || null,
    email_verified: emailVerified,
    email_format_valid: emailFormatValid,
    email_domain_exists: emailDomainExists,
    email_mx_valid: emailMxValid,
    phone_e164: normalizedPhone || null,
    phone_verified: phoneVerified,
    phone_e164_valid: phoneE164Valid,
    contact_status: contactStatus,
  }
}

