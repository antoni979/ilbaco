// ============================================================
// Modal de Onboarding de Tallas
// ============================================================
// Guía al usuario para configurar su perfil de tallas
// Recopila: altura, talla de referencia, y analiza su foto

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    TextInput,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
    saveSizingProfile,
    analyzeAndSaveSizing,
    getSizingProfile,
    UserSizingProfile,
} from '../services/sizing_analysis';

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

interface SizingOnboardingModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    userPhoto?: string; // base64 de la foto del usuario (model_photo_url)
    onComplete?: (profile: UserSizingProfile) => void;
}

type Step = 'intro' | 'height' | 'reference' | 'analyzing' | 'complete';

// ------------------------------------------------------------
// CONSTANTES
// ------------------------------------------------------------

const REFERENCE_BRANDS = [
    { value: 'zara', label: 'Zara' },
    { value: 'h&m', label: 'H&M' },
    { value: 'mango', label: 'Mango' },
    { value: 'pull&bear', label: 'Pull & Bear' },
    { value: 'bershka', label: 'Bershka' },
    { value: 'uniqlo', label: 'Uniqlo' },
];

const SIZE_OPTIONS_LETTERS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const SIZE_OPTIONS_NUMERIC_TOPS_M = ['44', '46', '48', '50', '52', '54', '56'];
const SIZE_OPTIONS_NUMERIC_TOPS_F = ['32', '34', '36', '38', '40', '42', '44'];

const SIZE_OPTIONS_NUMERIC_BOTTOMS_M = ['38', '40', '42', '44', '46', '48', '50'];
const SIZE_OPTIONS_NUMERIC_BOTTOMS_F = ['32', '34', '36', '38', '40', '42', '44'];

const SIZE_OPTIONS_SHOES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

const FIT_PREFERENCES = [
    { value: 'slim', label: 'Ajustado', description: 'Ropa ceñida al cuerpo' },
    { value: 'regular', label: 'Regular', description: 'Corte estándar' },
    { value: 'loose', label: 'Holgado', description: 'Ropa amplia, oversize' },
];

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------

