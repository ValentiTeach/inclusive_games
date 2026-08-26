import { createContext, useContext } from 'react'

export const AuthContext = createContext({
  user: null,
  profile: null,
  loading: false,
  refreshProfile: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}
