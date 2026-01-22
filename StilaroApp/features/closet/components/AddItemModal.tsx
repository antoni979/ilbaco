import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { analyzeClothingItem, ClothingCharacteristics } from '@/features/scanner/utils/ai_analysis';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { decode } from 'base64-arraybuffer';

export default function AddItemScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [analysis, setAnalysis] = useState<ClothingCharacteristics | null>(null);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            setAnalysis(null);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para tomar fotos.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            setAnalysis(null);
        }
    };

    const processAndUpload = async () => {
        if (!imageUri) return;

        try {
            setLoading(true);

            // 1. Compress Image
            setStatus('Comprimiendo imagen...');
            const manipulateResult = await ImageManipulator.manipulateAsync(
                imageUri,
                [{ resize: { width: 1080 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            // Check size (approximate from base64 length)
            const sizeInKb = (manipulateResult.base64!.length * 0.75) / 1024;
            console.log(`Compressed size: ${sizeInKb.toFixed(2)}kb`);

            if (sizeInKb > 300) {
                console.warn("Image is slightly larger than 100kb target");
            }

            // 2. Upload to Supabase Storage
            setStatus('Subiendo al armario...');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No usuario autenticado");

            const fileName = `${Date.now()}.jpg`;
            const filePath = `${user.id}/${fileName}`;

            const base64Str = manipulateResult.base64!;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('closet-items')
                .upload(filePath, decode(base64Str), {
                    contentType: 'image/jpeg',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('closet-items')
                .getPublicUrl(filePath);

            // 3. AI Analysis
            setStatus('La IA está analizando tu prenda...');
            const aiResult = await analyzeClothingItem(manipulateResult.base64!);
            setAnalysis(aiResult);

            // 4. Save to Database
            setStatus('Guardando detalles...');
            const { error: dbError } = await supabase
                .from('items')
                .insert({
                    name: `${aiResult.sub_category || aiResult.category}${aiResult.material_guess ? ' de ' + aiResult.material_guess : ''} ${aiResult.color}`,
                    brand: aiResult.brand_guess || 'Desconocido',
                    category: aiResult.category,
                    image_url: publicUrl,
                    user_id: user.id,
                    characteristics: aiResult
                });

            if (dbError) throw dbError;

            setStatus('¡Listo!');
            Alert.alert("Éxito", "Prenda añadida y analizada correctamente.", [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Ocurrió un error al subir la prenda.");
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    const handleClose = () => {
        router.back();
    };

    return (
        <View className="flex-1 bg-background-light dark:bg-background-dark">
            {/* Header with improved typography and spacing */}
            <View className="px-8 pt-6 pb-4 flex-row justify-between items-center z-10">
                <View>
                    <Text className="text-sm font-display text-primary tracking-widest uppercase mb-1">Tu Armario</Text>
                    <Text className="text-3xl font-serif text-charcoal dark:text-white">Nueva Pieza</Text>
                </View>
                <TouchableOpacity
                    onPress={handleClose}
                    className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 items-center justify-center"
                >
                    <Ionicons name="close" size={20} color={insets.bottom ? "#000" : "#666"} />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                {!imageUri ? (
                    <View className="mt-4 space-y-6">
                        <View className="space-y-4">
                            <TouchableOpacity
                                activeOpacity={0.9}
                                className="w-full aspect-[4/5] rounded-[32px] overflow-hidden bg-white dark:bg-white/5 shadow-sm border border-gray-100 dark:border-white/5"
                                onPress={takePhoto}
                            >
                                <View className="flex-1 items-center justify-center space-y-6">
                                    <View className="w-20 h-20 rounded-full bg-off-white dark:bg-white/10 items-center justify-center">
                                        <Ionicons name="camera-outline" size={32} color="#C9A66B" />
                                    </View>
                                    <View className="items-center">
                                        <Text className="text-xl font-serif text-charcoal dark:text-white mb-2">Hacer una Foto</Text>
                                        <Text className="text-gray-400 font-display text-sm">Captura tu prenda ahora</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                className="w-full py-6 flex-row items-center justify-center space-x-3 rounded-2xl bg-transparent border border-gray-200 dark:border-white/10"
                                onPress={pickImage}
                            >
                                <Ionicons name="images-outline" size={20} color="#666" />
                                <Text className="text-charcoal dark:text-white font-display font-medium">Seleccionar de la Galería</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View className="mt-4">
                        <View className="w-full aspect-[3/4] rounded-[32px] overflow-hidden shadow-2xl bg-charcoal relative">
                            <Image
                                source={{ uri: imageUri }}
                                className="w-full h-full"
                                resizeMode="cover"
                            />
                            {/* Gradient Overlay for text readability at bottom if needed, or just clean */}

                            <TouchableOpacity
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md items-center justify-center border border-white/20"
                                onPress={() => setImageUri(null)}
                            >
                                <Ionicons name="close" size={20} color="white" />
                            </TouchableOpacity>

                            {/* Status Overlay */}
                            {loading && (
                                <View className="absolute inset-0 bg-black/60 items-center justify-center backdrop-blur-sm">
                                    <ActivityIndicator size="large" color="#C9A66B" />
                                    <Text className="mt-6 text-white font-display font-medium tracking-wide text-center px-8">
                                        {status}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Analysis Result Preview (Hidden if loading) */}
                        {!loading && (
                            <View className="mt-8 mb-4">
                                <Text className="text-center text-gray-400 font-display text-sm mb-4">
                                    Listo para guardar en tu colección
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            <View className="px-6 pt-4" style={{ paddingBottom: insets.bottom + 20 }}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    className={`w-full py-5 rounded-2xl items-center shadow-lg transform active:scale-95 transition-all ${!imageUri || loading
                            ? 'bg-gray-100 dark:bg-white/5 opacity-50'
                            : 'bg-primary shadow-primary/30'
                        }`}
                    disabled={!imageUri || loading}
                    onPress={processAndUpload}
                >
                    <Text className={`font-bold text-lg tracking-widest font-display uppercase ${!imageUri || loading
                            ? 'text-gray-400'
                            : 'text-white'
                        }`}>
                        {loading ? 'Procesando...' : 'Guardar Prenda'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
