import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Button } from '@/features/ui/components';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { useGenderTheme } from '@/features/theme/hooks';

type Gender = 'male' | 'female' | null;

export default function ProfileScreen() {
    const { user, signOut, refreshProfile } = useAuth();
    const router = useRouter();
    const { classes, isFemale, colors } = useGenderTheme();
    const [gender, setGender] = useState<Gender>(null);
    const [modelPhoto, setModelPhoto] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    useEffect(() => {
        if (user) {
            fetchGender();
        }
    }, [user]);

    const fetchGender = async () => {
        try {

            const { data, error } = await supabase
                .from('profiles')
                .select('gender, model_photo_url')
                .eq('id', user?.id)
                .single();


            if (error) throw error;
            setGender(data?.gender || null);
            setModelPhoto(data?.model_photo_url || null);
        } catch (error) {
            console.error('Error fetching gender:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateGender = async (newGender: Gender) => {
        setSaving(true);
        try {
            console.log('[PROFILE] Updating gender to:', newGender);
            const { error } = await supabase
                .from('profiles')
                .update({ gender: newGender })
                .eq('id', user?.id);

            if (error) throw error;

            console.log('[PROFILE] Gender updated in DB, refreshing profile...');
            // Refresh the AuthContext to update the theme immediately
            await refreshProfile();

            setGender(newGender);
            console.log('[PROFILE] Profile refreshed, theme should update now');
            Alert.alert('Éxito', 'Género actualizado correctamente. Los colores de la app se han actualizado.');
        } catch (error: any) {
            console.error('[PROFILE] Error updating gender:', error);
            Alert.alert('Error', error.message || 'No se pudo actualizar el género');
        } finally {
            setSaving(false);
        }
    };

    const uploadModelPhoto = async (uri: string) => {
        if (!user) return;
        setUploadingPhoto(true);

        try {
            // Compress image
            const manipulateResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1080 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            const fileName = `model_${Date.now()}.jpg`;
            const filePath = `${user.id}/${fileName}`;
            const base64Str = manipulateResult.base64!;

            // Upload to Supabase
            const { error: uploadError } = await supabase.storage
                .from('model-photos')
                .upload(filePath, decode(base64Str), {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('model-photos')
                .getPublicUrl(filePath);

            // Update Profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ model_photo_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setModelPhoto(publicUrl);
            Alert.alert('Éxito', 'Foto de modelo actualizada');

        } catch (error: any) {
            console.error('Error uploading model photo:', error);
            Alert.alert('Error', 'No se pudo subir la foto');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled) {
            uploadModelPhoto(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled) {
            uploadModelPhoto(result.assets[0].uri);
        }
    };

    return (
        <SafeAreaView className={`flex-1 px-6 ${classes.background}`}>
            <Text className={`font-display text-2xl font-bold mb-6 mt-6 ${classes.text}`}>Perfil</Text>

            {user ? (
                <ScrollView
                    className="flex-1 -mx-6 px-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 130 }}
                >
                    <View className="items-center mb-8 mt-2">
                        <View className="w-28 h-28 bg-primary/10 rounded-full items-center justify-center mb-4 border border-primary/20">
                            <Text className="text-5xl">
                                {gender === 'male' ? '👨' : gender === 'female' ? '👩' : '👤'}
                            </Text>
                        </View>
                        <Text className="text-gray-600 dark:text-gray-300 font-display text-lg">{user.email}</Text>
                    </View>

                    {/* Gender Selection */}
                    <View className="mb-8">
                        <Text className={`text-lg font-bold mb-3 ${classes.text}`}>
                            Género
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Esto nos ayuda a personalizar las categorías de tu armario
                        </Text>

                        {loading ? (
                            <ActivityIndicator size="small" color="#C9A66B" />
                        ) : (
                            <View className="flex-row gap-4">
                                <TouchableOpacity
                                    onPress={() => updateGender('male')}
                                    disabled={saving}
                                    activeOpacity={0.7}
                                    style={gender === 'male' && isFemale ? { borderColor: colors.primary, backgroundColor: colors.primary + '15' } : {}}
                                    className={`flex-1 py-6 rounded-3xl border items-center justify-center shadow-sm ${gender === 'male'
                                        ? 'bg-primary/10 border-primary'
                                        : `${classes.card} border-transparent`
                                        }`}
                                >
                                    <Text className="text-4xl mb-3">👨</Text>
                                    <Text
                                        style={gender === 'male' && isFemale ? { color: colors.primary } : {}}
                                        className={`font-display font-medium text-base ${gender === 'male'
                                            ? 'text-primary'
                                            : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                    >
                                        Hombre
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => updateGender('female')}
                                    disabled={saving}
                                    activeOpacity={0.7}
                                    style={gender === 'female' && isFemale ? { borderColor: colors.primary, backgroundColor: colors.primary + '15' } : {}}
                                    className={`flex-1 py-6 rounded-3xl border items-center justify-center shadow-sm ${gender === 'female'
                                        ? 'bg-primary/10 border-primary'
                                        : `${classes.card} border-transparent`
                                        }`}
                                >
                                    <Text className="text-4xl mb-3">👩</Text>
                                    <Text
                                        style={gender === 'female' && isFemale ? { color: colors.primary } : {}}
                                        className={`font-display font-medium text-base ${gender === 'female'
                                            ? 'text-primary'
                                            : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                    >
                                        Mujer
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Model Photo Section */}
                    <View className="mb-8">
                        <Text className={`text-lg font-bold mb-2 ${classes.text}`}>
                            Tu Foto de Modelo
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Sube una foto tuya de cuerpo entero para probarte ropa virtualmente.
                        </Text>

                        <View className="items-center">
                            {modelPhoto ? (
                                <View className="relative w-40 h-56 rounded-xl overflow-hidden mb-4 border border-gray-200 dark:border-white/10 shadow-sm">
                                    <Image
                                        source={{ uri: modelPhoto }}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                    <View className="absolute top-2 right-2 flex-row gap-2">
                                        <TouchableOpacity
                                            onPress={() => setModelPhoto(null)}
                                            className="bg-black/50 p-1.5 rounded-full"
                                        >
                                            <Text className="text-white text-xs">✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}
                        </View>

                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={pickImage}
                                disabled={uploadingPhoto}
                                activeOpacity={0.7}
                                className={`flex-1 py-6 rounded-3xl items-center justify-center shadow-sm ${classes.card}`}
                            >
                                <View
                                    style={isFemale ? { backgroundColor: colors.primary + '15' } : {}}
                                    className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mb-3">
                                    <Text className="text-xl">🖼️</Text>
                                </View>
                                <Text className={`font-display font-medium ${classes.text}`}>Galería</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={takePhoto}
                                disabled={uploadingPhoto}
                                activeOpacity={0.7}
                                className={`flex-1 py-6 rounded-3xl items-center justify-center shadow-sm ${classes.card}`}
                            >
                                <View
                                    style={isFemale ? { backgroundColor: colors.primary + '15' } : {}}
                                    className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mb-3">
                                    <Text className="text-xl">📸</Text>
                                </View>
                                <Text className={`font-display font-medium ${classes.text}`}>Cámara</Text>
                            </TouchableOpacity>
                        </View>
                        {uploadingPhoto && (
                            <View className="mt-4 items-center">
                                <ActivityIndicator size="small" color="#C9A66B" />
                                <Text className="text-xs text-gray-400 mt-1">Subiendo...</Text>
                            </View>
                        )}
                    </View>

                    <View className="mt-4">
                        <Button
                            title="Cerrar Sesión"
                            onPress={signOut}
                            variant="outline"
                            className={`w-full border-red-200 dark:border-red-900/30 ${classes.card}`}
                            textClassName="text-red-500 dark:text-red-400"
                            center
                        />
                    </View>
                </ScrollView>
            ) : (
                <View className="w-full items-center">
                    <Text className="text-gray-500 mb-6 text-center">Inicia sesión para ver tu perfil y guardar tus outfits.</Text>
                    {/* Login logic would go here, maybe redirect to a specialized login screen */}
                    <Button
                        title="Iniciar Sesión"
                        onPress={() => router.push('/login')}
                        variant="primary"
                        className="w-full max-w-xs"
                    />
                </View>
            )}
        </SafeAreaView>
    );
}
