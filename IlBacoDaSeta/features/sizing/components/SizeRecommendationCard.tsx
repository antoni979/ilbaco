// ============================================================
// Tarjeta de Recomendación de Talla
// ============================================================
// Muestra la talla recomendada para una prenda.
// Si el usuario no tiene medidas configuradas, muestra opción para configurarlas.

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Image,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
    getSizingProfile,
    saveSizingProfile,
    analyzeSizingFromPhoto,
    getBrandSizingRules,
    UserSizingProfile,
} from '../services/sizing_analysis';

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

interface SizeRecommendationCardProps {
    userId: string;
    brandName: string;
    category: string; // Categoria de la prenda (Camiseta, Pantalón, etc.)
    userPhoto?: string; // base64 de foto del usuario (opcional, para análisis IA)
    primaryColor?: string;
}

// ------------------------------------------------------------
// CONSTANTES
// ------------------------------------------------------------

const SIZE_CHART = {
    tops: {
        ranges: [
            { max: 88, size: 'XS' },
            { max: 96, size: 'S' },
            { max: 104, size: 'M' },
            { max: 112, size: 'L' },
            { max: 120, size: 'XL' },
            { max: 128, size: 'XXL' },
            { max: 999, size: 'XXXL' },
        ],
    },
    bottoms: {
        ranges: [
            { max: 72, size: 'XS' },
            { max: 80, size: 'S' },
            { max: 88, size: 'M' },
            { max: 96, size: 'L' },
            { max: 104, size: 'XL' },
            { max: 112, size: 'XXL' },
            { max: 999, size: 'XXXL' },
        ],
    },
};

const REFERENCE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const mapCategoryToSizing = (category: string): 'tops' | 'bottoms' | 'shoes' => {
    const normalized = (category || '').toLowerCase();

    if (['camiseta', 'camisa', 'polo', 'jersey', 'sudadera', 'chaqueta', 'abrigo', 'blazer', 'chaleco', 'top', 'blusa', 'cazadora', 'cardigan', 'bomber', 'vestido', 'mono'].some(c => normalized.includes(c))) {
        return 'tops';
    }

    if (['pantalon', 'pantalón', 'vaquero', 'jean', 'short', 'bermuda', 'falda', 'leggins', 'shorts', 'bañador'].some(c => normalized.includes(c))) {
        return 'bottoms';
    }

    if (['zapato', 'zapatilla', 'bota', 'sandalia', 'mocasin', 'sneaker', 'deportiva', 'calzado'].some(c => normalized.includes(c))) {
        return 'shoes';
    }

    return 'tops';
};

const applyBrandOffset = (baseSize: string, offset: number): { recommended: string; alternative?: string } => {
    const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const currentIndex = sizeOrder.indexOf(baseSize);

    if (currentIndex === -1) return { recommended: baseSize };

    const adjustment = Math.round(offset);
    const newIndex = Math.max(0, Math.min(sizeOrder.length - 1, currentIndex + adjustment));
    const recommended = sizeOrder[newIndex];

    let alternative: string | undefined;
    if (Math.abs(offset - adjustment) >= 0.3) {
        const altIndex = offset > 0 ? newIndex + 1 : newIndex - 1;
        if (altIndex >= 0 && altIndex < sizeOrder.length) {
            alternative = sizeOrder[altIndex];
        }
    }

    return { recommended, alternative };
};

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------

