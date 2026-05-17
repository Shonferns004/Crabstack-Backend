function normalizeWhitespace(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function normalizeText(value) {
  const out = normalizeWhitespace(value).toLowerCase()
  return out || ''
}

function normalizeEmail(value) {
  const out = normalizeText(value)
  return out.includes('@') ? out : ''
}

function stripUrlNoise(value) {
  const raw = normalizeWhitespace(value)
  if (!raw) return ''

  let candidate = raw
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  try {
    const parsed = new URL(candidate)
    const host = (parsed.hostname || '').toLowerCase().replace(/^www\./, '')
    if (!host) return ''
    return host
  } catch (_err) {
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim()
  }
}

function normalizeLinkedin(value) {
  const raw = normalizeWhitespace(value)
  if (!raw) return ''

  let candidate = raw
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  try {
    const parsed = new URL(candidate)
    const host = (parsed.hostname || '').toLowerCase().replace(/^www\./, '')
    let path = (parsed.pathname || '').toLowerCase().replace(/\/+$/, '')
    path = path || '/'
    return `${host}${path}`
  } catch (_err) {
    return normalizeText(raw)
  }
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D+/g, '')
  return digits || ''
}

function uniqueKeys(keys) {
  return [...new Set(keys.filter(Boolean))]
}

export function buildLeadDedupKeys(lead = {}) {
  const email = normalizeEmail(lead.email)
  const linkedin = normalizeLinkedin(lead.linkedin)
  const website = stripUrlNoise(lead.website)
  const phone = normalizePhone(lead.phone)
  const name = normalizeText(lead.name)
  const location = normalizeText(lead.location)

  return uniqueKeys([
    email ? `email:${email}` : '',
    linkedin ? `linkedin:${linkedin}` : '',
    website ? `website:${website}` : '',
    name && website ? `name_website:${name}|${website}` : '',
    name && phone ? `name_phone:${name}|${phone}` : '',
    name && location ? `name_location:${name}|${location}` : '',
  ])
}

export function buildLeadPrimaryDedupKey(lead = {}) {
  const keys = buildLeadDedupKeys(lead)
  return keys[0] || null
}

export function dedupeLeadRows(rows = [], existingKeys = new Set()) {
  const seenKeys = new Set(existingKeys)
  const dedupedRows = []

  for (const row of rows) {
    const keys = buildLeadDedupKeys(row)
    const isDuplicate = keys.some((key) => seenKeys.has(key))
    if (isDuplicate) continue

    dedupedRows.push(row)
    for (const key of keys) seenKeys.add(key)
  }

  return {
    dedupedRows,
    skippedDuplicates: rows.length - dedupedRows.length,
  }
}

export function getLeadKeySet(rows = []) {
  const set = new Set()
  for (const row of rows) {
    for (const key of buildLeadDedupKeys(row)) set.add(key)
  }
  return set
}

