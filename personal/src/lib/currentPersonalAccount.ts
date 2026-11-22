import { supabase } from './supabase'

export async function getCurrentPersonalAccountId() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('personal_id')
    .eq('id', user.id)
    .maybeSingle<{ personal_id?: string | null }>()

  if (profileError) throw profileError

  return typeof profile?.personal_id === 'string' && profile.personal_id
    ? profile.personal_id
    : user.id
}
