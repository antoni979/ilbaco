import React, { useState } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    async function signInWithEmail() {
        console.log('[LoginScreen] Attempting login with:', email);
        setLoading(true);
        const { error, data } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        console.log('[LoginScreen] Login result:', { error, session: !!data.session });

        if (error) {
            console.error('[LoginScreen] Login error:', error);
            Alert.alert('Error', error.message);
            setLoading(false);
        } else {
            // Navigate back to onboarding, which will detect session and redirect to closet
            console.log('[LoginScreen] Login success, navigating to closet');
            setLoading(false);
            try {
                router.replace('/(tabs)/closet');
            } catch (e) {
                console.error('[LoginScreen] Navigation error:', e);
            }
        }
    }

    async function signUpWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) Alert.alert('Error', error.message);
        else {
            Alert.alert('Éxito', '¡Revisa tu email para confirmar tu cuenta!');
            setIsSignUp(false);
        }
        setLoading(false);
    }

    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isLargeScreen = width > 768;

    return (
        <LinearGradient
            colors={['#FAF9F6', '#F5F3EE']}
            className="flex-1"
            style={{ flex: 1 }}
        >
            <SafeAreaView className="flex-1" edges={['top']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 justify-center items-center px-4"
                    style={isWeb ? { minHeight: '100vh' } : {}}
                >
                    {/* Container with max-width for web */}
                    <View
                        className="w-full"
                        style={{ maxWidth: isLargeScreen ? 400 : '100%', paddingHorizontal: isLargeScreen ? 0 : 16 }}
                    >
                        {/* Logo/Brand */}
                        <View className="items-center mb-12">
                            <Image
                                source={require('../assets/images/logo.jpg')}
                                style={{ width: isLargeScreen ? 180 : 160, height: isLargeScreen ? 180 : 160 }}
                                resizeMode="contain"
                            />
                            <View className="w-16 h-0.5 bg-primary mt-2" />
                            <Text className="text-sm font-display text-gray-500 mt-3 tracking-widest uppercase">
                                Tu Armario Digital
                            </Text>
                        </View>

                        {/* Form */}
                        <View style={{ gap: 16 }}>
                            <View>
                                <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
                                    Email
                                </Text>
                                <TextInput
                                    onChangeText={setEmail}
                                    value={email}
                                    placeholder="tu@email.com"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    className="bg-white border border-gray-200 rounded-2xl px-5 py-4 text-charcoal text-base"
                                    placeholderTextColor="#9CA3AF"
                                    style={isWeb ? { outlineStyle: 'none' } as any : {}}
                                />
                            </View>

                            <View>
                                <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
                                    Contraseña
                                </Text>
                                <TextInput
                                    onChangeText={setPassword}
                                    value={password}
                                    secureTextEntry={true}
                                    placeholder="••••••••"
                                    autoCapitalize="none"
                                    className="bg-white border border-gray-200 rounded-2xl px-5 py-4 text-charcoal text-base"
                                    placeholderTextColor="#9CA3AF"
                                    style={isWeb ? { outlineStyle: 'none' } as any : {}}
                                />
                            </View>
                        </View>

                        {/* Buttons */}
                        <View style={{ marginTop: 32, gap: 12 }}>
                            <TouchableOpacity
                                onPress={isSignUp ? signUpWithEmail : signInWithEmail}
                                disabled={loading}
                                className={`bg-primary rounded-2xl py-4 items-center shadow-sm ${loading ? 'opacity-50' : ''}`}
                                activeOpacity={0.8}
                                style={isWeb ? { cursor: 'pointer' } as any : {}}
                            >
                                <Text className="text-white font-bold text-base tracking-wide">
                                    {loading ? 'Cargando...' : isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setIsSignUp(!isSignUp)}
                                disabled={loading}
                                className="py-3 items-center"
                                style={isWeb ? { cursor: 'pointer' } as any : {}}
                            >
                                <Text className="text-gray-600 text-sm">
                                    {isSignUp ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
                                    <Text className="text-primary font-semibold">
                                        {isSignUp ? 'Iniciar Sesión' : 'Crear Cuenta'}
                                    </Text>
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}