export const SizeRecommendationCard: React.FC<SizeRecommendationCardProps> = ({
    userId,
    brandName,
    category,
    userPhoto,
    primaryColor = '#C9A66B',
}) => {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserSizingProfile | null>(null);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [recommendation, setRecommendation] = useState<{ size: string; alternative?: string } | null>(null);

    // Cargar perfil al montar
    useEffect(() => {
        loadProfile();
    }, [userId]);

    // Calcular recomendación cuando cambia el perfil o la prenda
    useEffect(() => {
        if (profile?.measurements_saved || profile?.reference_size_top) {
            calculateRecommendation();
        }
    }, [profile, brandName, category]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const data = await getSizingProfile(userId);
            setProfile(data);
        } catch (error) {
            console.error('[SizeRecommendation] Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateRecommendation = async () => {
        if (!profile) return;

        const sizingCategory = mapCategoryToSizing(category);
        const brandRules = await getBrandSizingRules(brandName || 'zara');
        const brandOffset = brandRules?.offset || 0;

        let baseSize = 'M';

        // Prioridad 1: Medidas manuales
        if (profile.measurements_saved) {
            if (sizingCategory === 'tops' && profile.chest_cm) {
                const match = SIZE_CHART.tops.ranges.find(r => profile.chest_cm! <= r.max);
                if (match) baseSize = match.size;
            } else if (sizingCategory === 'bottoms' && profile.waist_cm) {
                const match = SIZE_CHART.bottoms.ranges.find(r => profile.waist_cm! <= r.max);
                if (match) baseSize = match.size;
            } else if (sizingCategory === 'shoes' && profile.shoe_size_eu) {
                setRecommendation({ size: profile.shoe_size_eu });
                return;
            }
        }
        // Prioridad 2: Talla de referencia
        else if (sizingCategory === 'tops' && profile.reference_size_top) {
            baseSize = profile.reference_size_top;
        } else if (sizingCategory === 'bottoms' && profile.reference_size_bottom) {
            baseSize = profile.reference_size_bottom;
        } else if (profile.reference_size_top) {
            baseSize = profile.reference_size_top;
        }

        // Aplicar offset de marca
        const result = applyBrandOffset(baseSize, brandOffset);
        setRecommendation({ size: result.recommended, alternative: result.alternative });
    };

    const hasMeasurements = profile?.measurements_saved || profile?.reference_size_top;

    // Loading
    if (loading) {
        return (
            <View className="bg-gray-50 rounded-2xl p-4 mb-6">
                <ActivityIndicator size="small" color={primaryColor} />
            </View>
        );
    }

    // Sin medidas configuradas
    if (!hasMeasurements) {
        return (
            <>
                <TouchableOpacity
                    onPress={() => setShowConfigModal(true)}
                    className="bg-gray-50 rounded-2xl p-4 mb-6 border-2 border-dashed border-gray-200"
                >
                    <View className="flex-row items-center gap-3">
                        <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center">
                            <MaterialIcons name="straighten" size={24} color="#9ca3af" />
                        </View>
                        <View className="flex-1">
                            <Text className="font-semibold text-gray-700">
                                Configura tu talla
                            </Text>
                            <Text className="text-sm text-gray-500">
                                Te recomendaremos la talla perfecta
                            </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
                    </View>
                </TouchableOpacity>

                <ConfigureSizeModal
                    visible={showConfigModal}
                    onClose={() => setShowConfigModal(false)}
                    userId={userId}
                    userPhoto={userPhoto}
                    primaryColor={primaryColor}
                    onSave={() => {
                        loadProfile();
                        setShowConfigModal(false);
                    }}
                />
            </>
        );
    }

    // Con recomendación
    return (
        <>
            <View className="rounded-2xl p-4 mb-6 border border-gray-100" style={{ backgroundColor: primaryColor + '10' }}>
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                        <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: primaryColor + '20' }}>
                            <MaterialIcons name="checkroom" size={24} color={primaryColor} />
                        </View>
                        <View>
                            <Text className="text-xs text-gray-500 uppercase tracking-wide">
                                Tu talla recomendada
                            </Text>
                            <View className="flex-row items-baseline gap-2">
                                <Text className="text-3xl font-bold" style={{ color: primaryColor }}>
                                    {recommendation?.size || 'M'}
                                </Text>
                                {recommendation?.alternative && (
                                    <Text className="text-base text-gray-400">
                                        o {recommendation.alternative}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={() => setShowConfigModal(true)}
                        className="p-2"
                    >
                        <MaterialIcons name="edit" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                </View>

                {brandName && (
                    <Text className="text-xs text-gray-500 mt-2">
                        Calculado para {brandName}
                    </Text>
                )}
            </View>

            <ConfigureSizeModal
                visible={showConfigModal}
                onClose={() => setShowConfigModal(false)}
                userId={userId}
                userPhoto={userPhoto}
                primaryColor={primaryColor}
                initialProfile={profile}
                onSave={() => {
                    loadProfile();
                    setShowConfigModal(false);
                }}
            />
        </>
    );
};

// ------------------------------------------------------------
// MODAL DE CONFIGURACIÓN
// ------------------------------------------------------------

interface ConfigureSizeModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    userPhoto?: string;
    primaryColor: string;
    initialProfile?: UserSizingProfile | null;
    onSave: () => void;
}

