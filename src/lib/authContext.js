import { createContext, useContext } from 'react'

export const AuthContext = createContext({ user: null, loading: false })

export function useAuth() {
  return useContext(AuthContext)
}
