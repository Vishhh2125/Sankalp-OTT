import { createSlice } from '@reduxjs/toolkit'
import { getFirstAllowedPage, canAccessPage } from '../config/permissions.js'
import { normalizeAdminUser, isMainAdmin } from '../utils/adminUser.js'

const storedToken = localStorage.getItem('admin_token')
const storedUser  = normalizeAdminUser((() => {
  try { return JSON.parse(localStorage.getItem('admin_user') || 'null') }
  catch { return null }
})())

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    isAuthenticated: !!storedToken,
    token: storedToken || null,
    user:  storedUser  || null,
  },
  reducers: {
    loginSuccess(state, action) {
      const { token, user } = action.payload
      state.isAuthenticated = true
      state.token = token
      state.user  = normalizeAdminUser(user)
    },
    setUser(state, action) {
      state.user = normalizeAdminUser(action.payload)
    },
    logout(state) {
      state.isAuthenticated = false
      state.token = null
      state.user  = null
    },
  },
})

export const { loginSuccess, setUser, logout } = authSlice.actions
export default authSlice.reducer

export const selectIsAuthenticated = (state) => state.auth.isAuthenticated
export const selectUser            = (state) => state.auth.user
export const selectToken           = (state) => state.auth.token
export const selectIsMainAdmin     = (state) => isMainAdmin(state.auth.user)
export const selectSections        = (state) => state.auth.user?.sections ?? []
export const selectCanAccess       = (pageId) => (state) => {
  return canAccessPage(state.auth.user, pageId)
}
export const selectDefaultPage     = (state) => getFirstAllowedPage(state.auth.user)
