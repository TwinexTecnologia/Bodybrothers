export type PersonalCredentials = { user: string; pass: string }

function randomString(length: number) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

export function getPersonalCredentials(): PersonalCredentials {
  const envUser = import.meta.env.VITE_PERSONAL_USER as string | undefined
  const envPass = import.meta.env.VITE_PERSONAL_PASS as string | undefined
  if (envUser && envPass) return { user: envUser, pass: envPass }

  const stored = localStorage.getItem('personal_test_creds')
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as PersonalCredentials
      if (parsed?.user && parsed?.pass) return parsed
    } catch {
      localStorage.removeItem('personal_test_creds')
    }
  }
  const creds: PersonalCredentials = { user: `personal-${randomString(6)}`, pass: randomString(10) }
  localStorage.setItem('personal_test_creds', JSON.stringify(creds))
  return creds
}

export function setPersonalCredentials(creds: PersonalCredentials) {
  localStorage.setItem('personal_test_creds', JSON.stringify(creds))
}

export function clearPersonalCredentials() {
  localStorage.removeItem('personal_test_creds')
}

export function isEnvManaged() {
  const envUser = import.meta.env.VITE_PERSONAL_USER as string | undefined
  const envPass = import.meta.env.VITE_PERSONAL_PASS as string | undefined
  return !!envUser && !!envPass
}
