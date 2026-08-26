import { useCallback, useEffect, useState } from 'react'
import { supabase, isCloudConfigured } from './supabaseClient'
import { migrateLocalHistoryOnce } from './cloudSync'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isCloudConfigured)

  const refreshProfile = useCallback(async (currentUser) => {
    if (!currentUser) {
      setProfile(null)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('display_name, group_id, role')
      .eq('id', currentUser.id)
      .maybeSingle()

    if (data) {
      setProfile(data)
      return
    }

    // Every account needs a profile row for its role to mean anything.
    // Anonymous users get one via join_group when they join a group;
    // email accounts have no such step, so they're provisioned here as
    // teachers/psychologists (email sign-up has always been the
    // teacher-facing path — students join by code instead).
    if (!currentUser.is_anonymous) {
      const { data: created } = await supabase
        .from('profiles')
        .insert({
          id: currentUser.id,
          display_name: currentUser.email?.split('@')[0] ?? 'Вчитель',
          role: 'teacher',
        })
        .select('display_name, group_id, role')
        .single()

      setProfile(created ?? null)
      return
    }

    setProfile(null)
  }, [])

  useEffect(() => {
    if (!isCloudConfigured) return undefined

    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null
      setUser(sessionUser)
      setLoading(false)
      if (sessionUser) refreshProfile(sessionUser)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        migrateLocalHistoryOnce(session.user.id)
        refreshProfile(session.user)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [refreshProfile])

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