const ConfigureSizeModal: React.FC<ConfigureSizeModalProps> = ({
    visible,
    onClose,
    userId,
    userPhoto,
    primaryColor,
    initialProfile,
    onSave,
}) => {
    const [mode, setMode] = useState<'manual' | 'ai'>('manual');
    const [saving, setSaving] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

    // Medidas
    const [height, setHeight] = useState(initialProfile?.height_cm?.toString() || '');
    const [chest, setChest] = useState(initialProfile?.chest_cm?.toString() || '');
    const [waist, setWaist] = useState(initialProfile?.waist_cm?.toString() || '');
    const [hip, setHip] = useState(initialProfile?.hip_cm?.toString() || '');
    const [shoeSize, setShoeSize] = useState(initialProfile?.shoe_size_eu || '');
    const [referenceSize, setReferenceSize] = useState(initialProfile?.reference_size_top || 'M');

    // Resultado IA
    const [aiResult, setAiResult] = useState<string | null>(null);

    useEffect(() => {
        if (visible && initialProfile) {
            setHeight(initialProfile.height_cm?.toString() || '');
            setChest(initialProfile.chest_cm?.toString() || '');
            setWaist(initialProfile.waist_cm?.toString() || '');
            setHip(initialProfile.hip_cm?.toString() || '');
            setShoeSize(initialProfile.shoe_size_eu || '');
            setReferenceSize(initialProfile.reference_size_top || 'M');
        }
    }, [visible, initialProfile]);

    const handleSaveManual = async () => {
        setSaving(true);
        try {
            await saveSizingProfile(userId, {
                height_cm: height ? parseInt(height, 10) : undefined,
                chest_cm: chest ? parseInt(chest, 10) : undefined,
                waist_cm: waist ? parseInt(waist, 10) : undefined,
                hip_cm: hip ? parseInt(hip, 10) : undefined,
                shoe_size_eu: shoeSize || undefined,
                reference_size_top: referenceSize,
                reference_size_bottom: referenceSize,
                measurements_saved: !!(chest || waist),
            });
            onSave();
        } catch (error) {
            Alert.alert('Error', 'No se pudieron guardar las medidas');
        } finally {
            setSaving(false);
        }
    };

    const handleAnalyzeWithAI = async () => {
        if (!userPhoto) {
            Alert.alert('Sin foto', 'Necesitas una foto de perfil para el análisis con IA');
            return;
        }

        setAnalyzing(true);
        try {
            const analysis = await analyzeSizingFromPhoto(userPhoto);

            // Determinar talla base según análisis
            let suggestedSize = 'M';
            if (analysis.body_type === 'delgado') suggestedSize = 'S';
            else if (analysis.body_type === 'atletico') suggestedSize = 'M';
            else if (analysis.body_type === 'robusto') suggestedSize = 'L';
            else if (analysis.body_type === 'corpulento') suggestedSize = 'XL';

            setReferenceSize(suggestedSize);
            setAiResult(`Complexión: ${analysis.body_type} - Talla sugerida: ${suggestedSize}`);

            // Guardar análisis
            await saveSizingProfile(userId, {
                reference_size_top: suggestedSize,
                reference_size_bottom: suggestedSize,
                ai_body_type: analysis.body_type,
                ai_shoulder_width: analysis.shoulder_width,
                ai_fit_adjustment: analysis.fit_adjustment,
                ai_confidence: analysis.confidence,
                ai_analyzed_at: new Date().toISOString(),
            });

            setTimeout(() => onSave(), 1500);
        } catch (error) {
            Alert.alert('Error', 'No se pudo analizar la foto');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-white">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
                    <TouchableOpacity onPress={onClose} className="p-2">
                        <MaterialIcons name="close" size={24} color="#374151" />
                    </TouchableOpacity>
                    <Text className="text-base font-semibold text-gray-900">
                        Configurar mi talla
                    </Text>
                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 p-4">
                    {/* Selector de modo */}
                    <View className="flex-row bg-gray-100 rounded-xl p-1 mb-6">
                        <TouchableOpacity
                            onPress={() => setMode('manual')}
                            className={`flex-1 py-3 rounded-lg items-center ${mode === 'manual' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Text className={`font-medium ${mode === 'manual' ? 'text-gray-900' : 'text-gray-400'}`}>
                                Mis medidas
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setMode('ai')}
                            className={`flex-1 py-3 rounded-lg items-center ${mode === 'ai' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Text className={`font-medium ${mode === 'ai' ? 'text-gray-900' : 'text-gray-400'}`}>
                                Analizar con IA
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {mode === 'manual' ? (
                        <>
                            {/* Medidas */}
                            <Text className="text-sm font-medium text-gray-700 mb-3">
                                Medidas corporales (cm)
                            </Text>

                            <View className="flex-row gap-3 mb-4">
                                <View className="flex-1">
                                    <Text className="text-xs text-gray-500 mb-1">Pecho</Text>
                                    <TextInput
                                        className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                        placeholder="102"
                                        keyboardType="numeric"
                                        value={chest}
                                        onChangeText={setChest}
                                        maxLength={3}
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs text-gray-500 mb-1">Cintura</Text>
                                    <TextInput
                                        className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                        placeholder="88"
                                        keyboardType="numeric"
                                        value={waist}
                                        onChangeText={setWaist}
                                        maxLength={3}
                                    />
                                </View>
                            </View>

                            <View className="flex-row gap-3 mb-6">
                                <View className="flex-1">
                                    <Text className="text-xs text-gray-500 mb-1">Cadera</Text>
                                    <TextInput
                                        className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                        placeholder="98"
                                        keyboardType="numeric"
                                        value={hip}
                                        onChangeText={setHip}
                                        maxLength={3}
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs text-gray-500 mb-1">Calzado (EU)</Text>
                                    <TextInput
                                        className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                        placeholder="43"
                                        keyboardType="numeric"
                                        value={shoeSize}
                                        onChangeText={setShoeSize}
                                        maxLength={2}
                                    />
                                </View>
                            </View>

                            {/* Separador */}
                            <View className="flex-row items-center gap-4 mb-4">
                                <View className="flex-1 h-px bg-gray-200" />
                                <Text className="text-xs text-gray-400">o indica tu talla habitual</Text>
                                <View className="flex-1 h-px bg-gray-200" />
                            </View>

                            {/* Talla de referencia */}
                            <Text className="text-sm font-medium text-gray-700 mb-2">
                                Talla en Zara / H&M
                            </Text>
                            <View className="flex-row flex-wrap gap-2">
                                {REFERENCE_SIZES.map((size) => (
                                    <TouchableOpacity
                                        key={size}
                                        onPress={() => setReferenceSize(size)}
                                        className={`px-5 py-3 rounded-xl ${referenceSize === size ? '' : 'bg-gray-100'}`}
                                        style={referenceSize === size ? { backgroundColor: primaryColor } : {}}
                                    >
                                        <Text className={`font-medium ${referenceSize === size ? 'text-white' : 'text-gray-700'}`}>
                                            {size}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    ) : (
                        <>
                            {/* Modo IA */}
                            <View className="items-center py-8">
                                {userPhoto ? (
                                    <View className="w-32 h-40 rounded-2xl overflow-hidden border-2 border-gray-200 mb-4">
                                        <Image source={{ uri: userPhoto }} className="w-full h-full" resizeMode="cover" />
                                    </View>
                                ) : (
                                    <View className="w-32 h-40 rounded-2xl bg-gray-100 items-center justify-center mb-4">
                                        <MaterialIcons name="person" size={48} color="#d1d5db" />
                                    </View>
                                )}

                                <Text className="text-center text-gray-600 mb-4 px-8">
                                    {userPhoto
                                        ? 'Analizaremos tu foto para determinar tu complexión y recomendarte la talla ideal.'
                                        : 'Necesitas tener una foto de perfil para usar el análisis con IA.'}
                                </Text>

                                {aiResult && (
                                    <View className="bg-green-50 rounded-xl p-4 mb-4 w-full">
                                        <View className="flex-row items-center gap-2">
                                            <MaterialIcons name="check-circle" size={20} color="#22c55e" />
                                            <Text className="text-green-700 flex-1">{aiResult}</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </>
                    )}
                </ScrollView>

                {/* Footer */}
                <View className="px-4 pb-8 pt-4 border-t border-gray-100">
                    {mode === 'manual' ? (
                        <TouchableOpacity
                            onPress={handleSaveManual}
                            disabled={saving}
                            className="py-4 rounded-xl items-center"
                            style={{ backgroundColor: saving ? '#d1d5db' : primaryColor }}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text className="text-white font-semibold">Guardar medidas</Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={handleAnalyzeWithAI}
                            disabled={analyzing || !userPhoto}
                            className="py-4 rounded-xl items-center flex-row justify-center gap-2"
                            style={{ backgroundColor: analyzing || !userPhoto ? '#d1d5db' : primaryColor }}
                        >
                            {analyzing ? (
                                <>
                                    <ActivityIndicator color="#fff" size="small" />
                                    <Text className="text-white font-semibold">Analizando...</Text>
                                </>
                            ) : (
                                <>
                                    <MaterialIcons name="auto-awesome" size={20} color="#fff" />
                                    <Text className="text-white font-semibold">Analizar con IA</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default SizeRecommendationCard;
