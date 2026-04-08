import { configureStore } from '@reduxjs/toolkit'
import authReducer       from './authSlice'
import navigationReducer from './navigationSlice'
import dramasReducer     from './dramasSlice'

const store = configureStore({
  reducer: {
    auth:       authReducer,
    navigation: navigationReducer,
    dramas:     dramasReducer,
  },
})

export default store