import { combineReducers } from '@reduxjs/toolkit';

import authReducer from '../slices/authSlice';
import reelsReducer from '../slices/reelsSlice';
import showPlayerReducer from '../slices/showPlayerSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  reels: reelsReducer,
  showPlayer: showPlayerReducer,
});

export default rootReducer;
