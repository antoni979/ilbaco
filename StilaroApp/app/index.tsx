import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StatusBar, Image, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useEffect } from 'react';

export default function OnboardingScreen() {
    console.log('[OnboardingScreen] Rendering');
    const router = useRouter();
    const { session, isLoading } = useAuth();
    console.log('[OnboardingScreen] Session state:', !!session, 'Loading:', isLoading);

    useEffect(() => {
        if (!isLoading && session) {
            console.log('[OnboardingScreen] Auto-redirecting to closet...');
            router.replace('/(tabs)/closet');
        }
    }, [session, isLoading, router]);

    const handleStart = () => {
        console.log('[OnboardingScreen] Starting login flow...');
        router.push('/login');
    };

    // Mostrar loading mientras verifica la sesión
    if (isLoading) {
        return (
            <View className="flex-1 justify-center items-center bg-[#FAF9F6]">
                <ActivityIndicator size="large" color="#B08968" />
            </View>
        );
    }

    // Si hay sesión, mostrar loading mientras redirige (no mostrar la UI)
    if (session) {
        return (
            <View className="flex-1 justify-center items-center bg-[#FAF9F6]">
                <ActivityIndicator size="large" color="#B08968" />
            </View>
        );
    }

    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isLargeScreen = width > 768;

    // Solo mostrar la pantalla de onboarding si NO hay sesión
    return (
        <LinearGradient
            colors={['#FAF9F6', '#F5F3EE']}
            className="flex-1"
            style={{ flex: 1, minHeight: isWeb ? '100vh' : undefined } as any}
        >
            <StatusBar barStyle="dark-content" />
            <View
                className="flex-1 justify-center items-center"
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}
            >
                {/* Container with max-width for web */}
                <View style={{ width: '100%', maxWidth: isLargeScreen ? 420 : '100%', paddingHorizontal: isLargeScreen ? 0 : 16 }}>
                    {/* Logo */}
                    <View className="items-center mb-16">
                        <Image
                            source={require('../assets/images/logo.jpg')}
                            style={{ width: isLargeScreen ? 200 : 180, height: isLargeScreen ? 200 : 180, marginBottom: 12 }}
                            resizeMode="contain"
                        />
                        <View className="w-20 h-0.5 bg-primary mt-2" />
                        <Text className="text-sm font-display text-gray-500 mt-4 tracking-widest uppercase">
                            Tu Armario Digital
                        </Text>
                    </View>

                    {/* Descripción */}
                    <View className="mb-12 px-4">
                        <Text className="text-gray-600 text-center font-display leading-6 text-base">
                            Organiza tu armario con IA. Descubre combinaciones perfectas y simplifica tu estilo personal.
                        </Text>
                    </View>

                    {/* Botones */}
                    <View style={{ gap: 16 }}>
                        <TouchableOpacity
                            onPress={handleStart}
                            className="bg-primary rounded-2xl py-4 items-center shadow-sm"
                            activeOpacity={0.8}
                            style={isWeb ? { cursor: 'pointer' } as any : {}}
                        >
                            <Text className="text-white font-bold text-base tracking-wide">
                                Comenzar
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.push('/login')}
                            style={isWeb ? { cursor: 'pointer' } as any : {}}
                        >
                            <Text className="text-gray-600 text-center text-sm pt-2">
                                ¿Ya tienes cuenta? <Text className="text-primary font-semibold">Iniciar Sesión</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </LinearGradient>
    );
}