export const SizingOnboardingModal: React.FC<SizingOnboardingModalProps> = ({
    visible,
    onClose,
    userId,
    userPhoto,
    onComplete,
}) => {
    const [step, setStep] = useState<Step>('intro');
    const [loading, setLoading] = useState(false);

    // Datos del formulario
    const [heightCm, setHeightCm] = useState('');
    const [referenceBrand, setReferenceBrand] = useState('zara');
    const [sizeTop, setSizeTop] = useState('');
    const [sizeBottom, setSizeBottom] = useState('');
    const [sizeShoes, setSizeShoes] = useState('');
    const [preferredFit, setPreferredFit] = useState<'slim' | 'regular' | 'loose'>('regular');
    const [useLetters, setUseLetters] = useState(true);

    // Resultado del análisis
    const [analysisResult, setAnalysisResult] = useState<any>(null);

    // Reset al abrir
    useEffect(() => {
        if (visible) {
            setStep('intro');
            checkExistingProfile();
        }
    }, [visible]);

    const checkExistingProfile = async () => {
        const profile = await getSizingProfile(userId);
        if (profile && profile.onboarding_completed) {
            // Ya tiene perfil, mostrar resumen
            setHeightCm(profile.height_cm?.toString() || '');
            setReferenceBrand(profile.reference_brand || 'zara');
            setSizeTop(profile.reference_size_top || '');
            setSizeBottom(profile.reference_size_bottom || '');
            setSizeShoes(profile.reference_size_shoes || '');
            setPreferredFit(profile.preferred_fit as any || 'regular');
        }
    };

    // ------------------------------------------------------------
    // HANDLERS
    // ------------------------------------------------------------

    const handleNext = () => {
        switch (step) {
            case 'intro':
                setStep('height');
                break;
            case 'height':
                setStep('reference');
                break;
            case 'reference':
                handleSaveAndAnalyze();
                break;
        }
    };

    const handleBack = () => {
        switch (step) {
            case 'height':
                setStep('intro');
                break;
            case 'reference':
                setStep('height');
                break;
        }
    };

    const handleSaveAndAnalyze = async () => {
        setStep('analyzing');
        setLoading(true);

        try {
            // 1. Guardar datos básicos
            const profileData: Partial<UserSizingProfile> = {
                height_cm: heightCm ? parseInt(heightCm, 10) : undefined,
                reference_brand: referenceBrand,
                reference_size_top: sizeTop || undefined,
                reference_size_bottom: sizeBottom || undefined,
                reference_size_shoes: sizeShoes || undefined,
                preferred_fit: preferredFit,
            };

            await saveSizingProfile(userId, profileData);

            // 2. Si hay foto, analizar con IA
            if (userPhoto) {
                const result = await analyzeAndSaveSizing(userId, userPhoto);
                if (result.success && result.analysis) {
                    setAnalysisResult(result.analysis);
                }
            }

            // 3. Marcar onboarding como completado
            await saveSizingProfile(userId, { onboarding_completed: true });

            setStep('complete');

            // Obtener perfil actualizado
            const finalProfile = await getSizingProfile(userId);
            if (finalProfile && onComplete) {
                onComplete(finalProfile);
            }
        } catch (error) {
            console.error('[SizingOnboarding] Error:', error);
            Alert.alert('Error', 'No se pudo guardar tu perfil de tallas');
            setStep('reference');
        } finally {
            setLoading(false);
        }
    };

    // ------------------------------------------------------------
    // RENDERS
    // ------------------------------------------------------------

    const renderIntro = () => (
        <View className="flex-1 justify-center px-6">
            <View className="items-center mb-8">
                <View className="w-20 h-20 bg-blue-100 rounded-full items-center justify-center mb-4">
                    <MaterialIcons name="straighten" size={40} color="#3b82f6" />
                </View>
                <Text className="text-2xl font-bold text-center text-gray-900 mb-2">
                    Configura tu Talla
                </Text>
                <Text className="text-base text-center text-gray-600">
                    Te haremos unas preguntas rápidas para recomendarte la talla perfecta
                    en cada prenda.
                </Text>
            </View>

            <View className="bg-gray-50 rounded-xl p-4 mb-6">
                <Text className="text-sm text-gray-700 mb-2">
                    <MaterialIcons name="check-circle" size={16} color="#22c55e" /> Solo 2 minutos
                </Text>
                <Text className="text-sm text-gray-700 mb-2">
                    <MaterialIcons name="check-circle" size={16} color="#22c55e" /> Sin datos sensibles
                </Text>
                <Text className="text-sm text-gray-700">
                    <MaterialIcons name="check-circle" size={16} color="#22c55e" /> Recomendaciones precisas
                </Text>
            </View>
        </View>
    );

    const renderHeight = () => (
        <View className="flex-1 px-6 pt-4">
            <Text className="text-xl font-bold text-gray-900 mb-2">
                Tu altura (opcional)
            </Text>
            <Text className="text-sm text-gray-600 mb-6">
                Nos ayuda a recomendar el largo adecuado en pantalones y camisas.
            </Text>

            <View className="flex-row items-center mb-8">
                <TextInput
                    className="flex-1 bg-gray-100 rounded-xl px-4 py-4 text-lg text-gray-900"
                    placeholder="Ej: 175"
                    keyboardType="numeric"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    maxLength={3}
                />
                <Text className="ml-3 text-lg text-gray-600">cm</Text>
            </View>

            <Text className="text-xl font-bold text-gray-900 mb-2">
                Tu fit preferido
            </Text>
            <Text className="text-sm text-gray-600 mb-4">
                ¿Cómo te gusta que te quede la ropa?
            </Text>

            <View className="space-y-3">
                {FIT_PREFERENCES.map((fit) => (
                    <TouchableOpacity
                        key={fit.value}
                        onPress={() => setPreferredFit(fit.value as any)}
                        className={`flex-row items-center p-4 rounded-xl border-2 ${
                            preferredFit === fit.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white'
                        }`}
                    >
                        <View
                            className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
                                preferredFit === fit.value
                                    ? 'border-blue-500 bg-blue-500'
                                    : 'border-gray-300'
                            }`}
                        >
                            {preferredFit === fit.value && (
                                <MaterialIcons name="check" size={16} color="#fff" />
                            )}
                        </View>
                        <View className="flex-1">
                            <Text className="font-semibold text-gray-900">{fit.label}</Text>
                            <Text className="text-sm text-gray-500">{fit.description}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderReference = () => (
        <ScrollView className="flex-1 px-6 pt-4">
            <Text className="text-xl font-bold text-gray-900 mb-2">
                Tu talla de referencia
            </Text>
            <Text className="text-sm text-gray-600 mb-6">
                ¿Qué talla usas normalmente en estas marcas?
            </Text>

            {/* Selector de marca */}
            <Text className="text-sm font-medium text-gray-700 mb-2">Marca de referencia</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
                {REFERENCE_BRANDS.map((brand) => (
                    <TouchableOpacity
                        key={brand.value}
                        onPress={() => setReferenceBrand(brand.value)}
                        className={`px-4 py-2 rounded-full ${
                            referenceBrand === brand.value
                                ? 'bg-blue-500'
                                : 'bg-gray-100'
                        }`}
                    >
                        <Text
                            className={`font-medium ${
                                referenceBrand === brand.value
                                    ? 'text-white'
                                    : 'text-gray-700'
                            }`}
                        >
                            {brand.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Toggle letras/números */}
            <View className="flex-row items-center justify-between mb-4">
                <Text className="text-sm font-medium text-gray-700">Sistema de tallas</Text>
                <View className="flex-row bg-gray-100 rounded-full p-1">
                    <TouchableOpacity
                        onPress={() => setUseLetters(true)}
                        className={`px-4 py-1.5 rounded-full ${
                            useLetters ? 'bg-white shadow' : ''
                        }`}
                    >
                        <Text className={useLetters ? 'font-medium' : 'text-gray-500'}>
                            S/M/L
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setUseLetters(false)}
                        className={`px-4 py-1.5 rounded-full ${
                            !useLetters ? 'bg-white shadow' : ''
                        }`}
                    >
                        <Text className={!useLetters ? 'font-medium' : 'text-gray-500'}>
                            38/40/42
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Talla de tops */}
            <Text className="text-sm font-medium text-gray-700 mb-2">
                Talla de camisetas/camisas
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
                {(useLetters ? SIZE_OPTIONS_LETTERS : SIZE_OPTIONS_NUMERIC_TOPS_M).map(
                    (size) => (
                        <TouchableOpacity
                            key={size}
                            onPress={() => setSizeTop(size)}
                            className={`w-14 h-12 rounded-lg items-center justify-center ${
                                sizeTop === size
                                    ? 'bg-blue-500'
                                    : 'bg-gray-100'
                            }`}
                        >
                            <Text
                                className={`font-medium ${
                                    sizeTop === size ? 'text-white' : 'text-gray-700'
                                }`}
                            >
                                {size}
                            </Text>
                        </TouchableOpacity>
                    )
                )}
            </View>

            {/* Talla de bottoms */}
            <Text className="text-sm font-medium text-gray-700 mb-2">
                Talla de pantalones
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
                {(useLetters ? SIZE_OPTIONS_LETTERS : SIZE_OPTIONS_NUMERIC_BOTTOMS_M).map(
                    (size) => (
                        <TouchableOpacity
                            key={size}
                            onPress={() => setSizeBottom(size)}
                            className={`w-14 h-12 rounded-lg items-center justify-center ${
                                sizeBottom === size
                                    ? 'bg-blue-500'
                                    : 'bg-gray-100'
                            }`}
                        >
                            <Text
                                className={`font-medium ${
                                    sizeBottom === size ? 'text-white' : 'text-gray-700'
                                }`}
                            >
                                {size}
                            </Text>
                        </TouchableOpacity>
                    )
                )}
            </View>

            {/* Talla de calzado */}
            <Text className="text-sm font-medium text-gray-700 mb-2">
                Talla de calzado (EU)
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-8">
                {SIZE_OPTIONS_SHOES.map((size) => (
                    <TouchableOpacity
                        key={size}
                        onPress={() => setSizeShoes(size)}
                        className={`w-12 h-10 rounded-lg items-center justify-center ${
                            sizeShoes === size
                                ? 'bg-blue-500'
                                : 'bg-gray-100'
                        }`}
                    >
                        <Text
                            className={`font-medium ${
                                sizeShoes === size ? 'text-white' : 'text-gray-700'
                            }`}
                        >
                            {size}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );

    const renderAnalyzing = () => (
        <View className="flex-1 justify-center items-center px-6">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="text-lg font-medium text-gray-900 mt-4">
                Analizando tu perfil...
            </Text>
            <Text className="text-sm text-gray-500 mt-2 text-center">
                Estamos configurando tus recomendaciones de talla personalizadas
            </Text>
        </View>
    );

    const renderComplete = () => (
        <View className="flex-1 justify-center px-6">
            <View className="items-center mb-8">
                <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
                    <MaterialIcons name="check" size={40} color="#22c55e" />
                </View>
                <Text className="text-2xl font-bold text-center text-gray-900 mb-2">
                    ¡Perfil configurado!
                </Text>
                <Text className="text-base text-center text-gray-600">
                    Ahora te recomendaremos la talla perfecta en cada prenda.
                </Text>
            </View>

            {analysisResult && (
                <View className="bg-gray-50 rounded-xl p-4 mb-6">
                    <Text className="font-medium text-gray-900 mb-2">
                        Análisis de tu foto:
                    </Text>
                    <Text className="text-sm text-gray-700">
                        Complexión: {analysisResult.body_type}
                    </Text>
                    <Text className="text-sm text-gray-700">
                        Hombros: {analysisResult.shoulder_width}
                    </Text>
                    {analysisResult.build_notes && (
                        <Text className="text-sm text-gray-500 mt-2 italic">
                            "{analysisResult.build_notes}"
                        </Text>
                    )}
                </View>
            )}
        </View>
    );

    const renderContent = () => {
        switch (step) {
            case 'intro':
                return renderIntro();
            case 'height':
                return renderHeight();
            case 'reference':
                return renderReference();
            case 'analyzing':
                return renderAnalyzing();
            case 'complete':
                return renderComplete();
        }
    };

    const canProceed = () => {
        switch (step) {
            case 'intro':
                return true;
            case 'height':
                return true; // Altura es opcional
            case 'reference':
                return sizeTop || sizeBottom; // Al menos una talla
            default:
                return false;
        }
    };

    const getButtonText = () => {
        switch (step) {
            case 'intro':
                return 'Empezar';
            case 'height':
                return 'Siguiente';
            case 'reference':
                return 'Guardar y analizar';
            case 'complete':
                return 'Entendido';
            default:
                return 'Siguiente';
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
                    {step !== 'intro' && step !== 'analyzing' && step !== 'complete' ? (
                        <TouchableOpacity onPress={handleBack} className="p-2">
                            <MaterialIcons name="arrow-back" size={24} color="#374151" />
                        </TouchableOpacity>
                    ) : (
                        <View className="w-10" />
                    )}
                    <Text className="text-base font-medium text-gray-900">
                        Configurar talla
                    </Text>
                    {step !== 'analyzing' ? (
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <MaterialIcons name="close" size={24} color="#374151" />
                        </TouchableOpacity>
                    ) : (
                        <View className="w-10" />
                    )}
                </View>

                {/* Progress */}
                {step !== 'analyzing' && step !== 'complete' && (
                    <View className="flex-row px-6 pt-4 gap-2">
                        {['intro', 'height', 'reference'].map((s, i) => (
                            <View
                                key={s}
                                className={`flex-1 h-1 rounded-full ${
                                    ['intro', 'height', 'reference'].indexOf(step) >= i
                                        ? 'bg-blue-500'
                                        : 'bg-gray-200'
                                }`}
                            />
                        ))}
                    </View>
                )}

                {/* Content */}
                {renderContent()}

                {/* Footer */}
                {step !== 'analyzing' && (
                    <View className="px-6 pb-8">
                        <TouchableOpacity
                            onPress={step === 'complete' ? onClose : handleNext}
                            disabled={!canProceed() && step !== 'complete'}
                            className={`py-4 rounded-xl items-center ${
                                canProceed() || step === 'complete'
                                    ? 'bg-blue-500'
                                    : 'bg-gray-300'
                            }`}
                        >
                            <Text className="text-white font-semibold text-base">
                                {getButtonText()}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
};

export default SizingOnboardingModal;
