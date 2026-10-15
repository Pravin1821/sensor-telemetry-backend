import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth';
import LoginScreen from './src/screens/LoginScreen';
import DeviceListScreen from './src/screens/DeviceListScreen';
import DeviceDetailScreen from './src/screens/DeviceDetailScreen';
import { colors, mono } from './src/theme';

const Stack = createNativeStackNavigator();

function Root() {
  const { token, ready } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.header }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.header },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: mono, fontSize: 14 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {token ? (
          <>
            <Stack.Screen name="Devices" component={DeviceListScreen} options={{ title: 'FIELD MONITOR' }} />
            <Stack.Screen
              name="Device"
              component={DeviceDetailScreen}
              options={({ route }) => ({
                title: route.params.label || `Device ${route.params.deviceId}`,
              })}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}