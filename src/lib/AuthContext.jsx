import { useCallback, useEffect, useState } from 'react'
import { supabase, isCloudConfigured } from './supabaseClient'
import { migrateLocalHistoryOnce } from './cloudSync'
import { flushOutbox, flushWhenOnline } from './outbox'
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
      const registeredName = currentUser.user_metadata?.display_name
      const { data: created } = await supabase
        .from('profiles')
        .insert({
          id: currentUser.id,
          display_name: registeredName || currentUser.email?.split('@')[0] || 'Вчитель',
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
        const userId = session.user.id
        /*
         * Спершу стара історія гостя, потім черга: обидві пишуть у results, і
         * порядок тут лише для передбачуваності — дублікатів не буде в жодному
         * разі, їх відкидає унікальний індекс. Невдача перенесення не спиняє
         * чергу: це дві незалежні доставки. Сама невдача, як і досі, доходить
         * до журналу падінь як необроблена обіцянка.
         */
        migrateLocalHistoryOnce(userId).finally(() => flushOutbox(userId))
        refreshProfile(session.user)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [refreshProfile])

  /*
   * Мережа повернулась — відправити те, що назбиралось без неї. Без цього гра,
   * зіграна офлайн, чекала б наступної гри чи наступного входу, а вчитель
   * тим часом дивився б на неповну групу.
   */
  const userId = user?.id ?? null
  useEffect(() => flushWhenOnline(userId), [userId])

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
