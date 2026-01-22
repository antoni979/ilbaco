import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform, View, ActivityIndicator, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useGenderTheme } from '@/features/theme/hooks';


export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { session, isLoading } = useAuth();
  const { colors, isFemale } = useGenderTheme();
  const router = useRouter();

  console.log('[TabLayout] Rendering. Session:', !!session, 'Loading:', isLoading);

  // IMPORTANTE: useEffect DEBE estar ANTES de cualquier early return
  // Esto cumple con las Reglas de Hooks de React
  useEffect(() => {
    if (!isLoading && !session) {
      const timer = setTimeout(() => {
        router.replace('/login');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [session, isLoading, router]);

  // 1. Loading State
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isFemale ? colors.background : '#FAF9F6' }}>
        <ActivityIndicator size="large" color="#C9A66B" />
      </View>
    );
  }

  // 2. No session - mostrar pantalla vacía mientras redirige
  if (!session) {
    return <View style={{ flex: 1, backgroundColor: '#FAF9F6' }} />;
  }

  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isFemale ? '#FFFFFF' : '#FAF9F6',
          borderTopWidth: 1,
          borderTopColor: isFemale ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.05)',
          elevation: 0,
          height: isWeb ? 70 : 60 + insets.bottom,
          paddingBottom: isWeb ? 10 : insets.bottom + 5,
          paddingTop: 10,
          position: isWeb ? 'fixed' as any : (Platform.OS === 'ios' ? 'absolute' : 'relative'),
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        },
        tabBarActiveTintColor: isFemale ? colors.primary : '#C9A66B',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarLabelStyle: {
          fontFamily: 'Manrope_600SemiBold',
          fontSize: isWeb ? 11 : 10,
          marginTop: 4,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: null,
          title: 'Inicio',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={26} color={color} />,
        }}
        redirect={false}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: 'Armario',
          tabBarIcon: ({ color }) => <MaterialIcons name="checkroom" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'Outfits',
          tabBarIcon: ({ color }) => <MaterialIcons name="style" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
