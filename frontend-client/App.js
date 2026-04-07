import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';

import RootStackNavigator from './src/navigation/RootStackNavigator';
import { store } from './src/redux';

export default function App() {
  return (
    <Provider store={store}>
      <StatusBar style="auto" />
      <RootStackNavigator />
    </Provider>
  );
}
