import { StatusBar } from 'expo-status-bar';
import RootStackNavigator from './src/navigation/RootStackNavigator';

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <RootStackNavigator />
    </>
  );
}
