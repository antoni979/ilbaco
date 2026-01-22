import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type ClothingItem = {
    id: number;
    name: string;
    brand: string;
    category: string;
    image_url: string;
    characteristics?: {
        color: string;
        secondary_color?: string;
        sub_category?: string;
        style: string;
        season: string;
        pattern: string;
        material_guess?: string;
        occasion?: string;
    };
};

const seasonOptions = ['Invierno', 'Verano', 'Entretiempo', 'All Season'];
const styleOptions = ['Casual', 'Formal', 'Deportivo', 'Elegante', 'Business', 'Fiesta', 'Vintage', 'Streetwear'];

export default function ItemDetailScreen() {
    const { id } = useLocalSearchParams();
    const [item, setItem] = useState<ClothingItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [gender, setGender] = useState<'male' | 'female' | null>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);

    // Estados editables
    const [editedName, setEditedName] = useState('');
    const [editedBrand, setEditedBrand] = useState('');
    const [editedCategory, setEditedCategory] = useState('');
    const [editedSubCategory, setEditedSubCategory] = useState('');
    const [editedSeason, setEditedSeason] = useState('');
    const [editedStyle, setEditedStyle] = useState('');

    useEffect(() => {
        fetchItem();
        fetchGender();
    }, [id]);

    const fetchGender = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('gender')
                .eq('id', user.id)
                .single();

            if (!error && data) {
                setGender(data.gender);
            }
        } catch (e) {
            console.error('Error fetching gender:', e);
        }
    };

    const getAvailableCategories = () => {
        if (gender === 'male') {
            return ["Camiseta", "Polo", "Camisa", "Pantalón", "Pantalón corto", "Bañador", "Chaqueta", "Abrigo", "Jersey", "Chaleco", "Sudadera", "Calzado", "Accesorios"];
        } else if (gender === 'female') {
            return ["Vestido", "Mono", "Top", "Blusa", "Falda", "Shorts", "Baño", "Pantalón", "Camiseta", "Abrigo", "Jersey", "Calzado", "Accesorios"];
        }
        return ["Camiseta", "Pantalón", "Jersey", "Vestido", "Abrigo", "Calzado", "Accesorios"];
    };

    const fetchItem = async () => {
        try {
            const itemId = Array.isArray(id) ? id[0] : id;
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .eq('id', parseInt(itemId as string))
                .single();

            if (error) throw error;

            setItem(data);
            setEditedName(data.name);
            setEditedBrand(data.brand || '');
            setEditedCategory(data.category || '');
            setEditedSubCategory(data.characteristics?.sub_category || '');
            setEditedSeason(data.characteristics?.season || '');
            setEditedStyle(data.characteristics?.style || '');
        } catch (error) {
            console.error('Error fetching item:', error);
            Alert.alert('Error', 'No se pudo cargar la prenda');
        } finally {
            setLoading(false);
        }
    };

    const saveChanges = async () => {
        if (!item) return;

        setSaving(true);
        try {
            const updatedCharacteristics = {
                ...item.characteristics,
                sub_category: editedSubCategory,
                season: editedSeason,
                style: editedStyle,
            };

            const { error } = await supabase
                .from('items')
                .update({
                    name: editedName,
                    brand: editedBrand,
                    category: editedCategory,
                    characteristics: updatedCharacteristics,
                })
                .eq('id', item.id);

            if (error) throw error;

            Alert.alert('Éxito', 'Cambios guardados correctamente');
            setEditMode(false);
            fetchItem();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudieron guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    const deleteItem = async () => {
        if (!item) return;

        Alert.alert(
            'Eliminar Prenda',
            '¿Estás seguro de que quieres eliminar esta prenda?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('items')
                                .delete()
                                .eq('id', item.id);

                            if (error) throw error;

                            Alert.alert('Éxito', 'Prenda eliminada', [
                                { text: 'OK', onPress: () => router.back() }
                            ]);
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'No se pudo eliminar la prenda');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark items-center justify-center">
                <ActivityIndicator size="large" color="#C9A66B" />
            </SafeAreaView>
        );
    }

    if (!item) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark items-center justify-center px-6">
                <Text className="text-gray-500">Prenda no encontrada</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-primary">Volver</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            {/* Header */}
            <View className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex-row justify-between items-center">
                <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
                    <Ionicons name="arrow-back" size={24} color="#888" />
                    <Text className="ml-2 text-lg font-semibold text-charcoal dark:text-white">Detalle</Text>
                </TouchableOpacity>
                <View className="flex-row space-x-3">
                    {editMode ? (
                        <>
                            <TouchableOpacity
                                onPress={() => setEditMode(false)}
                                className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10"
                            >
                                <Ionicons name="close" size={20} color="#888" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={saveChanges}
                                disabled={saving}
                                className="w-10 h-10 items-center justify-center rounded-full bg-primary"
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Ionicons name="checkmark" size={20} color="white" />
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                onPress={() => setEditMode(true)}
                                className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10"
                            >
                                <Ionicons name="pencil" size={20} color="#888" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={deleteItem}
                                className="w-10 h-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20"
                            >
                                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Image */}
                <View className="w-full aspect-[3/4] bg-gray-100 dark:bg-gray-800">
                    <Image source={{ uri: item.image_url }} className="w-full h-full" resizeMode="cover" />
                </View>

                {/* Details */}
                <View className="px-8 py-6">
                    {/* Name - Full Width */}
                    <View className="mb-8">
                        <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-primary mb-1.5">
                            NOMBRE
                        </Text>
                        {editMode ? (
                            <TextInput
                                value={editedName}
                                onChangeText={setEditedName}
                                className="text-2xl text-charcoal dark:text-white"
                                style={{ fontFamily: 'PlayfairDisplay_400Regular' }}
                                placeholder="Nombre de la prenda"
                                placeholderTextColor="#999"
                            />
                        ) : (
                            <Text className="text-2xl text-charcoal dark:text-white" style={{ fontFamily: 'PlayfairDisplay_400Regular' }}>
                                {item.name}
                            </Text>
                        )}
                    </View>

                    {/* Two Column Layout */}
                    <View className="flex-row gap-6">
                        {/* Left Column */}
                        <View className="flex-1">
                            {/* Brand */}
                            <View className="mb-6">
                                <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-primary mb-1.5">
                                    MARCA
                                </Text>
                                {editMode ? (
                                    <TextInput
                                        value={editedBrand}
                                        onChangeText={setEditedBrand}
                                        className="text-base text-charcoal dark:text-gray-300"
                                        style={{ fontFamily: 'Manrope_400Regular' }}
                                        placeholder="Marca"
                                        placeholderTextColor="#999"
                                    />
                                ) : (
                                    <Text className="text-base text-charcoal dark:text-gray-300" style={{ fontFamily: 'Manrope_400Regular' }}>
                                        {item.brand || 'Desconocido'}
                                    </Text>
                                )}
                            </View>

                            {/* Category */}
                            <View className="mb-6">
                                <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-primary mb-1.5">
                                    CATEGORÍA
                                </Text>
                                {editMode ? (
                                    <TouchableOpacity
                                        onPress={() => setShowCategoryModal(true)}
                                        className="flex-row justify-between items-center"
                                    >
                                        <Text className="text-base text-charcoal dark:text-gray-300" style={{ fontFamily: 'Manrope_400Regular' }}>
                                            {editedCategory || 'Seleccionar...'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={16} color="#C9A66B" />
                                    </TouchableOpacity>
                                ) : (
                                    <Text className="text-base text-charcoal dark:text-gray-300" style={{ fontFamily: 'Manrope_400Regular' }}>
                                        {item.category}
                                    </Text>
                                )}
                            </View>

                            {/* Subcategory */}
                            <View className="mb-6">
                                <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-primary mb-1.5">
                                    SUBCATEGORÍA
                                </Text>
                                {editMode ? (
                                    <TextInput
                                        value={editedSubCategory}
                                        onChangeText={setEditedSubCategory}
                                        className="text-base text-charcoal dark:text-gray-300"
                                        style={{ fontFamily: 'Manrope_400Regular' }}
                                        placeholder="Subcategoría"
                                        placeholderTextColor="#999"
                                    />
                                ) : (
                                    <Text className="text-base text-charcoal dark:text-gray-300" style={{ fontFamily: 'Manrope_400Regular' }}>
                                        {item.characteristics?.sub_category || 'No disponible'}
                                    </Text>
                                )}
                            </View>

                            {/* Color */}
                            {item.characteristics?.color && (
                                <View className="mb-6">
                                    <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-primary mb-1.5">
                                        COLOR
                                    </Text>
                                    <View className="flex-row items-center flex-wrap">
                                        <Text className="text-base text-charcoal dark:text-gray-300" style={{ fontFamily: 'Manrope_400Regular' }}>
                                            {item.characteristics.color}
                                        </Text>
                                        {item.characteristics.secondary_color && (
                                            <Text className="text-base text-gray-400 dark:text-gray-500 ml-2" style={{ fontFamily: 'Manrope_400Regular' }}>
                                                · {item.characteristics.secondary_color}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Right Column */}
                        <View className="flex-1">
                            {/* Season */}
                            <View className="mb-6">
                                <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-primary mb-1.5">
                                    TEMPORADA
                                </Text>
                                {editMode ? (
                                    <View className="flex-row flex-wrap gap-2">
                                        {seasonOptions.map(season => (
                                            <TouchableOpacity
                                                key={season}
                                                onPress={() => setEditedSeason(season)}
                                                className={`px-3 py-1.5 rounded-full border ${editedSeason === season
                                                        ? 'bg-primary border-primary'
                                                        : 'border-gray-200 dark:border-white/10'
                                                    }`}
                                            >
                                                <Text className={`text-xs ${editedSeason === season ? 'text-white' : 'text-charcoal dark:text-gray-300'}`} style={{ fontFamily: 'Manrope_500Medium' }}>
                                                    {season}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : (
                                    <Text className="text-base text-charcoal dark:text-gray-300" style={{ fontFamily: 'Manrope_400Regular' }}>
                                        {item.characteristics?.season === 'All Season' ? 'Todo el año' : item.characteristics?.season}
                                    </Text>
                                )}
                            </View>

                            {/* Style */}
                            <View className="mb-6">
                                <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-primary mb-1.5">
                                    ESTILO
                                </Text>
                                {editMode ? (
                                    <View className="flex-row flex-wrap gap-2">
                                        {styleOptions.map(style => (
                                            <TouchableOpacity
                                                key={style}
                                                onPress={() => setEditedStyle(style)}
                                                className={`px-3 py-1.5 rounded-full border ${editedStyle === style
                                                        ? 'bg-primary border-primary'
                                                        : 'border-gray-200 dark:border-white/10'
                                                    }`}
                                            >
                                                <Text className={`text-xs ${editedStyle === style ? 'text-white' : 'text-charcoal dark:text-gray-300'}`} style={{ fontFamily: 'Manrope_500Medium' }}>
                                                    {style}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : (
                                    <Text className="text-base text-charcoal dark:text-gray-300" style={{ fontFamily: 'Manrope_400Regular' }}>
                                        {item.characteristics?.style || 'No especificado'}
                                    </Text>
                                )}
                            </View>

                            {/* Pattern */}
                            {item.characteristics?.pattern && item.characteristics.pattern !== 'Solid' && (
                                <View className="mb-6">
                                    <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-primary mb-1.5">
                                        PATRÓN
                                    </Text>
                                    <Text className="text-base text-charcoal dark:text-gray-300" style={{ fontFamily: 'Manrope_400Regular' }}>
                                        {item.characteristics.pattern}
                                    </Text>
                                </View>
                            )}

                            {/* Material */}
                            {item.characteristics?.material_guess && (
                                <View className="mb-6">
                                    <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-primary mb-1.5">
                                        MATERIAL
                                    </Text>
                                    <Text className="text-base text-charcoal dark:text-gray-300" style={{ fontFamily: 'Manrope_400Regular' }}>
                                        {item.characteristics.material_guess}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Category Selection Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showCategoryModal}
                onRequestClose={() => setShowCategoryModal(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white dark:bg-gray-900 rounded-t-3xl h-[60%]">
                        <View className="p-4 border-b border-gray-200 dark:border-white/10 flex-row justify-between items-center">
                            <Text className="text-xl font-bold text-charcoal dark:text-white">Seleccionar Categoría</Text>
                            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                                <Ionicons name="close" size={24} color="#888" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={getAvailableCategories()}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    className={`p-4 border-b border-gray-100 dark:border-white/5 flex-row justify-between items-center ${item === editedCategory ? 'bg-primary/10' : ''}`}
                                    onPress={() => {
                                        setEditedCategory(item);
                                        setShowCategoryModal(false);
                                    }}
                                >
                                    <Text className={`text-lg ${item === editedCategory ? 'text-primary font-bold' : 'text-charcoal dark:text-gray-300'}`}>
                                        {item}
                                    </Text>
                                    {item === editedCategory && (
                                        <Ionicons name="checkmark" size={24} color="#C9A66B" />
                                    )}
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingBottom: 40 }}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
