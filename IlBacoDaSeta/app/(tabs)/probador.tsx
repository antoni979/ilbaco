import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, Modal, useWindowDimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useGenderTheme } from '@/features/theme/hooks';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { generateVirtualTryOn } from '@/features/assistant/services/virtual_try_on';

type ClosetItem = {
    id: number;
    brand: string;
    name: string;
    image_url: string;
    category?: string;
    characteristics?: any;
};

type Category = 'outerwear' | 'top' | 'bottom' | 'shoes';

const CATEGORY_CONFIG: { key: Category; label: string; icon: string; iconLib: 'material' | 'community' | 'emoji'; filter: string[]; subcategories: string[] }[] = [
    { key: 'outerwear', label: 'Abrigo', icon: 'ac-unit', iconLib: 'material', filter: ['abrigo', 'chaqueta', 'cazadora', 'blazer', 'gabardina', 'parka', 'plumas', 'cardigan', 'bomber', 'trench'], subcategories: ['Todo', 'Chaqueta', 'Abrigo', 'Blazer', 'Cazadora', 'Cardigan', 'Bomber'] },
    { key: 'top', label: 'Parte Arriba', icon: 'tshirt-crew-outline', iconLib: 'community', filter: ['camiseta', 'camisa', 'polo', 'top', 'blusa', 'jersey', 'sudadera', 'chaleco', 'vestido', 'mono'], subcategories: ['Todo', 'Camiseta', 'Camisa', 'Polo', 'Blusa', 'Jersey', 'Sudadera', 'Chaleco', 'Vestido'] },
    { key: 'bottom', label: 'Parte Abajo', icon: 'pants', iconLib: 'emoji', filter: ['pantalon', 'pantalón', 'shorts', 'falda', 'jeans', 'vaquero', 'bermuda', 'bañador'], subcategories: ['Todo', 'Pantalon', 'Shorts', 'Falda', 'Jeans', 'Bermuda'] },
    { key: 'shoes', label: 'Calzado', icon: 'shoe-formal', iconLib: 'community', filter: ['calzado', 'zapato', 'zapatilla', 'bota', 'sandalia', 'deportiva', 'tacon', 'mocasin'], subcategories: ['Todo', 'Zapatilla', 'Zapato', 'Bota', 'Sandalia', 'Deportiva'] },
];

// Helper para renderizar icono según librería
const CategoryIcon = ({ name, lib, size, color }: { name: string; lib: 'material' | 'community' | 'emoji'; size: number; color: string }) => {
    if (lib === 'emoji') {
        // Determinar opacidad según si está activo (color blanco) o no
        const isActive = color === '#fff' || color === 'white';
        const isGray = color === '#9ca3af' || color === '#d1d5db';
        return (
            <Text style={{
                fontSize: size - 4,
                opacity: isGray ? 0.4 : isActive ? 1 : 0.7,
                // Aplicar filtro de escala de grises en web
                ...(Platform.OS === 'web' && isGray ? { filter: 'grayscale(100%)' } as any : {})
            }}>
                {name === 'pants' ? '👖' : '👕'}
            </Text>
        );
    }
    if (lib === 'community') {
        return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
    }
    return <MaterialIcons name={name as any} size={size} color={color} />;
};

