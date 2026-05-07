import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from './styles';

export default function SideAction({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.sideAction} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={28} color={color || '#fff'} />
      {label ? <Text style={styles.sideLabel}>{label}</Text> : null}
    </TouchableOpacity>
  );
}
