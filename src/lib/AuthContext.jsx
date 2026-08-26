import { useEffect, useState } from 'react'
import { supabase, isCloudConfigured } from './supabaseClient'
import { migrateLocalHistoryOnce } from './cloudSync'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(isCloudConfigured)

  useEffect(() => {
    if (!isCloudConfigured) return undefined

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        migrateLocalHistoryOnce(session.user.id)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}
