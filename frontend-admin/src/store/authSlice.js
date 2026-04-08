import { createSlice } from '@reduxjs/toolkit'

// Read initial state from localStorage (handles page refresh)
const storedToken = localStorage.getItem('admin_token')
const storedUser  = (() => {
  try { return JSON.parse(localStorage.getItem('admin_user') || 'null') }
  catch { return null }
})()

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    isAuthenticated: !!storedToken,
    token: storedToken || null,
    user:  storedUser  || null,
  },
  reducers: {
    // localStorage is written in Login.jsx BEFORE dispatching — keeps reducer pure
    loginSuccess(state, action) {
      const { token, user } = action.payload
      state.isAuthenticated = true
      state.token = token
      state.user  = user
    },
    // localStorage is cleared in Topbar.jsx BEFORE dispatching — keeps reducer pure
    logout(state) {
      state.isAuthenticated = false
      state.token = null
      state.user  = null
    },
  },
})

export const { loginSuccess, logout } = authSlice.actions
export default authSlice.reducer

// Selectors
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated
export const selectUser            = (state) => state.auth.user
export const selectToken           = (state) => state.auth.token