export type OwnerCredentials = { user: string; pass: string }

function randomString(length: number) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

export function getOwnerCredentials(): OwnerCredentials {
  const envUser = import.meta.env.VITE_OWNER_USER as string | undefined
  const envPass = import.meta.env.VITE_OWNER_PASS as string | undefined
  if (envUser && envPass) return { user: envUser, pass: envPass }

  const stored = localStorage.getItem('owner_test_creds')
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as OwnerCredentials
      if (parsed?.user && parsed?.pass) return parsed
    } catch {
      localStorage.removeItem('owner_test_creds')
    }
  }
  const creds: OwnerCredentials = { user: `owner-${randomString(6)}`, pass: randomString(10) }
  localStorage.setItem('owner_test_creds', JSON.stringify(creds))
  return creds
}

export function setOwnerCredentials(creds: OwnerCredentials) {
  localStorage.setItem('owner_test_creds', JSON.stringify(creds))
}

export function clearOwnerCredentials() {
  localStorage.removeItem('owner_test_creds')
}

export function isEnvManaged() {
  const envUser = import.meta.env.VITE_OWNER_USER as string | undefined
  const envPass = import.meta.env.VITE_OWNER_PASS as string | undefined
  return !!envUser && !!envPass
}
