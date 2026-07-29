import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProfileScreen from '../screens/ProfileScreen';
import MembershipScreen from '../screens/MembershipScreen';
import MyWallet from '../screens/MyWallet';
import TopUpScreen from '../screens/TopUpScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import EarnRewardsScreen from '../screens/EarnRewardsScreen';
import MyDetailsScreen from '../screens/MyDetailsScreen';
import CmsViewerScreen from '../screens/CmsViewerScreen';
import DeleteAccountScreen from '../screens/DeleteAccountScreen';
import { ROUTES } from '../constants/routes';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator();

export default function ProfileStackNavigator() {
  const { theme: appTheme } = useTheme();

  const dynamicHeader = {
    headerShown: true,
    headerStyle: { backgroundColor: appTheme.deepBlack },
    headerTintColor: appTheme.white,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: appTheme.deepBlack },
  };

  return (
    <Stack.Navigator
      screenOptions={{ contentStyle: { backgroundColor: appTheme.deepBlack } }}
    >
      <Stack.Screen
        name={ROUTES.PROFILE}
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={ROUTES.MY_DETAILS}
        component={MyDetailsScreen}
        options={{ ...dynamicHeader, title: 'Personal Details' }}
      />
      <Stack.Screen
        name={ROUTES.MEMBERSHIP}
        component={MembershipScreen}
        options={{ ...dynamicHeader, title: 'Membership' }}
      />
      <Stack.Screen
        name={ROUTES.MY_WALLET}
        component={MyWallet}
        options={{ ...dynamicHeader, title: 'My Wallet' }}
      />
      <Stack.Screen
        name={ROUTES.TOP_UP}
        component={TopUpScreen}
        options={{ ...dynamicHeader, title: 'Top Up' }}
      />
      <Stack.Screen
        name={ROUTES.TRANSACTION_HISTORY}
        component={TransactionHistoryScreen}
        options={{ ...dynamicHeader, title: 'Transaction History' }}
      />
      <Stack.Screen
        name={ROUTES.EARN_REWARDS}
        component={EarnRewardsScreen}
        options={{ ...dynamicHeader, title: 'Earn Rewards' }}
      />
      <Stack.Screen
        name={ROUTES.CMS_VIEWER}
        component={CmsViewerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={ROUTES.DELETE_ACCOUNT}
        component={DeleteAccountScreen}
        options={{ ...dynamicHeader, title: 'Delete Account' }}
      />
    </Stack.Navigator>
  );
}