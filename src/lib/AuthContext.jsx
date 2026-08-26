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
      .select('display_name, group_id')
      .eq('id', currentUser.id)
      .maybeSingle()

    setProfile(data)
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
