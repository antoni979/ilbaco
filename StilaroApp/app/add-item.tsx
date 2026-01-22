import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView, StyleSheet, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { analyzeClothingItem, ClothingCharacteristics } from '@/features/scanner/utils/ai_analysis';
import { removeBackgroundPhotoRoom } from '@/features/scanner/utils/photoroom_normalization';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/features/theme/hooks';

export default function AddItemScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [analysis, setAnalysis] = useState<ClothingCharacteristics | null>(null);
    const [normalizeImage, setNormalizeImage] = useState<boolean>(true); // Toggle for normalization

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setImageUri(result.assets[0].uri);
                setAnalysis(null);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'No se pudo seleccionar la imagen');
        }
    };

    const takePhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para tomar fotos.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setImageUri(result.assets[0].uri);
                setAnalysis(null);
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'No se pudo tomar la foto');
        }
    };

    const processAndUpload = async () => {
        if (!imageUri) return;

        try {
            setLoading(true);

            setStatus('Comprimiendo imagen...');
            const manipulateResult = await ImageManipulator.manipulateAsync(
                imageUri,
                [{ resize: { width: 1080 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            let finalBase64 = manipulateResult.base64!;

            // Normalize image if toggle is enabled
            if (normalizeImage) {
                setStatus('Normalizando imagen (fondo blanco)...');
                const normalizedBase64 = await removeBackgroundPhotoRoom(manipulateResult.base64!);

                if (normalizedBase64) {
                    // Extract base64 data from data URI
                    const base64Data = normalizedBase64.split(',')[1];
                    finalBase64 = base64Data;
                    console.log('[AddItem] ✓ Image normalized successfully');
                } else {
                    console.warn('[AddItem] Normalization failed, using original image');
                    Alert.alert(
                        "Aviso",
                        "No se pudo normalizar la imagen. Se usará la foto original.",
                        [{ text: "OK" }]
                    );
                }
            }

            setStatus('Subiendo al armario...');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No usuario autenticado");

            const fileName = `${Date.now()}.jpg`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('closet-items')
                .upload(filePath, decode(finalBase64), {
                    contentType: 'image/jpeg',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('closet-items')
                .getPublicUrl(filePath);

            setStatus('La IA está analizando tu prenda...');
            const aiResult = await analyzeClothingItem(manipulateResult.base64!);
            setAnalysis(aiResult);

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

            Alert.alert(
                "✨ ¡Guardado!",
                "La prenda se ha añadido a tu armario.",
                [
                    {
                        text: "Aceptar",
                        onPress: () => {
                            try {
                                router.back();
                            } catch {
                                // Ignore navigation errors
                            }
                        }
                    }
                ]
            );

        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Ocurrió un error al subir la prenda.");
            setStatus('');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        try {
            router.back();
        } catch {
            // Ignore navigation errors
        }
    };

    const isDark = colorScheme === 'dark';

    return (
        <View style={[styles.container, isDark && styles.containerDark]}>
            <View style={[styles.header, { marginTop: insets.top }]}>
                <View>
                    <Text style={styles.headerSubtitle}>Tu Armario</Text>
                    <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Nueva Pieza</Text>
                </View>
                <TouchableOpacity
                    onPress={handleClose}
                    style={[styles.closeButton, isDark && styles.closeButtonDark]}
                >
                    <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {!imageUri ? (
                    <View style={styles.emptyState}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            style={[styles.cameraCard, isDark && styles.cameraCardDark]}
                            onPress={takePhoto}
                        >
                            <View style={styles.cameraCardContent}>
                                <View style={[styles.iconCircle, isDark && styles.iconCircleDark]}>
                                    <Ionicons name="camera-outline" size={32} color="#C9A66B" />
                                </View>
                                <View style={styles.textContainer}>
                                    <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Hacer una Foto</Text>
                                    <Text style={styles.cardSubtitle}>Captura tu prenda ahora</Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={[styles.galleryButton, isDark && styles.galleryButtonDark]}
                            onPress={pickImage}
                        >
                            <Ionicons name="images-outline" size={20} color="#666" />
                            <Text style={[styles.galleryButtonText, isDark && styles.galleryButtonTextDark]}>Seleccionar de la Galería</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.imagePreview}>
                        <View style={styles.imageContainer}>
                            <Image
                                source={{ uri: imageUri }}
                                style={styles.image}
                                resizeMode="cover"
                            />

                            {!loading && (
                                <TouchableOpacity
                                    style={styles.removeButton}
                                    onPress={() => setImageUri(null)}
                                >
                                    <Ionicons name="close" size={20} color="white" />
                                </TouchableOpacity>
                            )}

                            {loading && (
                                <View style={styles.loadingOverlay}>
                                    <ActivityIndicator size="large" color="#C9A66B" />
                                    <Text style={styles.statusText}>{status}</Text>
                                </View>
                            )}
                        </View>

                        {!loading && (
                            <View style={styles.readyState}>
                                <View style={[styles.toggleContainer, isDark && styles.toggleContainerDark]}>
                                    <View style={styles.toggleInfo}>
                                        <Text style={[styles.toggleTitle, isDark && styles.toggleTitleDark]}>
                                            Normalizar Imagen
                                        </Text>
                                        <Text style={styles.toggleDescription}>
                                            Fondo blanco estilo tienda
                                        </Text>
                                    </View>
                                    <Switch
                                        value={normalizeImage}
                                        onValueChange={setNormalizeImage}
                                        trackColor={{ false: '#E5E7EB', true: '#C9A66B' }}
                                        thumbColor={normalizeImage ? '#FFFFFF' : '#f4f3f4'}
                                        ios_backgroundColor="#E5E7EB"
                                    />
                                </View>
                                <Text style={styles.readyText}>Lista para clasificar</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                        styles.saveButton,
                        (!imageUri || loading) && styles.saveButtonDisabled
                    ]}
                    disabled={!imageUri || loading}
                    onPress={processAndUpload}
                >
                    <Text style={[
                        styles.saveButtonText,
                        (!imageUri || loading) && styles.saveButtonTextDisabled
                    ]}>
                        {loading ? 'Procesando...' : 'Guardar Prenda'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9F6',
    },
    containerDark: {
        backgroundColor: '#0A0A0A',
    },
    header: {
        paddingHorizontal: 32,
        paddingTop: 24,
        paddingBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    headerSubtitle: {
        fontSize: 12,
        fontFamily: 'Manrope_600SemiBold',
        color: '#C9A66B',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontFamily: 'PlayfairDisplay_400Regular',
        color: '#1C1C1E',
    },
    headerTitleDark: {
        color: '#FFFFFF',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 24,
    },
    emptyState: {
        marginTop: 16,
        gap: 32,
    },
    cameraCard: {
        width: '100%',
        aspectRatio: 4/5,
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    cameraCardDark: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cameraCardContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F7F7F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircleDark: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    textContainer: {
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 20,
        fontFamily: 'PlayfairDisplay_400Regular',
        color: '#1C1C1E',
        marginBottom: 8,
    },
    cardTitleDark: {
        color: '#FFFFFF',
    },
    cardSubtitle: {
        color: '#9ca3af',
        fontFamily: 'Manrope_400Regular',
        fontSize: 14,
    },
    galleryButton: {
        width: '100%',
        paddingVertical: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        borderRadius: 16,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    galleryButtonDark: {
        borderColor: 'rgba(255,255,255,0.1)',
    },
    galleryButtonText: {
        color: '#1C1C1E',
        fontFamily: 'Manrope_500Medium',
        fontSize: 15,
    },
    galleryButtonTextDark: {
        color: '#FFFFFF',
    },
    imagePreview: {
        marginTop: 16,
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 3/4,
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: '#1C1C1E',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    removeButton: {
        position: 'absolute',
        top: 24,
        right: 24,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusText: {
        marginTop: 24,
        color: 'white',
        fontFamily: 'Manrope_500Medium',
        letterSpacing: 0.5,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    readyState: {
        marginTop: 32,
        marginBottom: 16,
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    toggleContainerDark: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    toggleInfo: {
        flex: 1,
        marginRight: 12,
    },
    toggleTitle: {
        fontSize: 15,
        fontFamily: 'Manrope_600SemiBold',
        color: '#1C1C1E',
        marginBottom: 4,
    },
    toggleTitleDark: {
        color: '#FFFFFF',
    },
    toggleDescription: {
        fontSize: 13,
        fontFamily: 'Manrope_400Regular',
        color: '#9CA3AF',
    },
    readyText: {
        textAlign: 'center',
        color: '#C9A66B',
        fontFamily: 'Manrope_500Medium',
        fontSize: 14,
        marginBottom: 16,
    },
    footer: {
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    saveButton: {
        width: '100%',
        paddingVertical: 20,
        borderRadius: 16,
        alignItems: 'center',
        backgroundColor: '#C9A66B',
        shadowColor: '#C9A66B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonDisabled: {
        backgroundColor: '#F0F0F0',
        opacity: 0.5,
        shadowOpacity: 0,
    },
    saveButtonText: {
        fontFamily: 'Manrope_700Bold',
        fontSize: 16,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: 'white',
    },
    saveButtonTextDisabled: {
        color: '#9ca3af',
    },
});
