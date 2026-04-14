import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BottomTabNavigator from './BottomTabNavigator';
import ShowPlayerScreen from '../screens/ShowPlayerScreen';
import { ROUTES } from '../constants/routes';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.MAIN_TABS} component={BottomTabNavigator} />
      <Stack.Screen
        name={ROUTES.SHOW_PLAYER}
        component={ShowPlayerScreen}
        options={{
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
    </Stack.Navigator>
  );
}
