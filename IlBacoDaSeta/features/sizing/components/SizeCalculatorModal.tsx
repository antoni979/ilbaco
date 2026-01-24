// ============================================================
// Modal Calculadora de Tallas
// ============================================================
// Permite al usuario obtener recomendaciones de talla de dos formas:
// 1. Analisis con IA de su foto
// 2. Introduciendo sus medidas manualmente

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    TextInput,
    Image,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
    analyzeSizingFromPhoto,
    SizingAnalysisResult,
    getBrandSizingRules,
    getSizingProfile,
    saveSizingProfile,
    UserSizingProfile,
} from '../services/sizing_analysis';

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

interface SelectedItem {
    id: number;
    name: string;
    brand: string;
    image_url: string;
    category?: string;
    characteristics?: any;
}

interface SizeCalculatorModalProps {
    visible: boolean;
    onClose: () => void;
    customerPhoto: string; // base64 de la foto del cliente
    selectedItems: {
        outerwear: SelectedItem | null;
        top: SelectedItem | null;
        bottom: SelectedItem | null;
        shoes: SelectedItem | null;
    };
    primaryColor?: string;
    userId?: string; // Para guardar/cargar medidas del usuario
}

interface SizeRecommendation {
    item: SelectedItem;
    category: 'tops' | 'bottoms' | 'shoes';
    recommendedSize: string;
    alternativeSize?: string;
    confidence: 'high' | 'medium' | 'low';
    brandOffset: number;
    brandFit: string;
}

interface ManualMeasurements {
    height: string;        // cm
    chest: string;         // cm (pecho)
    waist: string;         // cm (cintura)
    hip: string;           // cm (cadera)
    shoeSize: string;      // EU
    referenceBrand: string;
    referenceSize: string;
}

type CalculationMode = 'ai' | 'manual';

// ------------------------------------------------------------
// CONSTANTES
// ------------------------------------------------------------

// Tabla de tallas basada en medidas (aproximaciones estándar)
const SIZE_CHART = {
    tops: {
        // pecho en cm -> talla
        ranges: [
            { max: 88, size: 'XS', numeric: 44 },
            { max: 96, size: 'S', numeric: 46 },
            { max: 104, size: 'M', numeric: 48 },
            { max: 112, size: 'L', numeric: 50 },
            { max: 120, size: 'XL', numeric: 52 },
            { max: 128, size: 'XXL', numeric: 54 },
            { max: 999, size: 'XXXL', numeric: 56 },
        ],
    },
    bottoms: {
        // cintura en cm -> talla
        ranges: [
            { max: 72, size: 'XS', numeric: 38 },
            { max: 80, size: 'S', numeric: 40 },
            { max: 88, size: 'M', numeric: 42 },
            { max: 96, size: 'L', numeric: 44 },
            { max: 104, size: 'XL', numeric: 46 },
            { max: 112, size: 'XXL', numeric: 48 },
            { max: 999, size: 'XXXL', numeric: 50 },
        ],
    },
};

const REFERENCE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const mapCategoryToSizing = (category: string): 'tops' | 'bottoms' | 'shoes' => {
    const normalized = (category || '').toLowerCase();

    if (['camiseta', 'camisa', 'polo', 'jersey', 'sudadera', 'chaqueta', 'abrigo', 'blazer', 'chaleco', 'top', 'blusa', 'cazadora', 'cardigan', 'bomber', 'vestido'].some(c => normalized.includes(c))) {
        return 'tops';
    }

    if (['pantalon', 'pantalón', 'vaquero', 'jean', 'short', 'bermuda', 'falda', 'leggins', 'shorts'].some(c => normalized.includes(c))) {
        return 'bottoms';
    }

    if (['zapato', 'zapatilla', 'bota', 'sandalia', 'mocasin', 'sneaker', 'deportiva', 'calzado'].some(c => normalized.includes(c))) {
        return 'shoes';
    }

    return 'tops';
};

