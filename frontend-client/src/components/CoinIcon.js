import React from 'react';
import { FontAwesome5 } from '@expo/vector-icons';

import { theme } from '../constants/theme';

/** App-wide coin icon (Font Awesome "coins"). */
export default function CoinIcon({ size = 16, color = theme.gold, style }) {
  return (
    <FontAwesome5 name="coins" size={size} color={color} solid style={style} />
  );
}
