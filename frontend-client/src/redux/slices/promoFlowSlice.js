import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  /** Set after banner "Start Watching" — Home screen opens drama sheet */
  pendingHomeBanner: null,
};

const promoFlowSlice = createSlice({
  name: 'promoFlow',
  initialState,
  reducers: {
    setPendingHomeBanner(state, action) {
      state.pendingHomeBanner = action.payload;
    },
    clearPendingHomeBanner(state) {
      state.pendingHomeBanner = null;
    },
  },
});

export const { setPendingHomeBanner, clearPendingHomeBanner } = promoFlowSlice.actions;
export default promoFlowSlice.reducer;
