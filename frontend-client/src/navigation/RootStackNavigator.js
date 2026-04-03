import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';

import HomeScreen from '../screens/HomeScreen';
import UploadFoodScreen from '../screens/UploadFoodScreen';
import DashboardScreen from '../screens/DashboardScreen';
import { ROUTES } from '../constants/routes';

enableScreens();

const Stack = createNativeStackNavigator();

export default function RootStackNavigator() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={ROUTES.HOME}>
          <Stack.Screen
            name={ROUTES.HOME}
            component={HomeScreen}
            options={{ title: 'Home' }}
          />
          <Stack.Screen
            name={ROUTES.UPLOAD_FOOD}
            component={UploadFoodScreen}
            options={{ title: 'Upload Food' }}
          />
          <Stack.Screen
            name={ROUTES.DASHBOARD}
            component={DashboardScreen}
            options={{ title: 'Dashboard' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

