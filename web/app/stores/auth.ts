import { defineStore } from 'pinia'

interface User {
  id: number
  name: string
  employeeCode: string
  role: 'EMPLOYEE' | 'SUPERVISOR' | 'ADMIN'
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null as string | null,
    user: null as User | null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
  },
  actions: {
    hydrate() {
      if (import.meta.client) {
        this.token = localStorage.getItem('token')
        const rawUser = localStorage.getItem('user')
        this.user = rawUser ? JSON.parse(rawUser) : null
      }
    },
    setSession(token: string, user: User) {
      this.token = token
      this.user = user
      if (import.meta.client) {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
      }
    },
    logout() {
      this.token = null
      this.user = null
      if (import.meta.client) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    },
  },
})
