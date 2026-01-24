// ============================================================
// Badge de Recomendación de Talla
// ============================================================
// Muestra la talla recomendada para una prenda específica

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getRecommendedSize, SizeRecommendation } from '../services/sizing_analysis';

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

interface SizeRecommendationBadgeProps {
    userId: string;
    brandName: string;
    category: 'tops' | 'bottoms' | 'shoes';
    gender?: 'male' | 'female' | 'unisex';
    onPress?: () => void;
    showAlternative?: boolean;
    compact?: boolean;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export const SizeRecommendationBadge: React.FC<SizeRecommendationBadgeProps> = ({
    userId,
    brandName,
    category,
    gender = 'unisex',
    onPress,
    showAlternative = true,
    compact = false,
}) => {
    const [loading, setLoading] = useState(true);
    const [recommendation, setRecommendation] = useState<SizeRecommendation | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        loadRecommendation();
    }, [userId, brandName, category, gender]);

    const loadRecommendation = async () => {
        setLoading(true);
        setError(false);

        try {
            const result = await getRecommendedSize(userId, brandName, category, gender);
            setRecommendation(result);
        } catch (err) {
            console.error('[SizeRecommendationBadge] Error:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    // Colores según confianza
    const getConfidenceColor = (confidence: string) => {
        switch (confidence) {
            case 'high':
                return {
                    bg: 'bg-green-100',
                    text: 'text-green-700',
                    border: 'border-green-200',
                    icon: '#22c55e',
                };
            case 'medium':
                return {
                    bg: 'bg-yellow-100',
                    text: 'text-yellow-700',
                    border: 'border-yellow-200',
                    icon: '#eab308',
                };
            case 'low':
            default:
                return {
                    bg: 'bg-gray-100',
                    text: 'text-gray-600',
                    border: 'border-gray-200',
                    icon: '#9ca3af',
                };
        }
    };

    // Loading state
    if (loading) {
        return (
            <View
                className={`flex-row items-center ${
                    compact ? 'px-2 py-1' : 'px-3 py-2'
                } bg-gray-50 rounded-lg`}
            >
                <ActivityIndicator size="small" color="#9ca3af" />
                {!compact && (
                    <Text className="ml-2 text-sm text-gray-400">Calculando talla...</Text>
                )}
            </View>
        );
    }

    // Error state
    if (error || !recommendation) {
        return (
            <TouchableOpacity
                onPress={onPress}
                className={`flex-row items-center ${
                    compact ? 'px-2 py-1' : 'px-3 py-2'
                } bg-gray-50 rounded-lg border border-gray-200`}
            >
                <MaterialIcons name="help-outline" size={compact ? 16 : 20} color="#9ca3af" />
                {!compact && (
                    <Text className="ml-2 text-sm text-gray-500">
                        Configura tu talla
                    </Text>
                )}
            </TouchableOpacity>
        );
    }

    const colors = getConfidenceColor(recommendation.confidence);

    // Compact mode (para listas)
    if (compact) {
        return (
            <TouchableOpacity
                onPress={onPress}
                className={`flex-row items-center px-2 py-1 ${colors.bg} rounded-md`}
            >
                <Text className={`font-bold text-sm ${colors.text}`}>
                    {recommendation.recommended_size}
                </Text>
            </TouchableOpacity>
        );
    }

    // Full mode (para detalle de prenda)
    return (
        <TouchableOpacity
            onPress={onPress}
            className={`${colors.bg} rounded-xl p-4 border ${colors.border}`}
            activeOpacity={0.7}
        >
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <MaterialIcons name="straighten" size={24} color={colors.icon} />
                    <View className="ml-3">
                        <Text className="text-xs text-gray-500 uppercase tracking-wide">
                            Talla recomendada
                        </Text>
                        <View className="flex-row items-baseline">
                            <Text className={`text-2xl font-bold ${colors.text}`}>
                                {recommendation.recommended_size}
                            </Text>
                            {showAlternative && recommendation.alternative_size && (
                                <Text className="text-sm text-gray-400 ml-2">
                                    o {recommendation.alternative_size}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>

                <View className="items-end">
                    <View className="flex-row items-center">
                        {recommendation.confidence === 'high' && (
                            <MaterialIcons name="verified" size={16} color={colors.icon} />
                        )}
                        <Text className={`text-xs ml-1 ${colors.text}`}>
                            {recommendation.confidence === 'high'
                                ? 'Alta confianza'
                                : recommendation.confidence === 'medium'
                                ? 'Confianza media'
                                : 'Baja confianza'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Reasoning (opcional) */}
            {recommendation.reasoning && (
                <View className="mt-2 pt-2 border-t border-gray-200">
                    <Text className="text-xs text-gray-500">
                        {recommendation.reasoning}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

// ------------------------------------------------------------
// COMPONENTE INLINE (para usar dentro de texto)
// ------------------------------------------------------------

interface SizeRecommendationInlineProps {
    userId: string;
    brandName: string;
    category: 'tops' | 'bottoms' | 'shoes';
    gender?: 'male' | 'female' | 'unisex';
}

export const SizeRecommendationInline: React.FC<SizeRecommendationInlineProps> = ({
    userId,
    brandName,
    category,
    gender = 'unisex',
}) => {
    const [recommendation, setRecommendation] = useState<SizeRecommendation | null>(null);

    useEffect(() => {
        getRecommendedSize(userId, brandName, category, gender).then(setRecommendation);
    }, [userId, brandName, category, gender]);

    if (!recommendation) {
        return <Text className="text-gray-400">...</Text>;
    }

    return (
        <Text className="font-bold text-blue-600">
            {recommendation.recommended_size}
        </Text>
    );
};

export default SizeRecommendationBadge;
