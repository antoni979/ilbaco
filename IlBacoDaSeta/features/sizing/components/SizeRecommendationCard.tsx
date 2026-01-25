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
import * as ImagePicker from 'expo-image-picker';
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
    itemSizeOffset?: number; // Offset de talla de la prenda (-1, 0, +1)
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
    itemSizeOffset = 0,
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
    }, [profile, brandName, category, itemSizeOffset]);

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

        // Aplicar offset de marca + offset de la prenda
        // itemSizeOffset: -1 = talla pequeña (subir), 0 = normal, +1 = talla grande (bajar)
        const totalOffset = brandOffset - itemSizeOffset;
        const result = applyBrandOffset(baseSize, totalOffset);
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
                    itemSizeOffset={itemSizeOffset}
                    brandName={brandName}
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
                itemSizeOffset={itemSizeOffset}
                brandName={brandName}
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
    itemSizeOffset?: number; // Offset de tallaje de la prenda
    brandName?: string;
}

const ConfigureSizeModal: React.FC<ConfigureSizeModalProps> = ({
    visible,
    onClose,
    userId,
    userPhoto,
    primaryColor,
    initialProfile,
    onSave,
    itemSizeOffset = 0,
    brandName = '',
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
    const [fitPreference, setFitPreference] = useState<'ajustado' | 'regular' | 'holgado'>(
        (initialProfile?.preferred_fit as 'ajustado' | 'regular' | 'holgado') || 'regular'
    );

    // Resultado IA
    const [aiResult, setAiResult] = useState<string | null>(null);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    // Foto a usar: la seleccionada o la del perfil
    const photoToUse = selectedPhoto || userPhoto;

    useEffect(() => {
        if (visible) {
            // Resetear foto seleccionada al abrir
            setSelectedPhoto(null);
            setAiResult(null);

            if (initialProfile) {
                setHeight(initialProfile.height_cm?.toString() || '');
                setChest(initialProfile.chest_cm?.toString() || '');
                setWaist(initialProfile.waist_cm?.toString() || '');
                setHip(initialProfile.hip_cm?.toString() || '');
                setShoeSize(initialProfile.shoe_size_eu || '');
                setReferenceSize(initialProfile.reference_size_top || 'M');
                setFitPreference((initialProfile.preferred_fit as 'ajustado' | 'regular' | 'holgado') || 'regular');
            }
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
                preferred_fit: fitPreference,
                measurements_saved: !!(chest || waist),
            });
            onSave();
        } catch (error) {
            Alert.alert('Error', 'No se pudieron guardar las medidas');
        } finally {
            setSaving(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                setSelectedPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
                setAiResult(null); // Resetear resultado previo
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar la imagen');
        }
    };

    const handleAnalyzeWithAI = async () => {
        if (!photoToUse) {
            Alert.alert('Sin foto', 'Selecciona una foto para el análisis con IA');
            return;
        }

        setAnalyzing(true);
        try {
            // Pasar la altura para mejor precision
            const heightCm = height ? parseInt(height, 10) : undefined;
            const analysis = await analyzeSizingFromPhoto(photoToUse, heightCm);

            // La IA calcula la talla de forma INDEPENDIENTE
            let aiCalculatedSize = 'M';
            if (analysis.body_type === 'delgado') aiCalculatedSize = 'S';
            else if (analysis.body_type === 'atletico') aiCalculatedSize = 'M';
            else if (analysis.body_type === 'medio') aiCalculatedSize = 'M';
            else if (analysis.body_type === 'robusto') aiCalculatedSize = 'L';
            else if (analysis.body_type === 'corpulento') aiCalculatedSize = 'XL';

            // Ajustar por hombros anchos
            const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
            let sizeIndex = sizeOrder.indexOf(aiCalculatedSize);
            if (analysis.shoulder_width === 'ancho' && sizeIndex < sizeOrder.length - 1) {
                sizeIndex += 1;
                aiCalculatedSize = sizeOrder[sizeIndex];
            }

            // Ajustar por fit_adjustment de la IA
            if (analysis.fit_adjustment >= 0.5 && sizeIndex < sizeOrder.length - 1) {
                sizeIndex += 1;
                aiCalculatedSize = sizeOrder[sizeIndex];
            } else if (analysis.fit_adjustment <= -0.5 && sizeIndex > 0) {
                sizeIndex -= 1;
                aiCalculatedSize = sizeOrder[sizeIndex];
            }

            // Ajustar por preferencia de fit del usuario
            sizeIndex = sizeOrder.indexOf(aiCalculatedSize);
            if (fitPreference === 'ajustado' && sizeIndex > 0) {
                sizeIndex -= 1;
            } else if (fitPreference === 'holgado' && sizeIndex < sizeOrder.length - 1) {
                sizeIndex += 1;
            }
            let userSize = sizeOrder[sizeIndex]; // Talla base del usuario

            // Aplicar offset de la prenda (-1 = pequeña, +1 = grande)
            // Si la prenda talla pequeña (-1), recomendar una talla más grande
            // Si la prenda talla grande (+1), recomendar una talla más pequeña
            let finalSizeIndex = sizeIndex - itemSizeOffset;
            finalSizeIndex = Math.max(0, Math.min(sizeOrder.length - 1, finalSizeIndex));
            const finalSize = sizeOrder[finalSizeIndex];

            // Construir mensaje de resultado
            let resultMessage = `Complexion: ${analysis.body_type} | Tu talla: ${userSize}`;
            if (itemSizeOffset !== 0) {
                const offsetLabel = itemSizeOffset === -1 ? 'talla pequeña' : 'talla grande';
                resultMessage += ` | Prenda ${offsetLabel} → ${finalSize}`;
            }
            if (referenceSize && userSize !== referenceSize) {
                resultMessage += ` (Ref: ${referenceSize})`;
            }

            setAiResult(resultMessage);
            setReferenceSize(userSize); // Guardar la talla base del usuario

            // Guardar analisis con todos los datos (talla base del usuario, no la ajustada por prenda)
            await saveSizingProfile(userId, {
                height_cm: heightCm,
                reference_size_top: userSize,
                reference_size_bottom: userSize,
                preferred_fit: fitPreference,
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
                            {/* Altura */}
                            <Text className="text-sm font-medium text-gray-700 mb-2">
                                Tu altura
                            </Text>
                            <View className="flex-row items-center gap-2 mb-6">
                                <TextInput
                                    className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                    placeholder="Ej: 175"
                                    keyboardType="numeric"
                                    value={height}
                                    onChangeText={setHeight}
                                    maxLength={3}
                                />
                                <Text className="text-gray-500">cm</Text>
                            </View>

                            {/* Preferencia de fit */}
                            <Text className="text-sm font-medium text-gray-700 mb-2">
                                Como te gusta que te quede la ropa?
                            </Text>
                            <View className="flex-row gap-2 mb-6">
                                {[
                                    { key: 'ajustado', label: 'Ajustada', icon: 'compress' },
                                    { key: 'regular', label: 'Normal', icon: 'remove' },
                                    { key: 'holgado', label: 'Holgada', icon: 'expand' },
                                ].map((fit) => (
                                    <TouchableOpacity
                                        key={fit.key}
                                        onPress={() => setFitPreference(fit.key as 'ajustado' | 'regular' | 'holgado')}
                                        className={`flex-1 py-3 rounded-xl items-center ${fitPreference === fit.key ? '' : 'bg-gray-100'}`}
                                        style={fitPreference === fit.key ? { backgroundColor: primaryColor } : {}}
                                    >
                                        <MaterialIcons
                                            name={fit.icon as any}
                                            size={20}
                                            color={fitPreference === fit.key ? '#fff' : '#6b7280'}
                                        />
                                        <Text className={`text-xs mt-1 font-medium ${fitPreference === fit.key ? 'text-white' : 'text-gray-600'}`}>
                                            {fit.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Medidas */}
                            <Text className="text-sm font-medium text-gray-700 mb-3">
                                Medidas corporales (cm) - opcional
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
                            {/* Modo IA - Foto */}
                            <View className="items-center mb-6">
                                <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                                    {photoToUse ? (
                                        <View className="w-28 h-36 rounded-2xl overflow-hidden border-2 border-gray-200 mb-2">
                                            <Image source={{ uri: photoToUse }} className="w-full h-full" resizeMode="cover" />
                                            <View className="absolute bottom-0 left-0 right-0 bg-black/50 py-1">
                                                <Text className="text-white text-xs text-center">Cambiar</Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <View className="w-28 h-36 rounded-2xl bg-gray-100 items-center justify-center mb-2 border-2 border-dashed border-gray-300">
                                            <MaterialIcons name="add-photo-alternate" size={32} color="#9ca3af" />
                                            <Text className="text-xs text-gray-400 mt-1">Subir foto</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handlePickImage}>
                                    <Text className="text-sm" style={{ color: primaryColor }}>
                                        {photoToUse ? 'Cambiar foto' : 'Seleccionar foto'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Altura */}
                            <Text className="text-sm font-medium text-gray-700 mb-2">
                                Tu altura
                            </Text>
                            <View className="flex-row items-center gap-2 mb-5">
                                <TextInput
                                    className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                    placeholder="Ej: 175"
                                    keyboardType="numeric"
                                    value={height}
                                    onChangeText={setHeight}
                                    maxLength={3}
                                />
                                <Text className="text-gray-500">cm</Text>
                            </View>

                            {/* Talla de referencia */}
                            <Text className="text-sm font-medium text-gray-700 mb-2">
                                Tu talla habitual en Zara / H&M
                            </Text>
                            <View className="flex-row flex-wrap gap-2 mb-5">
                                {REFERENCE_SIZES.map((size) => (
                                    <TouchableOpacity
                                        key={size}
                                        onPress={() => setReferenceSize(size)}
                                        className={`px-4 py-2.5 rounded-xl ${referenceSize === size ? '' : 'bg-gray-100'}`}
                                        style={referenceSize === size ? { backgroundColor: primaryColor } : {}}
                                    >
                                        <Text className={`font-medium ${referenceSize === size ? 'text-white' : 'text-gray-700'}`}>
                                            {size}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Preferencia de fit */}
                            <Text className="text-sm font-medium text-gray-700 mb-2">
                                Como te gusta que te quede la ropa?
                            </Text>
                            <View className="flex-row gap-2 mb-4">
                                {[
                                    { key: 'ajustado', label: 'Ajustada', icon: 'compress' },
                                    { key: 'regular', label: 'Normal', icon: 'remove' },
                                    { key: 'holgado', label: 'Holgada', icon: 'expand' },
                                ].map((fit) => (
                                    <TouchableOpacity
                                        key={fit.key}
                                        onPress={() => setFitPreference(fit.key as 'ajustado' | 'regular' | 'holgado')}
                                        className={`flex-1 py-3 rounded-xl items-center ${fitPreference === fit.key ? '' : 'bg-gray-100'}`}
                                        style={fitPreference === fit.key ? { backgroundColor: primaryColor } : {}}
                                    >
                                        <MaterialIcons
                                            name={fit.icon as any}
                                            size={20}
                                            color={fitPreference === fit.key ? '#fff' : '#6b7280'}
                                        />
                                        <Text className={`text-xs mt-1 font-medium ${fitPreference === fit.key ? 'text-white' : 'text-gray-600'}`}>
                                            {fit.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {aiResult && (
                                <View className="bg-green-50 rounded-xl p-4 mb-4 w-full">
                                    <View className="flex-row items-center gap-2">
                                        <MaterialIcons name="check-circle" size={20} color="#22c55e" />
                                        <Text className="text-green-700 flex-1">{aiResult}</Text>
                                    </View>
                                </View>
                            )}
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
                            disabled={analyzing || !photoToUse}
                            className="py-4 rounded-xl items-center flex-row justify-center gap-2"
                            style={{ backgroundColor: analyzing || !photoToUse ? '#d1d5db' : primaryColor }}
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
