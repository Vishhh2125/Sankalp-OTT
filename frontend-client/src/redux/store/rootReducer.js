import { combineReducers } from '@reduxjs/toolkit';

import authReducer from '../slices/authSlice';
import reelsReducer from '../slices/reelsSlice';
import showPlayerReducer from '../slices/showPlayerSlice';
import myListReducer from '../slices/myListSlice';
import promoFlowReducer from '../slices/promoFlowSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  reels: reelsReducer,
  showPlayer: showPlayerReducer,
  myList: myListReducer,
  promoFlow: promoFlowReducer,
});

export default rootReducer;