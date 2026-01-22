import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Platform, RefreshControl, useWindowDimensions, Alert, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
// Remove AddItemModal import
import { useRouter, useFocusEffect } from 'expo-router';
import { useGenderTheme } from '@/features/theme/hooks';

// Define item type matching Supabase + characteristics
type ClosetItem = {
    id: number;
    brand: string;
    name: string;
    image_url: string;
    category?: string;
    characteristics?: any; // JSONB from DB
};

type Gender = 'male' | 'female' | null;

export default function ClosetScreen() {
    const router = useRouter();
    const { classes, isFemale, colors } = useGenderTheme();
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const isLargeScreen = width > 768;
    const seasonFilters = ["Todas", "Invierno/Otoño", "Verano/Primavera"];

    const [selectedCategory, setSelectedCategory] = useState("Todo");
    const [selectedSeason, setSelectedSeason] = useState("Todas");
    const [items, setItems] = useState<ClosetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [gender, setGender] = useState<Gender>(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<ClosetItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Categorías dinámicas según género Y temporada
    const getCategoryFilters = (): string[] => {
        // Siempre incluir "Todo" al principio
        const base = ["Todo"];

        // Si no hay género seleccionado, mostrar categorías generales
        if (!gender) {
            return [...base, "Camiseta", "Pantalón", "Jersey", "Vestido", "Abrigo", "Calzado", "Accesorios"];
        }

        // Categorías según género y temporada
        // Categorías según género y temporada
        if (gender === 'male') {
            if (selectedSeason === 'Verano/Primavera') {
                return [...base, "Camiseta", "Polo", "Camisa", "Pantalón corto", "Bañador", "Calzado", "Accesorios"];
            } else if (selectedSeason === 'Invierno/Otoño') {
                return [...base, "Chaqueta", "Abrigo", "Jersey", "Chaleco", "Camiseta", "Pantalón", "Camisa", "Sudadera", "Calzado", "Accesorios"];
            } else {
                // "Todas" las temporadas - mostrar todas las categorías de hombre
                return [...base, "Camiseta", "Polo", "Camisa", "Pantalón", "Pantalón corto", "Bañador", "Chaqueta", "Abrigo", "Jersey", "Chaleco", "Sudadera", "Calzado", "Accesorios"];
            }
        } else if (gender === 'female') {
            if (selectedSeason === 'Verano/Primavera') {
                return [...base, "Vestido", "Mono", "Top", "Blusa", "Falda", "Shorts", "Baño", "Pantalón", "Camiseta", "Calzado", "Accesorios"];
            } else if (selectedSeason === 'Invierno/Otoño') {
                return [...base, "Abrigo", "Jersey", "Pantalón", "Falda", "Vestido", "Camiseta", "Calzado", "Accesorios"];
            } else {
                // "Todas" las temporadas - mostrar todas las categorías de mujer
                return [...base, "Vestido", "Mono", "Top", "Blusa", "Falda", "Shorts", "Baño", "Pantalón", "Camiseta", "Abrigo", "Jersey", "Calzado", "Accesorios"];
            }
        }

        return base;
    };

    const categoryFilters = getCategoryFilters();

    const fetchGender = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('gender')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Error fetching gender:', error);
            } else {
                setGender(data?.gender || null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchItems = async () => {
        try {
            let query = supabase
                .from('items')
                .select('*')
                .order('created_at', { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching items:', error);
            } else {
                setItems(data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Auto-refresh when screen comes into focus (e.g. back from add item or profile)
    useFocusEffect(
        useCallback(() => {
            fetchGender();
            fetchItems();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchItems();
    };

    const openDeleteModal = (item: ClosetItem) => {
        setItemToDelete(item);
        setDeleteModalVisible(true);
    };

    const closeDeleteModal = () => {
        setDeleteModalVisible(false);
        setItemToDelete(null);
    };

    const confirmDelete = async () => {
        if (!itemToDelete || deleting) return;

        setDeleting(true);
        try {
            const { error } = await supabase
                .from('items')
                .delete()
                .eq('id', itemToDelete.id);

            if (error) throw error;

            // Primero cerrar el modal y resetear estados
            setDeleteModalVisible(false);
            setDeleting(false);
            setItemToDelete(null);

            // Luego refrescar la lista
            await fetchItems();
        } catch (error: any) {
            console.error('Error deleting item:', error);
            setDeleting(false);
        }
    };

    // Filter items locally by both category and season
    const filteredItems = items.filter(item => {
        // Filter by category
        const categoryMatch = selectedCategory === "Todo" ||
            (item.category || item.characteristics?.category || '').toLowerCase().includes(selectedCategory.toLowerCase().slice(0, -1));

        // Filter by season
        const itemSeason = item.characteristics?.season || '';
        if (selectedSeason === "Todas") return categoryMatch;

        let seasonMatch = false;
        if (selectedSeason === 'Invierno/Otoño') {
            seasonMatch = itemSeason === 'Invierno' || itemSeason === 'Otoño' || itemSeason === 'Invierno/Otoño' || itemSeason === 'All Season';
        } else if (selectedSeason === 'Verano/Primavera') {
            seasonMatch = itemSeason === 'Verano' || itemSeason === 'Primavera' || itemSeason === 'Verano/Primavera' || itemSeason === 'Entretiempo' || itemSeason === 'All Season';
        }

        return categoryMatch && seasonMatch;
    });

    return (
        <SafeAreaView className={`flex-1 ${classes.background}`} edges={['top']}>
            {/* Header */}
            <View className={`px-6 py-4 border-b border-gray-200 dark:border-white/5 flex-row justify-between items-center sticky top-0 z-10 ${isFemale ? 'bg-white' : 'bg-transparent backdrop-blur-md'}`}>
                <Text className={`text-2xl font-extrabold tracking-tight font-display ${classes.text}`}>
                    IL BACO DA SETA
                </Text>

            </View>

            {/* Season Filters */}
            <View className="pt-4 pl-6">
                <Text className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 px-1">
                    Temporada
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-3 pr-6">
                    {seasonFilters.map((filter) => (
                        <TouchableOpacity
                            key={filter}
                            onPress={() => setSelectedSeason(filter)}
                            style={selectedSeason === filter ? { backgroundColor: colors.primary, borderColor: colors.primary } : {}}
                            className={`px-5 py-2 rounded-full border ${selectedSeason === filter ? '' : `${classes.card} ${classes.border}`}`}
                        >
                            <Text className={`text-sm font-medium ${selectedSeason === filter ? 'text-white' : classes.text}`}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Category Filters */}
            <View className="py-4 pl-6">
                <Text className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 px-1">
                    Tipo de Prenda
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-3 pr-6">
                    {categoryFilters.map((filter) => (
                        <TouchableOpacity
                            key={filter}
                            onPress={() => setSelectedCategory(filter)}
                            style={selectedCategory === filter ? { backgroundColor: colors.primary, borderColor: colors.primary } : {}}
                            className={`px-5 py-2 rounded-full border ${selectedCategory === filter ? '' : `${classes.card} ${classes.border}`}`}
                        >
                            <Text className={`text-sm font-medium ${selectedCategory === filter ? 'text-white' : classes.text}`}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Grid Content */}
            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingBottom: isWeb ? 160 : 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View className="flex-row justify-between items-end mb-4 px-2">
                    <Text className={`text-xs font-bold uppercase tracking-wider opacity-50 ${classes.text}`}>
                        Colección · {filteredItems.length} Items
                    </Text>
                </View>

                <View
                    className="flex-row flex-wrap"
                    style={{
                        gap: isWeb ? 16 : 8,
                        justifyContent: 'flex-start',
                    }}
                >
                    {filteredItems.length === 0 && !loading ? (
                        <View className="w-full py-10 items-center">
                            <Text className="text-gray-500">
                                {items.length === 0 ? "No hay prendas. ¡Añade alguna!" : "No hay prendas en esta categoría."}
                            </Text>
                        </View>
                    ) : (
                        filteredItems.map((item, index) => (
                            <ClosetItemCard
                                key={item.id}
                                item={item}
                                isWeb={isWeb}
                                screenWidth={width}
                                onDeletePress={() => openDeleteModal(item)}
                            />
                        ))
                    )}
                </View>
            </ScrollView>

            {/* FAB */}
            <View
                style={{
                    position: isWeb ? 'fixed' as any : 'absolute',
                    bottom: isWeb ? 90 : (Platform.OS === 'ios' ? 120 : 24),
                    right: 20,
                    zIndex: 50,
                }}
            >
                <TouchableOpacity
                    className="flex-row items-center justify-center h-14 rounded-full px-6"
                    style={{
                        backgroundColor: colors.primary,
                        gap: 8,
                        ...(isWeb ? { cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' } as any : {}),
                    }}
                    onPress={() => router.push('/add-item')}
                >
                    <Text className="text-2xl text-white">+</Text>
                    <Text className="text-white font-bold tracking-wide">Añadir</Text>
                </TouchableOpacity>
            </View>

            {/* Modal de confirmación de eliminación */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={deleteModalVisible}
                onRequestClose={closeDeleteModal}
            >
                <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View
                        className="bg-white dark:bg-gray-900 rounded-3xl mx-6 overflow-hidden"
                        style={{
                            width: isWeb ? 400 : '85%',
                            maxWidth: 400,
                            ...(isWeb ? { boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' } as any : {})
                        }}
                    >
                        {/* Header con icono */}
                        <View className="items-center pt-8 pb-4">
                            <View
                                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                                style={{ backgroundColor: `${colors.primary}15` }}
                            >
                                <Ionicons name="trash-outline" size={32} color={colors.primary} />
                            </View>
                            <Text
                                className="text-xl text-charcoal dark:text-white text-center"
                                style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
                            >
                                Eliminar Prenda
                            </Text>
                        </View>

                        {/* Contenido */}
                        <View className="px-6 pb-6">
                            <Text
                                className="text-center text-gray-600 dark:text-gray-400 text-base leading-relaxed"
                                style={{ fontFamily: 'Manrope_400Regular' }}
                            >
                                ¿Estás seguro de que quieres eliminar{' '}
                                <Text className="font-bold text-charcoal dark:text-white">
                                    "{itemToDelete?.name}"
                                </Text>
                                ? Esta acción no se puede deshacer.
                            </Text>
                        </View>

                        {/* Botones */}
                        <View className="flex-row border-t border-gray-200 dark:border-white/10">
                            <TouchableOpacity
                                onPress={closeDeleteModal}
                                className="flex-1 py-4 items-center justify-center border-r border-gray-200 dark:border-white/10"
                                disabled={deleting}
                            >
                                <Text
                                    className="text-base text-gray-600 dark:text-gray-400"
                                    style={{ fontFamily: 'Manrope_600SemiBold' }}
                                >
                                    Cancelar
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmDelete}
                                className="flex-1 py-4 items-center justify-center"
                                style={{ backgroundColor: colors.primary }}
                                disabled={deleting}
                            >
                                <Text
                                    className="text-base text-white"
                                    style={{ fontFamily: 'Manrope_600SemiBold' }}
                                >
                                    {deleting ? 'Eliminando...' : 'Eliminar'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const ClosetItemCard = ({ item, isWeb = false, screenWidth = 400, onDeletePress }: { item: ClosetItem, isWeb?: boolean, screenWidth?: number, onDeletePress?: () => void }) => {
    const router = useRouter();
    const { classes } = useGenderTheme();
    const chars = item.characteristics || {};

    // Calculate columns based on screen width
    const getColumns = () => {
        if (!isWeb) return 2;
        if (screenWidth > 1200) return 5;
        if (screenWidth > 900) return 4;
        if (screenWidth > 600) return 3;
        return 2;
    };

    const columns = getColumns();
    const gap = isWeb ? 16 : 8;
    const padding = 32; // px-4 = 16px each side
    const itemWidth = isWeb
        ? `calc((100% - ${(columns - 1) * gap}px) / ${columns})`
        : '48%';

    const handlePress = () => {
        router.push(`/item-detail?id=${item.id}`);
    };

    return (
        <View
            style={{
                width: itemWidth as any,
                marginBottom: 16,
                ...(isWeb ? { cursor: 'pointer' } as any : {}),
            }}
        >
            <Pressable onPress={handlePress}>
                <View className="aspect-[3/4] w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2 border border-gray-100 dark:border-white/5 relative">
                    <Image source={{ uri: item.image_url }} className="w-full h-full" resizeMode="cover" />
                    {chars.color && (
                        <View className="absolute bottom-2 left-2 flex-row gap-1">
                            <View className="h-4 w-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: getColorHex(chars.color) }} />
                        </View>
                    )}
                </View>
                <View className="px-1">
                    {chars.pattern && chars.pattern !== 'Solid' && (
                        <Text className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">{chars.pattern}</Text>
                    )}
                    <Text className={`text-xs font-bold leading-tight mt-0.5 ${classes.text}`} numberOfLines={2}>
                        {item.name}
                    </Text>
                    <Text className="text-[10px] text-gray-500 mt-1 capitalize">{chars.season === 'All Season' ? 'Todo el año' : chars.season}</Text>
                </View>
            </Pressable>
            {/* Botón eliminar fuera del Pressable principal */}
            <Pressable
                onPress={onDeletePress}
                className="absolute top-2 right-2 p-2 rounded-full bg-red-500/90"
                style={{ zIndex: 20 }}
            >
                <Ionicons name="trash-outline" size={14} color="white" />
            </Pressable>
        </View>
    );
};

// Helper to map color names to simple hex for the dot
function getColorHex(colorName: string): string {
    const map: { [key: string]: string } = {
        'Negro': '#000000', 'Blanco': '#FFFFFF', 'Azul': '#0000FF', 'Azul Marino': '#000080',
        'Rojo': '#FF0000', 'Beige': '#F5F5DC', 'Verde': '#008000', 'Verde Oliva': '#808000',
        'Gris': '#808080', 'Amarillo': '#FFFF00', 'Rosa': '#FFC0CB'
    };
    return map[colorName] || '#CCCCCC';
}
