import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProfileScreen from '../screens/ProfileScreen';
import MembershipScreen from '../screens/MembershipScreen';
import MyWallet from '../screens/MyWallet';
import TopUpScreen from '../screens/TopUpScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
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
      <Stack.Screen
        name={ROUTES.MY_WALLET}
        component={MyWallet}
        options={{
          title: 'My Wallet',
          headerShown: true,
          headerStyle: { backgroundColor: theme.deepBlack },
          headerTintColor: theme.white,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name={ROUTES.TOP_UP}
        component={TopUpScreen}
        options={{
          title: 'Top Up',
          headerShown: true,
          headerStyle: { backgroundColor: theme.deepBlack },
          headerTintColor: theme.white,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name={ROUTES.TRANSACTION_HISTORY}
        component={TransactionHistoryScreen}
        options={{
          title: 'Transaction History',
          headerShown: true,
          headerStyle: { backgroundColor: theme.deepBlack },
          headerTintColor: theme.white,
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