// Convertir offset de marca a ajuste de talla
const applyBrandOffset = (baseSize: string, offset: number): { recommended: string; alternative?: string } => {
    const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const currentIndex = sizeOrder.indexOf(baseSize);

    if (currentIndex === -1) {
        return { recommended: baseSize };
    }

    // Redondear el offset y calcular nuevo índice
    const adjustment = Math.round(offset);
    const newIndex = Math.max(0, Math.min(sizeOrder.length - 1, currentIndex + adjustment));
    const recommended = sizeOrder[newIndex];

    // Si el offset tiene decimal, sugerir también la talla siguiente
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

export const SizeCalculatorModal: React.FC<SizeCalculatorModalProps> = ({
    visible,
    onClose,
    customerPhoto,
    selectedItems,
    primaryColor = '#3b82f6',
    userId,
}) => {
    const [mode, setMode] = useState<CalculationMode>('ai');
    const [loading, setLoading] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<SizingAnalysisResult | null>(null);
    const [recommendations, setRecommendations] = useState<SizeRecommendation[]>([]);
    const [calculated, setCalculated] = useState(false);
    const [hasSavedMeasurements, setHasSavedMeasurements] = useState(false);

    // Medidas manuales
    const [measurements, setMeasurements] = useState<ManualMeasurements>({
        height: '',
        chest: '',
        waist: '',
        hip: '',
        shoeSize: '',
        referenceBrand: 'Zara',
        referenceSize: 'M',
    });

    // Cargar medidas guardadas al abrir
    useEffect(() => {
        if (visible && userId) {
            loadSavedMeasurements();
        }
        if (visible) {
            setCalculated(false);
            setRecommendations([]);
            setAiAnalysis(null);
        }
    }, [visible, userId]);

    // Cargar medidas del perfil del usuario
    const loadSavedMeasurements = async () => {
        if (!userId) return;

        setLoadingProfile(true);
        try {
            const profile = await getSizingProfile(userId);
            if (profile) {
                setMeasurements({
                    height: profile.height_cm?.toString() || '',
                    chest: profile.chest_cm?.toString() || '',
                    waist: profile.waist_cm?.toString() || '',
                    hip: profile.hip_cm?.toString() || '',
                    shoeSize: profile.shoe_size_eu || '',
                    referenceBrand: profile.reference_brand || 'Zara',
                    referenceSize: profile.reference_size_top || 'M',
                });
                setHasSavedMeasurements(profile.measurements_saved || false);
            }
        } catch (error) {
            console.error('[SizeCalculator] Error cargando perfil:', error);
        } finally {
            setLoadingProfile(false);
        }
    };

    // Guardar medidas en el perfil del usuario
    const saveMeasurements = async () => {
        if (!userId) return;

        try {
            await saveSizingProfile(userId, {
                height_cm: measurements.height ? parseInt(measurements.height, 10) : undefined,
                chest_cm: measurements.chest ? parseInt(measurements.chest, 10) : undefined,
                waist_cm: measurements.waist ? parseInt(measurements.waist, 10) : undefined,
                hip_cm: measurements.hip ? parseInt(measurements.hip, 10) : undefined,
                shoe_size_eu: measurements.shoeSize || undefined,
                reference_brand: measurements.referenceBrand.toLowerCase(),
                reference_size_top: measurements.referenceSize,
                measurements_saved: true,
            });
            setHasSavedMeasurements(true);
            console.log('[SizeCalculator] Medidas guardadas correctamente');
        } catch (error) {
            console.error('[SizeCalculator] Error guardando medidas:', error);
        }
    };

    // Obtener items activos (no null)
    const activeItems = [
        selectedItems.outerwear,
        selectedItems.top,
        selectedItems.bottom,
        selectedItems.shoes,
    ].filter((item): item is SelectedItem => item !== null);

    // ------------------------------------------------------------
    // CALCULAR CON IA
    // ------------------------------------------------------------
    const calculateWithAI = async () => {
        setLoading(true);
        setCalculated(false);

        try {
            // 1. Analizar la foto con Gemini
            const analysis = await analyzeSizingFromPhoto(customerPhoto);
            setAiAnalysis(analysis);

            // 2. Calcular recomendaciones para cada item
            const newRecommendations: SizeRecommendation[] = [];

            for (const item of activeItems) {
                const category = mapCategoryToSizing(item.category || item.characteristics?.category || '');
                const brandName = (item.brand || 'zara').toLowerCase();

                // Obtener reglas de la marca
                const brandRules = await getBrandSizingRules(brandName);
                const brandOffset = brandRules?.offset || 0;
                const brandFit = brandRules?.fitStyle || 'regular';

                // Calcular talla base según análisis IA
                let baseSize = 'M'; // Default

                // Ajustar según body_type
                if (analysis.body_type === 'delgado') {
                    baseSize = 'S';
                } else if (analysis.body_type === 'atletico') {
                    baseSize = 'M';
                } else if (analysis.body_type === 'medio') {
                    baseSize = 'M';
                } else if (analysis.body_type === 'robusto') {
                    baseSize = 'L';
                } else if (analysis.body_type === 'corpulento') {
                    baseSize = 'XL';
                }

                // Ajuste adicional por hombros anchos (para tops)
                let extraOffset = 0;
                if (category === 'tops' && analysis.shoulder_width === 'ancho') {
                    extraOffset += 0.5;
                }

                // Aplicar offset de marca + ajuste IA
                const totalOffset = brandOffset + analysis.fit_adjustment + extraOffset;
                const { recommended, alternative } = applyBrandOffset(baseSize, totalOffset);

                // Determinar confianza
                let confidence: 'high' | 'medium' | 'low' = 'medium';
                if (analysis.confidence >= 0.8) {
                    confidence = 'high';
                } else if (analysis.confidence < 0.5) {
                    confidence = 'low';
                }

                newRecommendations.push({
                    item,
                    category,
                    recommendedSize: recommended,
                    alternativeSize: alternative,
                    confidence,
                    brandOffset,
                    brandFit,
                });
            }

            setRecommendations(newRecommendations);
            setCalculated(true);
        } catch (error) {
            console.error('[SizeCalculator] Error:', error);
            Alert.alert('Error', 'No se pudo analizar la foto. Intenta con medidas manuales.');
        } finally {
            setLoading(false);
        }
    };

    // ------------------------------------------------------------
    // CALCULAR CON MEDIDAS MANUALES
    // ------------------------------------------------------------
    const calculateWithMeasurements = async () => {
        // Validar que hay al menos una medida
        if (!measurements.chest && !measurements.waist && !measurements.referenceSize) {
            Alert.alert('Faltan datos', 'Introduce al menos el pecho o la cintura, o tu talla de referencia');
            return;
        }

        setLoading(true);
        setCalculated(false);

        try {
            // Guardar medidas para futuras consultas
            await saveMeasurements();

            const newRecommendations: SizeRecommendation[] = [];

            for (const item of activeItems) {
                const category = mapCategoryToSizing(item.category || item.characteristics?.category || '');
                const brandName = (item.brand || 'zara').toLowerCase();

                // Obtener reglas de la marca
                const brandRules = await getBrandSizingRules(brandName);
                const brandOffset = brandRules?.offset || 0;
                const brandFit = brandRules?.fitStyle || 'regular';

                let baseSize = measurements.referenceSize || 'M';

                // Si hay medidas específicas, calcular talla
                if (category === 'tops' && measurements.chest) {
                    const chest = parseInt(measurements.chest, 10);
                    const match = SIZE_CHART.tops.ranges.find(r => chest <= r.max);
                    if (match) {
                        baseSize = match.size;
                    }
                } else if (category === 'bottoms' && measurements.waist) {
                    const waist = parseInt(measurements.waist, 10);
                    const match = SIZE_CHART.bottoms.ranges.find(r => waist <= r.max);
                    if (match) {
                        baseSize = match.size;
                    }
                } else if (category === 'shoes' && measurements.shoeSize) {
                    // Para calzado, usar directamente el número
                    newRecommendations.push({
                        item,
                        category,
                        recommendedSize: measurements.shoeSize,
                        confidence: 'high',
                        brandOffset: 0,
                        brandFit: 'regular',
                    });
                    continue;
                }

                // Aplicar offset de marca
                const { recommended, alternative } = applyBrandOffset(baseSize, brandOffset);

                newRecommendations.push({
                    item,
                    category,
                    recommendedSize: recommended,
                    alternativeSize: alternative,
                    confidence: measurements.chest || measurements.waist ? 'high' : 'medium',
                    brandOffset,
                    brandFit,
                });
            }

            setRecommendations(newRecommendations);
            setCalculated(true);
        } catch (error) {
            console.error('[SizeCalculator] Error:', error);
            Alert.alert('Error', 'No se pudieron calcular las tallas');
        } finally {
            setLoading(false);
        }
    };

    // ------------------------------------------------------------
    // RENDERS
    // ------------------------------------------------------------

    const renderModeSelector = () => (
        <View className="flex-row bg-gray-100 rounded-xl p-1 mb-4">
            <TouchableOpacity
                onPress={() => setMode('ai')}
                className={`flex-1 py-3 rounded-lg flex-row items-center justify-center gap-2 ${mode === 'ai' ? 'bg-white shadow-sm' : ''}`}
            >
                <MaterialIcons
                    name="auto-awesome"
                    size={20}
                    color={mode === 'ai' ? primaryColor : '#9ca3af'}
                />
                <Text className={`font-medium ${mode === 'ai' ? 'text-gray-900' : 'text-gray-400'}`}>
                    Con IA
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => setMode('manual')}
                className={`flex-1 py-3 rounded-lg flex-row items-center justify-center gap-2 ${mode === 'manual' ? 'bg-white shadow-sm' : ''}`}
            >
                <MaterialIcons
                    name="straighten"
                    size={20}
                    color={mode === 'manual' ? primaryColor : '#9ca3af'}
                />
                <Text className={`font-medium ${mode === 'manual' ? 'text-gray-900' : 'text-gray-400'}`}>
                    Medidas
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderAIMode = () => (
        <View>
            {!calculated ? (
                <>
                    {/* Preview de foto y prendas */}
                    <View className="flex-row gap-4 mb-6">
                        <View className="w-24 h-32 rounded-xl overflow-hidden border border-gray-200">
                            <Image source={{ uri: customerPhoto }} className="w-full h-full" resizeMode="cover" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm text-gray-500 mb-2">
                                Analizaremos tu foto para recomendarte la talla ideal en:
                            </Text>
                            {activeItems.map((item) => (
                                <View key={item.id} className="flex-row items-center gap-2 mb-1">
                                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                                    <Text className="text-sm text-gray-700">{item.name}</Text>
                                    {item.brand && (
                                        <Text className="text-xs text-gray-400">({item.brand})</Text>
                                    )}
                                </View>
                            ))}
                        </View>
                    </View>

                    <View className="bg-blue-50 rounded-xl p-4 mb-4">
                        <View className="flex-row items-start gap-3">
                            <MaterialIcons name="info" size={20} color="#3b82f6" />
                            <Text className="flex-1 text-sm text-blue-700">
                                La IA analizara tu complexion, hombros y proporciones para darte una recomendacion precisa.
                            </Text>
                        </View>
                    </View>
                </>
            ) : (
                renderResults()
            )}
        </View>
    );

    const renderManualMode = () => (
        <View>
            {!calculated ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Indicador de carga */}
                    {loadingProfile ? (
                        <View className="items-center py-8">
                            <ActivityIndicator size="small" color={primaryColor} />
                            <Text className="text-sm text-gray-500 mt-2">Cargando tus medidas...</Text>
                        </View>
                    ) : (
                        <>
                    {/* Badge de medidas guardadas */}
                    {hasSavedMeasurements && (
                        <View className="flex-row items-center gap-2 bg-green-50 px-4 py-3 rounded-xl mb-4 border border-green-200">
                            <MaterialIcons name="check-circle" size={20} color="#22c55e" />
                            <Text className="text-sm text-green-700 flex-1">
                                Tus medidas estan guardadas. Se usaran automaticamente.
                            </Text>
                        </View>
                    )}

                    {/* Medidas principales */}
                    <Text className="text-sm font-medium text-gray-700 mb-3">
                        {hasSavedMeasurements ? 'Tus medidas guardadas (puedes editarlas)' : 'Introduce tus medidas (cm)'}
                    </Text>

                    <View className="flex-row gap-3 mb-4">
                        <View className="flex-1">
                            <Text className="text-xs text-gray-500 mb-1">Altura</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                placeholder="175"
                                keyboardType="numeric"
                                value={measurements.height}
                                onChangeText={(v) => setMeasurements(m => ({ ...m, height: v }))}
                                maxLength={3}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-xs text-gray-500 mb-1">Pecho</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                placeholder="102"
                                keyboardType="numeric"
                                value={measurements.chest}
                                onChangeText={(v) => setMeasurements(m => ({ ...m, chest: v }))}
                                maxLength={3}
                            />
                        </View>
                    </View>

                    <View className="flex-row gap-3 mb-4">
                        <View className="flex-1">
                            <Text className="text-xs text-gray-500 mb-1">Cintura</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                placeholder="88"
                                keyboardType="numeric"
                                value={measurements.waist}
                                onChangeText={(v) => setMeasurements(m => ({ ...m, waist: v }))}
                                maxLength={3}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-xs text-gray-500 mb-1">Cadera</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                placeholder="98"
                                keyboardType="numeric"
                                value={measurements.hip}
                                onChangeText={(v) => setMeasurements(m => ({ ...m, hip: v }))}
                                maxLength={3}
                            />
                        </View>
                    </View>

                    <View className="flex-row gap-3 mb-6">
                        <View className="flex-1">
                            <Text className="text-xs text-gray-500 mb-1">Calzado (EU)</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900"
                                placeholder="43"
                                keyboardType="numeric"
                                value={measurements.shoeSize}
                                onChangeText={(v) => setMeasurements(m => ({ ...m, shoeSize: v }))}
                                maxLength={2}
                            />
                        </View>
                        <View className="flex-1" />
                    </View>

                    {/* O talla de referencia */}
                    <View className="flex-row items-center gap-4 mb-4">
                        <View className="flex-1 h-px bg-gray-200" />
                        <Text className="text-xs text-gray-400">O indica tu talla habitual</Text>
                        <View className="flex-1 h-px bg-gray-200" />
                    </View>

                    <Text className="text-sm font-medium text-gray-700 mb-2">
                        Talla en Zara / H&M
                    </Text>
                    <View className="flex-row flex-wrap gap-2 mb-4">
                        {REFERENCE_SIZES.map((size) => (
                            <TouchableOpacity
                                key={size}
                                onPress={() => setMeasurements(m => ({ ...m, referenceSize: size }))}
                                className={`px-5 py-3 rounded-xl ${measurements.referenceSize === size ? '' : 'bg-gray-100'}`}
                                style={measurements.referenceSize === size ? { backgroundColor: primaryColor } : {}}
                            >
                                <Text className={`font-medium ${measurements.referenceSize === size ? 'text-white' : 'text-gray-700'}`}>
                                    {size}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Guía de medidas */}
                    <TouchableOpacity className="flex-row items-center gap-2 mb-4">
                        <MaterialIcons name="help-outline" size={16} color="#9ca3af" />
                        <Text className="text-xs text-gray-400">Como tomar tus medidas</Text>
                    </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            ) : (
                renderResults()
            )}
        </View>
    );

    const renderResults = () => (
        <View>
            {/* Análisis IA si aplica */}
            {mode === 'ai' && aiAnalysis && (
                <View className="bg-gray-50 rounded-xl p-4 mb-4">
                    <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Analisis de tu foto
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                        <View className="bg-white px-3 py-1.5 rounded-full border border-gray-200">
                            <Text className="text-sm text-gray-700">
                                Complexion: <Text className="font-medium">{aiAnalysis.body_type}</Text>
                            </Text>
                        </View>
                        <View className="bg-white px-3 py-1.5 rounded-full border border-gray-200">
                            <Text className="text-sm text-gray-700">
                                Hombros: <Text className="font-medium">{aiAnalysis.shoulder_width}</Text>
                            </Text>
                        </View>
                    </View>
                    {aiAnalysis.build_notes && (
                        <Text className="text-xs text-gray-500 mt-2 italic">
                            "{aiAnalysis.build_notes}"
                        </Text>
                    )}
                </View>
            )}

            {/* Recomendaciones por prenda */}
            <Text className="text-sm font-medium text-gray-700 mb-3">
                Tallas recomendadas
            </Text>

            {recommendations.map((rec, index) => (
                <View
                    key={rec.item.id}
                    className={`flex-row items-center gap-3 p-4 rounded-xl mb-3 ${rec.confidence === 'high' ? 'bg-green-50 border border-green-200' : rec.confidence === 'medium' ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-200'}`}
                >
                    {/* Imagen del item */}
                    <View className="w-16 h-20 rounded-lg overflow-hidden border border-gray-200">
                        <Image source={{ uri: rec.item.image_url }} className="w-full h-full" resizeMode="cover" />
                    </View>

                    {/* Info */}
                    <View className="flex-1">
                        <Text className="font-medium text-gray-900" numberOfLines={1}>
                            {rec.item.name}
                        </Text>
                        <Text className="text-xs text-gray-500">
                            {rec.item.brand || 'Sin marca'} - {rec.brandFit}
                        </Text>

                        {/* Talla recomendada */}
                        <View className="flex-row items-baseline gap-2 mt-1">
                            <Text className="text-2xl font-bold" style={{ color: primaryColor }}>
                                {rec.recommendedSize}
                            </Text>
                            {rec.alternativeSize && (
                                <Text className="text-sm text-gray-400">
                                    o {rec.alternativeSize}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Confianza */}
                    <View className="items-end">
                        <MaterialIcons
                            name={rec.confidence === 'high' ? 'verified' : rec.confidence === 'medium' ? 'check-circle' : 'help'}
                            size={24}
                            color={rec.confidence === 'high' ? '#22c55e' : rec.confidence === 'medium' ? '#eab308' : '#9ca3af'}
                        />
                        <Text className={`text-xs mt-1 ${rec.confidence === 'high' ? 'text-green-600' : rec.confidence === 'medium' ? 'text-yellow-600' : 'text-gray-400'}`}>
                            {rec.confidence === 'high' ? 'Alta' : rec.confidence === 'medium' ? 'Media' : 'Baja'}
                        </Text>
                    </View>
                </View>
            ))}

            {/* Nota */}
            <View className="bg-blue-50 rounded-xl p-4 mt-2">
                <Text className="text-xs text-blue-700">
                    <Text className="font-medium">Nota:</Text> Las recomendaciones consideran el tallaje especifico de cada marca. Si tienes dudas, te sugerimos probar ambas tallas.
                </Text>
            </View>
        </View>
    );

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
                        Calcular Tallas
                    </Text>
                    <View className="w-10" />
                </View>

                {/* Content */}
                <ScrollView className="flex-1 p-4">
                    {/* Selector de modo (solo si no ha calculado) */}
                    {!calculated && renderModeSelector()}

                    {/* Contenido según modo */}
                    {mode === 'ai' ? renderAIMode() : renderManualMode()}
                </ScrollView>

                {/* Footer */}
                <View className="px-4 pb-8 pt-4 border-t border-gray-100">
                    {!calculated ? (
                        <TouchableOpacity
                            onPress={mode === 'ai' ? calculateWithAI : calculateWithMeasurements}
                            disabled={loading || activeItems.length === 0}
                            className="py-4 rounded-xl items-center flex-row justify-center gap-2"
                            style={{
                                backgroundColor: loading || activeItems.length === 0 ? '#d1d5db' : primaryColor,
                            }}
                        >
                            {loading ? (
                                <>
                                    <ActivityIndicator color="#fff" size="small" />
                                    <Text className="text-white font-semibold">
                                        {mode === 'ai' ? 'Analizando...' : 'Calculando...'}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <MaterialIcons
                                        name={mode === 'ai' ? 'auto-awesome' : 'calculate'}
                                        size={20}
                                        color="#fff"
                                    />
                                    <Text className="text-white font-semibold">
                                        {mode === 'ai' ? 'Analizar con IA' : 'Calcular Tallas'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => {
                                    setCalculated(false);
                                    setRecommendations([]);
                                }}
                                className="flex-1 py-4 rounded-xl items-center border"
                                style={{ borderColor: primaryColor }}
                            >
                                <Text style={{ color: primaryColor }} className="font-semibold">
                                    Recalcular
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={onClose}
                                className="flex-1 py-4 rounded-xl items-center"
                                style={{ backgroundColor: primaryColor }}
                            >
                                <Text className="text-white font-semibold">
                                    Entendido
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default SizeCalculatorModal;
