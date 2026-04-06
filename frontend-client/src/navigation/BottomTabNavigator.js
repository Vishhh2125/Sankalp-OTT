import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import ReelsScreen from '../screens/ReelsScreen';
import ForYouScreen from '../screens/ForYouScreen';
import MyListScreen from '../screens/MyListScreen';
import ProfileStackNavigator from './ProfileStackNavigator';
import { ROUTES } from '../constants/routes';
import { theme } from '../constants/theme';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  [ROUTES.HOME]: { active: 'home', inactive: 'home-outline' },
  [ROUTES.FOR_YOU]: { active: 'play-circle', inactive: 'play-circle-outline' },
  [ROUTES.MY_LIST]: { active: 'bookmark', inactive: 'bookmark-outline' },
  [ROUTES.PROFILE]: { active: 'person-circle', inactive: 'person-circle-outline' },
};

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName={ROUTES.HOME}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.crimson,
        tabBarInactiveTintColor: theme.gray,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name={ROUTES.HOME}
        component={ReelsScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name={ROUTES.FOR_YOU}
        component={ForYouScreen}
        options={{ tabBarLabel: 'For You' }}
      />
      <Tab.Screen
        name={ROUTES.MY_LIST}
        component={MyListScreen}
        options={{ tabBarLabel: 'My List' }}
      />
      <Tab.Screen
        name={ROUTES.PROFILE}
        component={ProfileStackNavigator}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
