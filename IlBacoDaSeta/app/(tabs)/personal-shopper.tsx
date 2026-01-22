import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGenderTheme } from '@/features/theme/hooks';
import { MaterialIcons } from '@expo/vector-icons';

export default function PersonalShopperScreen() {
    const { classes, colors } = useGenderTheme();

    return (
        <SafeAreaView className={`flex-1 ${classes.background}`} edges={['top']}>
            {/* Header */}
            <View className="px-6 py-4 border-b border-gray-200">
                <Text className={`text-2xl font-extrabold tracking-tight font-display ${classes.text}`}>
                    PERSONAL SHOPPER
                </Text>
            </View>

            {/* Contenido placeholder */}
            <View className="flex-1 items-center justify-center p-8">
                <View className="w-20 h-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: `${colors.primary}20` }}>
                    <MaterialIcons name="auto-awesome" size={40} color={colors.primary} />
                </View>
                <Text className={`text-xl font-bold mb-2 text-center ${classes.text}`}>
                    Proximamente
                </Text>
                <Text className="text-gray-400 text-center">
                    Asistente inteligente que sugerira outfits personalizados basados en las preferencias del cliente.
                </Text>
            </View>
        </SafeAreaView>
    );
}
