import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProfileScreen from '../screens/ProfileScreen';
import MembershipScreen from '../screens/MembershipScreen';
import { ROUTES } from '../constants/routes';
import { theme } from '../constants/theme';

const Stack = createNativeStackNavigator();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name={ROUTES.PROFILE}
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={ROUTES.MEMBERSHIP}
        component={MembershipScreen}
        options={{
          title: 'Membership',
          headerShown: true,
          headerStyle: { backgroundColor: theme.deepBlack },
          headerTintColor: theme.white,
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