export default function ProbadorScreen() {
    const { classes, colors, isFemale } = useGenderTheme();
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';

    // Parametros del Personal Shopper
    const params = useLocalSearchParams<{
        preselectedTop?: string;
        preselectedBottom?: string;
        preselectedShoes?: string;
        customerPhoto?: string;
    }>();

    // Estados
    const [customerPhoto, setCustomerPhoto] = useState<string | null>(null);
    const [paramsLoaded, setParamsLoaded] = useState(false);
    const [activeCategory, setActiveCategory] = useState<Category>('outerwear');
    const [subCategoryFilter, setSubCategoryFilter] = useState<string>('Todo');
    const [selectedItems, setSelectedItems] = useState<{ outerwear: ClosetItem | null; top: ClosetItem | null; bottom: ClosetItem | null; shoes: ClosetItem | null }>({
        outerwear: null,
        top: null,
        bottom: null,
        shoes: null,
    });
    const [items, setItems] = useState<ClosetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);

    // Cargar items al montar (para web) y al recibir foco (para mobile)
    React.useEffect(() => {
        fetchItems();
    }, []);

    useFocusEffect(
        useCallback(() => {
            // Re-fetch al volver a la pantalla (mobile)
            if (!loading) {
                fetchItems();
            }
        }, [loading])
    );

    // Cargar preselecciones del Personal Shopper
    React.useEffect(() => {
        if (!loading && items.length > 0 && !paramsLoaded) {
            // Cargar foto del cliente si viene de Personal Shopper
            if (params.customerPhoto) {
                setCustomerPhoto(params.customerPhoto);
            }

            // Cargar items preseleccionados
            if (params.preselectedTop) {
                const topItem = items.find(i => i.id === parseInt(params.preselectedTop!));
                if (topItem) {
                    setSelectedItems(prev => ({ ...prev, top: topItem }));
                }
            }
            if (params.preselectedBottom) {
                const bottomItem = items.find(i => i.id === parseInt(params.preselectedBottom!));
                if (bottomItem) {
                    setSelectedItems(prev => ({ ...prev, bottom: bottomItem }));
                }
            }
            if (params.preselectedShoes) {
                const shoesItem = items.find(i => i.id === parseInt(params.preselectedShoes!));
                if (shoesItem) {
                    setSelectedItems(prev => ({ ...prev, shoes: shoesItem }));
                }
            }

            setParamsLoaded(true);
        }
    }, [loading, items, params, paramsLoaded]);

    const fetchItems = async () => {
        try {
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching items:', error);
            } else {
                setItems(data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Filtrar items por categoria activa y subcategoria
    const filteredItems = items.filter(item => {
        const category = (item.category || item.characteristics?.category || '').toLowerCase();
        const config = CATEGORY_CONFIG.find(c => c.key === activeCategory);
        if (!config) return false;

        // Primero filtrar por categoria principal
        const matchesCategory = config.filter.some(f => category.includes(f));
        if (!matchesCategory) return false;

        // Luego filtrar por subcategoria si no es "Todo"
        if (subCategoryFilter === 'Todo') return true;
        return category.includes(subCategoryFilter.toLowerCase());
    });

    // Resetear filtro de subcategoria al cambiar categoria principal
    const handleCategoryChange = (cat: Category) => {
        setActiveCategory(cat);
        setSubCategoryFilter('Todo');
    };

    // Capturar foto del cliente
    const capturePhoto = async (fromCamera: boolean) => {
        try {
            const options: ImagePicker.ImagePickerOptions = {
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 4],
                quality: 0.8,
            };

            const result = fromCamera
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);

            if (!result.canceled && result.assets[0]) {
                // Comprimir imagen
                const manipulated = await ImageManipulator.manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: 1080 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );

                if (manipulated.base64) {
                    setCustomerPhoto(`data:image/jpeg;base64,${manipulated.base64}`);
                }
            }
        } catch (error) {
            console.error('Error capturing photo:', error);
            Alert.alert('Error', 'No se pudo capturar la foto');
        }
    };

    // Seleccionar/deseleccionar item
    const toggleItem = (item: ClosetItem) => {
        setSelectedItems(prev => ({
            ...prev,
            [activeCategory]: prev[activeCategory]?.id === item.id ? null : item,
        }));
    };

    // Convertir URL a base64
    const urlToBase64 = async (url: string): Promise<string> => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error converting URL to base64:', error);
            throw error;
        }
    };

    // Generar probador virtual
    const handleGenerate = async () => {
        if (!customerPhoto) {
            Alert.alert('Falta foto', 'Por favor, captura una foto del cliente primero');
            return;
        }

        if (!selectedItems.top && !selectedItems.bottom) {
            Alert.alert('Faltan prendas', 'Selecciona al menos una prenda de arriba o de abajo');
            return;
        }

        setGenerating(true);

        try {
            console.log('[Probador] Iniciando generación...');
            console.log('[Probador] Foto cliente:', customerPhoto ? '✓' : '❌');
            console.log('[Probador] Top:', selectedItems.top?.name || '(no seleccionado)');
            console.log('[Probador] Bottom:', selectedItems.bottom?.name || '(no seleccionado)');

            // Convertir imagenes de items a base64
            let outerwearBase64: string | undefined;
            let topBase64: string = '';
            let bottomBase64: string = '';
            let shoesBase64: string | undefined;

            // Convertir top si existe
            if (selectedItems.top) {
                try {
                    console.log('[Probador] Convirtiendo top a base64...');
                    topBase64 = await urlToBase64(selectedItems.top.image_url);
                    console.log('[Probador] Top convertido:', topBase64 ? '✓' : '❌');
                } catch (e) {
                    console.error('[Probador] Error convirtiendo top:', e);
                    Alert.alert('Error', 'No se pudo cargar la imagen de la parte de arriba');
                    return;
                }
            }

            // Convertir bottom si existe
            if (selectedItems.bottom) {
                try {
                    console.log('[Probador] Convirtiendo bottom a base64...');
                    bottomBase64 = await urlToBase64(selectedItems.bottom.image_url);
                    console.log('[Probador] Bottom convertido:', bottomBase64 ? '✓' : '❌');
                } catch (e) {
                    console.error('[Probador] Error convirtiendo bottom:', e);
                    Alert.alert('Error', 'No se pudo cargar la imagen de la parte de abajo');
                    return;
                }
            }

            // Si solo hay una prenda, usarla para ambas posiciones
            const finalTop = topBase64 || bottomBase64;
            const finalBottom = bottomBase64 || topBase64;

            console.log('[Probador] Final - Top:', finalTop ? '✓' : '❌', 'Bottom:', finalBottom ? '✓' : '❌');

            if (selectedItems.outerwear) {
                try {
                    console.log('[Probador] Convirtiendo outerwear a base64...');
                    outerwearBase64 = await urlToBase64(selectedItems.outerwear.image_url);
                } catch (e) {
                    console.warn('[Probador] Error convirtiendo outerwear (continuando sin él):', e);
                }
            }

            if (selectedItems.shoes) {
                try {
                    console.log('[Probador] Convirtiendo shoes a base64...');
                    shoesBase64 = await urlToBase64(selectedItems.shoes.image_url);
                } catch (e) {
                    console.warn('[Probador] Error convirtiendo shoes (continuando sin ellos):', e);
                }
            }

            console.log('[Probador] Llamando a generateVirtualTryOn...');
            const result = await generateVirtualTryOn(
                customerPhoto,
                finalTop,
                finalBottom,
                shoesBase64,
                outerwearBase64
            );

            if (result) {
                console.log('[Probador] Resultado obtenido correctamente');
                setResultImage(result);
                setShowResult(true);

                // Guardar en historial
                await saveToHistory(result);
            } else {
                console.error('[Probador] generateVirtualTryOn retornó null');
                Alert.alert('Error', 'No se pudo generar el probador virtual. Intenta de nuevo.');
            }
        } catch (error: any) {
            console.error('[Probador] Error generating virtual try-on:', error);
            Alert.alert('Error', error.message || 'Ocurrio un error al generar el probador virtual');
        } finally {
            setGenerating(false);
        }
    };

    // Guardar en historial
    const saveToHistory = async (resultUrl: string) => {
        try {
            const itemsJson = {
                outerwear: selectedItems.outerwear ? { id: selectedItems.outerwear.id, name: selectedItems.outerwear.name, image: selectedItems.outerwear.image_url } : null,
                top: selectedItems.top ? { id: selectedItems.top.id, name: selectedItems.top.name, image: selectedItems.top.image_url } : null,
                bottom: selectedItems.bottom ? { id: selectedItems.bottom.id, name: selectedItems.bottom.name, image: selectedItems.bottom.image_url } : null,
                shoes: selectedItems.shoes ? { id: selectedItems.shoes.id, name: selectedItems.shoes.name, image: selectedItems.shoes.image_url } : null,
            };

            await supabase.from('try_on_history').insert({
                customer_photo_url: customerPhoto,
                outerwear_item_id: selectedItems.outerwear?.id || null,
                top_item_id: selectedItems.top?.id || null,
                bottom_item_id: selectedItems.bottom?.id || null,
                shoes_item_id: selectedItems.shoes?.id || null,
                result_image_url: resultUrl,
                generation_success: true,
                items_json: itemsJson,
            });

            console.log('[Probador] Historial guardado');
        } catch (error) {
            console.error('Error saving to history:', error);
        }
    };

    // Descargar imagen resultado
    const handleDownload = async () => {
        if (!resultImage) return;

        try {
            if (Platform.OS === 'web') {
                // Web: crear link de descarga
                const link = document.createElement('a');
                link.href = resultImage;
                link.download = `probador_${Date.now()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                Alert.alert('Descargado', 'La imagen se ha descargado');
            } else {
                // Mobile: guardar en cache y mostrar mensaje
                const filename = `${FileSystem.cacheDirectory}probador_${Date.now()}.jpg`;
                const base64Data = resultImage.replace(/^data:image\/\w+;base64,/, '');
                await FileSystem.writeAsStringAsync(filename, base64Data, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                Alert.alert('Guardado', 'Imagen guardada en cache. Puedes hacer captura de pantalla para guardarla.');
            }
        } catch (error) {
            console.error('Error downloading:', error);
            Alert.alert('Error', 'No se pudo descargar la imagen');
        }
    };

    // Limpiar todo para nuevo cliente
    const handleNewCustomer = () => {
        setCustomerPhoto(null);
        setSelectedItems({ outerwear: null, top: null, bottom: null, shoes: null });
        setResultImage(null);
        setShowResult(false);
    };

    // Contar items seleccionados
    const selectedCount = Object.values(selectedItems).filter(Boolean).length;
    const canGenerate = customerPhoto && (selectedItems.top || selectedItems.bottom);

    return (
        <SafeAreaView className={`flex-1 ${classes.background}`} edges={['top']}>
            {/* Header */}
            <View className={`px-6 py-4 border-b border-gray-200 flex-row justify-between items-center ${isFemale ? 'bg-white' : 'bg-transparent'}`}>
                <Text className={`text-2xl font-extrabold tracking-tight font-display ${classes.text}`}>
                    PROBADOR
                </Text>
                {customerPhoto && (
                    <TouchableOpacity onPress={handleNewCustomer} className="flex-row items-center gap-2">
                        <MaterialIcons name="person-add" size={20} color={colors.primary} />
                        <Text style={{ color: colors.primary }} className="font-semibold">Nuevo Cliente</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
                {/* Seccion Foto Cliente */}
                <View className="p-4">
                    <Text className={`text-xs font-bold uppercase tracking-wider opacity-50 mb-3 ${classes.text}`}>
                        1. Foto del Cliente
                    </Text>

                    {!customerPhoto ? (
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => capturePhoto(true)}
                                className="flex-1 h-40 rounded-2xl border-2 border-dashed border-gray-300 items-center justify-center"
                                style={isWeb ? { cursor: 'pointer' } as any : {}}
                            >
                                <MaterialIcons name="camera-alt" size={40} color="#9ca3af" />
                                <Text className="text-gray-400 mt-2 font-medium">Camara</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => capturePhoto(false)}
                                className="flex-1 h-40 rounded-2xl border-2 border-dashed border-gray-300 items-center justify-center"
                                style={isWeb ? { cursor: 'pointer' } as any : {}}
                            >
                                <MaterialIcons name="photo-library" size={40} color="#9ca3af" />
                                <Text className="text-gray-400 mt-2 font-medium">Galeria</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className="flex-row gap-4">
                            <View className="w-32 h-44 rounded-2xl overflow-hidden border border-gray-200">
                                <Image source={{ uri: customerPhoto }} className="w-full h-full" resizeMode="cover" />
                            </View>
                            <View className="flex-1 justify-center">
                                <Text className={`font-semibold mb-2 ${classes.text}`}>Foto capturada</Text>
                                <TouchableOpacity
                                    onPress={() => setCustomerPhoto(null)}
                                    className="flex-row items-center gap-2"
                                >
                                    <MaterialIcons name="refresh" size={18} color="#9ca3af" />
                                    <Text className="text-gray-400">Cambiar foto</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Seccion Seleccion de Prendas */}
                <View className="p-4">
                    <Text className={`text-xs font-bold uppercase tracking-wider opacity-50 mb-3 ${classes.text}`}>
                        2. Seleccionar Prendas ({selectedCount} seleccionadas)
                    </Text>

                    {/* Tabs de categoria */}
                    <View className="flex-row gap-2 mb-3">
                        {CATEGORY_CONFIG.map(cat => {
                            const isActive = activeCategory === cat.key;
                            const hasSelection = selectedItems[cat.key] !== null;

                            return (
                                <TouchableOpacity
                                    key={cat.key}
                                    onPress={() => handleCategoryChange(cat.key)}
                                    className={`flex-1 py-3 rounded-xl items-center ${isActive ? '' : 'bg-gray-100'}`}
                                    style={isActive ? { backgroundColor: colors.primary } : {}}
                                >
                                    <CategoryIcon
                                        name={cat.icon}
                                        lib={cat.iconLib}
                                        size={24}
                                        color={isActive ? '#fff' : hasSelection ? colors.primary : '#9ca3af'}
                                    />
                                    <Text
                                        className={`text-xs mt-1 font-medium ${isActive ? 'text-white' : hasSelection ? '' : 'text-gray-400'}`}
                                        style={!isActive && hasSelection ? { color: colors.primary } : {}}
                                    >
                                        {cat.label}
                                    </Text>
                                    {hasSelection && !isActive && (
                                        <View className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Filtros de subcategoria */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
                        {CATEGORY_CONFIG.find(c => c.key === activeCategory)?.subcategories.map(sub => {
                            const isActive = subCategoryFilter === sub;
                            return (
                                <TouchableOpacity
                                    key={sub}
                                    onPress={() => setSubCategoryFilter(sub)}
                                    className={`px-4 py-2 rounded-full ${isActive ? '' : 'bg-gray-100'}`}
                                    style={isActive ? { backgroundColor: colors.primary } : {}}
                                >
                                    <Text className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-600'}`}>
                                        {sub}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Grid de prendas */}
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {loading ? (
                            <ActivityIndicator size="large" color={colors.primary} className="w-full py-10" />
                        ) : filteredItems.length === 0 ? (
                            <View className="w-full py-10 items-center">
                                <Text className="text-gray-400">No hay prendas en esta categoria</Text>
                            </View>
                        ) : (
                            filteredItems.map(item => {
                                const isSelected = selectedItems[activeCategory]?.id === item.id;

                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => toggleItem(item)}
                                        className="rounded-xl overflow-hidden"
                                        style={{
                                            width: isWeb ? 'calc(25% - 6px)' : '31%',
                                            aspectRatio: 3 / 4,
                                            borderWidth: isSelected ? 3 : 1,
                                            borderColor: isSelected ? colors.primary : '#e5e7eb',
                                        }}
                                    >
                                        <Image source={{ uri: item.image_url }} className="w-full h-full" resizeMode="cover" />
                                        {isSelected && (
                                            <View className="absolute top-2 right-2 w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}>
                                                <MaterialIcons name="check" size={16} color="#fff" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                </View>

                {/* Preview de seleccion */}
                {selectedCount > 0 && (
                    <View className="p-4">
                        <Text className={`text-xs font-bold uppercase tracking-wider opacity-50 mb-3 ${classes.text}`}>
                            Outfit Seleccionado
                        </Text>
                        <View className="flex-row gap-2">
                            {(['outerwear', 'top', 'bottom', 'shoes'] as Category[]).map(cat => {
                                const item = selectedItems[cat];
                                const config = CATEGORY_CONFIG.find(c => c.key === cat);

                                return (
                                    <View key={cat} className="flex-1 items-center">
                                        <View
                                            className="w-full aspect-square rounded-xl overflow-hidden border border-gray-200 items-center justify-center"
                                            style={{ backgroundColor: item ? 'transparent' : '#f3f4f6' }}
                                        >
                                            {item ? (
                                                <Image source={{ uri: item.image_url }} className="w-full h-full" resizeMode="cover" />
                                            ) : config ? (
                                                <CategoryIcon name={config.icon} lib={config.iconLib} size={20} color="#d1d5db" />
                                            ) : null}
                                        </View>
                                        <Text className="text-[10px] text-gray-400 mt-1">{config?.label}</Text>
                                        {item && (
                                            <TouchableOpacity onPress={() => setSelectedItems(prev => ({ ...prev, [cat]: null }))}>
                                                <Text className="text-[10px]" style={{ color: colors.primary }}>Quitar</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Boton Generar */}
            <View
                className="absolute left-4 right-4"
                style={{
                    bottom: isWeb ? 90 : Platform.OS === 'ios' ? 100 : 80,
                }}
            >
                <TouchableOpacity
                    onPress={handleGenerate}
                    disabled={!canGenerate || generating}
                    className="h-14 rounded-2xl items-center justify-center flex-row gap-2"
                    style={{
                        backgroundColor: canGenerate ? colors.primary : '#d1d5db',
                        opacity: generating ? 0.7 : 1,
                    }}
                >
                    {generating ? (
                        <>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text className="text-white font-bold text-lg">Generando...</Text>
                        </>
                    ) : (
                        <>
                            <MaterialIcons name="auto-awesome" size={24} color="#fff" />
                            <Text className="text-white font-bold text-lg">Generar Probador Virtual</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Modal Resultado */}
            <Modal visible={showResult} animationType="slide" presentationStyle="fullScreen">
                <SafeAreaView className={`flex-1 ${classes.background}`}>
                    <View className="flex-1 p-4">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className={`text-xl font-bold ${classes.text}`}>Resultado</Text>
                            <View className="flex-row gap-3 items-center">
                                <TouchableOpacity onPress={handleDownload} className="p-2">
                                    <MaterialIcons name="download" size={26} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowResult(false)}>
                                    <MaterialIcons name="close" size={28} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {resultImage && (
                            <View className="flex-1 rounded-2xl overflow-hidden border border-gray-200">
                                <Image source={{ uri: resultImage }} className="w-full h-full" resizeMode="contain" />
                            </View>
                        )}

                        <View className="flex-row gap-3 mt-4">
                            <TouchableOpacity
                                onPress={() => {
                                    setShowResult(false);
                                }}
                                className="flex-1 h-12 rounded-xl items-center justify-center border"
                                style={{ borderColor: colors.primary }}
                            >
                                <Text style={{ color: colors.primary }} className="font-semibold">Cambiar Prendas</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setShowResult(false);
                                    handleNewCustomer();
                                }}
                                className="flex-1 h-12 rounded-xl items-center justify-center"
                                style={{ backgroundColor: colors.primary }}
                            >
                                <Text className="text-white font-semibold">Nuevo Cliente</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}
