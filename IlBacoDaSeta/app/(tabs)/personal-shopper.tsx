import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, useWindowDimensions, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { useGenderTheme } from '@/features/theme/hooks';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { analyzeCustomer, CustomerAnalysis, COLOR_PALETTE, EVENT_TYPES } from '@/features/shopper/services/customer_analysis';
import { recommendOutfits, RecommendedOutfit } from '@/features/shopper/services/outfit_recommender';
import { generateVirtualTryOn } from '@/features/assistant/services/virtual_try_on';

type Step = 'photo' | 'analyzing' | 'event' | 'length' | 'colors' | 'generating' | 'results';

type ClosetItem = {
    id: number;
    brand: string;
    name: string;
    image_url: string;
    category?: string;
    characteristics?: any;
};

export default function PersonalShopperScreen() {
    const { classes, colors, isFemale } = useGenderTheme();
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const router = useRouter();

    // Estados del flujo
    const [step, setStep] = useState<Step>('photo');
    const [customerPhoto, setCustomerPhoto] = useState<string | null>(null);
    const [customerAnalysis, setCustomerAnalysis] = useState<CustomerAnalysis | null>(null);

    // Preferencias
    const [eventType, setEventType] = useState<string>('');
    const [topLength, setTopLength] = useState<'manga_corta' | 'manga_larga' | ''>('');
    const [bottomLength, setBottomLength] = useState<'corto' | 'largo' | ''>('');
    const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
    const [avoidColors, setAvoidColors] = useState<string[]>([]);

    // Items y resultados
    const [items, setItems] = useState<ClosetItem[]>([]);
    const [itemsLoading, setItemsLoading] = useState(true);
    const [recommendedOutfits, setRecommendedOutfits] = useState<RecommendedOutfit[]>([]);
    const [sessionId, setSessionId] = useState<string>('');

    // Try-on directo
    const [generatingTryOn, setGeneratingTryOn] = useState(false);
    const [tryOnResult, setTryOnResult] = useState<string | null>(null);
    const [tryOnOutfitIndex, setTryOnOutfitIndex] = useState<number | null>(null);

    // Modal para cambiar prenda
    const [editingOutfitIndex, setEditingOutfitIndex] = useState<number | null>(null);
    const [editingCategory, setEditingCategory] = useState<'outerwear' | 'top' | 'bottom' | 'shoes' | null>(null);
    const [editingTab, setEditingTab] = useState<'recommended' | 'alternatives' | 'notRecommended'>('recommended');

    // Referencia para evitar múltiples fetches simultáneos
    const fetchPromiseRef = React.useRef<Promise<ClosetItem[]> | null>(null);

    // Cargar items al montar
    React.useEffect(() => {
        loadItems();
    }, []);

    // Recargar al volver a la pantalla
    useFocusEffect(
        useCallback(() => {
            loadItems();
        }, [])
    );

    const loadItems = async () => {
        // Si ya hay un fetch en progreso, esperar a que termine
        if (fetchPromiseRef.current) {
            return fetchPromiseRef.current;
        }
        return fetchItems();
    };

    const fetchItems = async (): Promise<ClosetItem[]> => {
        const promise = (async () => {
            try {
                setItemsLoading(true);
                console.log('[PersonalShopper] Cargando items...');

                const { data, error } = await supabase
                    .from('items')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    console.log(`[PersonalShopper] ${data.length} items cargados`);
                    setItems(data);
                    return data;
                } else {
                    console.error('[PersonalShopper] Error cargando items:', error);
                    return items; // Devolver lo que ya teníamos
                }
            } catch (e) {
                console.error('[PersonalShopper] Exception:', e);
                return items; // Devolver lo que ya teníamos
            } finally {
                setItemsLoading(false);
                fetchPromiseRef.current = null;
            }
        })();

        fetchPromiseRef.current = promise;
        return promise;
    };

    // Capturar foto
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
                const manipulated = await ImageManipulator.manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: 800 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );

                if (manipulated.base64) {
                    const photoData = `data:image/jpeg;base64,${manipulated.base64}`;
                    setCustomerPhoto(photoData);
                    setStep('analyzing');

                    // Analizar cliente con timeout de seguridad
                    try {
                        const analysis = await analyzeCustomer(manipulated.base64);
                        setCustomerAnalysis(analysis);
                    } catch (e) {
                        console.error('Error en análisis, continuando sin él:', e);
                        setCustomerAnalysis(null);
                    }
                    setStep('event');
                }
            }
        } catch (error) {
            console.error('Error capturing photo:', error);
            Alert.alert('Error', 'No se pudo capturar la foto');
            setStep('photo');
        }
    };

    // Generar recomendaciones
    const generateRecommendations = async () => {
        setStep('generating');

        try {
            // Esperar a que los items estén cargados (máximo 10 segundos)
            let currentItems = items;

            // Si hay un fetch en progreso, esperar a que termine
            if (fetchPromiseRef.current) {
                console.log('[PersonalShopper] Esperando fetch en progreso...');
                const timeoutPromise = new Promise<ClosetItem[]>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 10000)
                );
                try {
                    currentItems = await Promise.race([fetchPromiseRef.current, timeoutPromise]);
                } catch {
                    currentItems = items; // Usar lo que tengamos
                }
            }

            // Si aún no hay items, hacer fetch con timeout
            if (currentItems.length === 0) {
                console.log('[PersonalShopper] Items vacíos, obteniendo...');
                try {
                    const timeoutPromise = new Promise<ClosetItem[]>((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), 10000)
                    );
                    currentItems = await Promise.race([fetchItems(), timeoutPromise]);
                } catch {
                    console.error('[PersonalShopper] Timeout obteniendo items');
                }
            }

            // Si todavía no hay items, mostrar error y volver
            if (currentItems.length === 0) {
                Alert.alert('Sin prendas', 'No hay prendas en la tienda. Añade algunas primero.');
                setStep('colors');
                return;
            }

            console.log(`[PersonalShopper] Generando recomendaciones con ${currentItems.length} items`);

            const outfits = recommendOutfits({
                items: currentItems,
                customerAnalysis,
                eventType: eventType as any,
                topLength: topLength as any,
                bottomLength: bottomLength as any,
                favoriteColors,
                avoidColors,
            });

            console.log(`[PersonalShopper] ${outfits.length} outfits generados`);
            setRecommendedOutfits(outfits);

            // Guardar en historial (sin bloquear)
            supabase.from('shopper_history').insert({
                customer_photo_url: customerPhoto,
                customer_analysis: customerAnalysis,
                event_type: eventType,
                top_length: topLength,
                bottom_length: bottomLength,
                favorite_colors: favoriteColors,
                avoid_colors: avoidColors,
                recommended_outfits: outfits.map(o => ({
                    outerwear_id: o.outerwear?.id,
                    top_id: o.top.id,
                    bottom_id: o.bottom.id,
                    shoes_id: o.shoes?.id,
                    score: o.score,
                })),
            }).select('session_id').single().then(({ data }) => {
                if (data) setSessionId(data.session_id);
            }).catch(e => console.warn('Error guardando historial:', e));

            setStep('results');
        } catch (error) {
            console.error('Error generating recommendations:', error);
            Alert.alert('Error', 'No se pudieron generar las recomendaciones. Intenta de nuevo.');
            setStep('colors');
        }
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

    // Generar try-on directamente
    const generateTryOnDirect = async (outfit: RecommendedOutfit, index: number) => {
        if (!customerPhoto) {
            Alert.alert('Error', 'No hay foto del cliente');
            return;
        }

        setGeneratingTryOn(true);
        setTryOnOutfitIndex(index);

        try {
            // Guardar seleccion en historial
            if (sessionId) {
                supabase.from('shopper_history')
                    .update({ selected_outfit_index: index })
                    .eq('session_id', sessionId)
                    .then(() => console.log('Selection saved'));
            }

            // Convertir imagenes de prendas a base64
            const outerwearBase64 = outfit.outerwear ? await urlToBase64(outfit.outerwear.image_url) : undefined;
            const topBase64 = await urlToBase64(outfit.top.image_url);
            const bottomBase64 = await urlToBase64(outfit.bottom.image_url);
            const shoesBase64 = outfit.shoes ? await urlToBase64(outfit.shoes.image_url) : undefined;

            // Generar try-on (parámetros posicionales)
            const result = await generateVirtualTryOn(
                customerPhoto,
                topBase64,
                bottomBase64,
                shoesBase64,
                outerwearBase64
            );

            if (result) {
                setTryOnResult(result);
            } else {
                Alert.alert('Error', 'No se pudo generar el resultado');
            }
        } catch (error: any) {
            console.error('Error generating try-on:', error);
            Alert.alert('Error', error.message || 'Error al generar el probador virtual');
        } finally {
            setGeneratingTryOn(false);
        }
    };

    // Cerrar modal de resultado
    const closeTryOnModal = () => {
        setTryOnResult(null);
        setTryOnOutfitIndex(null);
    };

    // Categorías para filtrar items
    const CATEGORY_FILTERS: Record<string, string[]> = {
        outerwear: ['abrigo', 'chaqueta', 'cazadora', 'blazer', 'gabardina', 'parka', 'plumas', 'cardigan', 'bomber', 'trench'],
        top: ['camiseta', 'camisa', 'polo', 'top', 'blusa', 'jersey', 'sudadera', 'chaleco', 'vestido'],
        bottom: ['pantalon', 'pantalón', 'shorts', 'falda', 'jeans', 'vaquero', 'bermuda'],
        shoes: ['calzado', 'zapato', 'zapatilla', 'bota', 'sandalia', 'deportiva'],
    };

    // Colores neutros que combinan con todo
    const NEUTRAL_COLORS = ['negro', 'blanco', 'gris', 'beige', 'azul marino', 'marron', 'camel', 'crema'];

    // Combinaciones clásicas de colores
    const CLASSIC_COMBOS: [string, string][] = [
        ['azul marino', 'blanco'], ['negro', 'blanco'], ['gris', 'azul'],
        ['beige', 'azul marino'], ['blanco', 'azul'], ['negro', 'gris'],
        ['marron', 'beige'], ['verde oliva', 'beige'], ['burdeos', 'gris'],
        ['azul', 'blanco'], ['negro', 'rojo'], ['gris', 'rosa'],
    ];

    // Colores que chocan entre sí
    const CLASHING_COLORS: [string, string][] = [
        ['rojo', 'naranja'], ['rojo', 'rosa'], ['naranja', 'rosa'],
        ['verde', 'rojo'], ['morado', 'naranja'], ['azul', 'naranja'],
    ];

    // Obtener color de un item
    const getItemColor = (item: ClosetItem): string => {
        return (item.characteristics?.color || '').toLowerCase().trim();
    };

    // Verificar si un color está en una lista
    const colorInList = (itemColor: string, colorList: string[]): boolean => {
        const normalized = itemColor.toLowerCase();
        return colorList.some(c => normalized.includes(c.toLowerCase()) || c.toLowerCase().includes(normalized));
    };

    // Calcular score de compatibilidad para una prenda
    const scoreItemCompatibility = (item: ClosetItem, outfit: RecommendedOutfit, category: string): number => {
        let score = 50; // Base score
        const itemColor = getItemColor(item);

        // Obtener colores del resto del outfit
        const otherColors: string[] = [];
        if (category !== 'outerwear' && outfit.outerwear) otherColors.push(getItemColor(outfit.outerwear));
        if (category !== 'top') otherColors.push(getItemColor(outfit.top));
        if (category !== 'bottom') otherColors.push(getItemColor(outfit.bottom));
        if (category !== 'shoes' && outfit.shoes) otherColors.push(getItemColor(outfit.shoes));

        // 1. Bonus si el color favorece al cliente (análisis IA)
        if (customerAnalysis?.colors_that_favor) {
            if (colorInList(itemColor, customerAnalysis.colors_that_favor)) {
                score += 25;
            }
        }

        // 2. Penalizar si el color no favorece al cliente
        if (customerAnalysis?.colors_to_avoid) {
            if (colorInList(itemColor, customerAnalysis.colors_to_avoid)) {
                score -= 30;
            }
        }

        // 3. Bonus si está en colores favoritos del cliente
        if (colorInList(itemColor, favoriteColors)) {
            score += 20;
        }

        // 4. Penalizar si está en colores a evitar
        if (colorInList(itemColor, avoidColors)) {
            score -= 40;
        }

        // 5. Bonus por combinación clásica con el resto del outfit
        for (const otherColor of otherColors) {
            const isClassicCombo = CLASSIC_COMBOS.some(([c1, c2]) =>
                (itemColor.includes(c1) && otherColor.includes(c2)) ||
                (itemColor.includes(c2) && otherColor.includes(c1))
            );
            if (isClassicCombo) {
                score += 15;
            }
        }

        // 6. Bonus si es color neutro (combina con todo)
        if (colorInList(itemColor, NEUTRAL_COLORS)) {
            score += 10;
        }

        // 7. Penalizar colores que chocan
        for (const otherColor of otherColors) {
            const isClashing = CLASHING_COLORS.some(([c1, c2]) =>
                (itemColor.includes(c1) && otherColor.includes(c2)) ||
                (itemColor.includes(c2) && otherColor.includes(c1))
            );
            if (isClashing) {
                score -= 25;
            }
        }

        // 8. Penalizar si hay demasiados colores vibrantes
        const vibrantColors = ['rojo', 'naranja', 'amarillo', 'rosa', 'morado', 'verde'];
        const itemVibrant = vibrantColors.some(c => itemColor.includes(c));
        const outfitVibrantCount = otherColors.filter(oc =>
            vibrantColors.some(c => oc.includes(c))
        ).length;
        if (itemVibrant && outfitVibrantCount >= 2) {
            score -= 20;
        }

        return score;
    };

    // Clasificar items por compatibilidad
    const getItemsByCategoryClassified = (category: string) => {
        if (editingOutfitIndex === null) return { recommended: [], alternatives: [], notRecommended: [] };

        const outfit = recommendedOutfits[editingOutfitIndex];
        const filters = CATEGORY_FILTERS[category] || [];

        const categoryItems = items.filter(item => {
            const cat = (item.category || item.characteristics?.category || '').toLowerCase();
            return filters.some(f => cat.includes(f));
        });

        // Calcular score para cada item
        const scoredItems = categoryItems.map(item => ({
            item,
            score: scoreItemCompatibility(item, outfit, category),
        }));

        // Ordenar por score
        scoredItems.sort((a, b) => b.score - a.score);

        // Clasificar en 3 grupos
        const recommended: ClosetItem[] = [];
        const alternatives: ClosetItem[] = [];
        const notRecommended: ClosetItem[] = [];

        for (const { item, score } of scoredItems) {
            if (score >= 65) {
                recommended.push(item);
            } else if (score >= 40) {
                alternatives.push(item);
            } else {
                notRecommended.push(item);
            }
        }

        return { recommended, alternatives, notRecommended };
    };

    // Abrir modal para cambiar prenda
    const openEditModal = (outfitIndex: number, category: 'outerwear' | 'top' | 'bottom' | 'shoes') => {
        setEditingOutfitIndex(outfitIndex);
        setEditingCategory(category);
        setEditingTab('recommended'); // Siempre empezar en recomendados
    };

    // Cerrar modal de edición
    const closeEditModal = () => {
        setEditingOutfitIndex(null);
        setEditingCategory(null);
        setEditingTab('recommended');
    };

    // Cambiar prenda en un outfit
    const changeItem = (newItem: ClosetItem | null) => {
        if (editingOutfitIndex === null || editingCategory === null) return;

        setRecommendedOutfits(prev => {
            const updated = [...prev];
            updated[editingOutfitIndex] = {
                ...updated[editingOutfitIndex],
                [editingCategory]: newItem,
            };
            return updated;
        });
        closeEditModal();
    };

    // Reiniciar flujo
    const resetFlow = () => {
        setStep('photo');
        setCustomerPhoto(null);
        setCustomerAnalysis(null);
        setEventType('');
        setTopLength('');
        setBottomLength('');
        setFavoriteColors([]);
        setAvoidColors([]);
        setRecommendedOutfits([]);
    };

    // Toggle color en lista
    const toggleColor = (color: string, list: 'favorite' | 'avoid') => {
        if (list === 'favorite') {
            if (favoriteColors.includes(color)) {
                setFavoriteColors(favoriteColors.filter(c => c !== color));
            } else {
                // Quitar de avoid si estaba ahi
                setAvoidColors(avoidColors.filter(c => c !== color));
                setFavoriteColors([...favoriteColors, color]);
            }
        } else {
            if (avoidColors.includes(color)) {
                setAvoidColors(avoidColors.filter(c => c !== color));
            } else {
                // Quitar de favorites si estaba ahi
                setFavoriteColors(favoriteColors.filter(c => c !== color));
                setAvoidColors([...avoidColors, color]);
            }
        }
    };

    // Renderizar segun paso
    const renderStep = () => {
        switch (step) {
            case 'photo':
                return (
                    <View className="flex-1 p-6">
                        <View className="items-center mb-8">
                            <View className="w-20 h-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: `${colors.primary}20` }}>
                                <MaterialIcons name="auto-awesome" size={40} color={colors.primary} />
                            </View>
                            <Text className={`text-2xl font-bold text-center mb-2 ${classes.text}`}>
                                Personal Shopper
                            </Text>
                            <Text className="text-gray-500 text-center">
                                Te ayudaremos a encontrar el outfit perfecto
                            </Text>
                        </View>

                        <Text className={`text-lg font-semibold mb-4 ${classes.text}`}>
                            Primero, necesitamos una foto
                        </Text>

                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={() => capturePhoto(true)}
                                className="flex-1 h-44 rounded-2xl border-2 border-dashed border-gray-300 items-center justify-center"
                            >
                                <MaterialIcons name="camera-alt" size={48} color="#9ca3af" />
                                <Text className="text-gray-400 mt-2 font-medium">Camara</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => capturePhoto(false)}
                                className="flex-1 h-44 rounded-2xl border-2 border-dashed border-gray-300 items-center justify-center"
                            >
                                <MaterialIcons name="photo-library" size={48} color="#9ca3af" />
                                <Text className="text-gray-400 mt-2 font-medium">Galeria</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case 'analyzing':
                return (
                    <View className="flex-1 items-center justify-center p-6">
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text className={`text-lg font-semibold mt-4 ${classes.text}`}>
                            Analizando...
                        </Text>
                        <Text className="text-gray-500 mt-2 text-center">
                            Estamos analizando tu foto para darte las mejores recomendaciones
                        </Text>
                    </View>
                );

            case 'event':
                return (
                    <View className="flex-1 p-6">
                        <View className="flex-row items-center mb-6">
                            {customerPhoto && (
                                <Image source={{ uri: customerPhoto }} className="w-16 h-20 rounded-xl mr-4" resizeMode="cover" />
                            )}
                            <View className="flex-1">
                                <Text className={`text-xl font-bold ${classes.text}`}>Tipo de Evento</Text>
                                <Text className="text-gray-500">Para que ocasion buscas outfit?</Text>
                            </View>
                        </View>

                        <View className="gap-3">
                            {EVENT_TYPES.map(event => {
                                const isSelected = eventType === event.key;
                                return (
                                    <TouchableOpacity
                                        key={event.key}
                                        onPress={() => setEventType(event.key)}
                                        className={`p-4 rounded-2xl flex-row items-center ${isSelected ? '' : 'bg-gray-100'}`}
                                        style={isSelected ? { backgroundColor: colors.primary } : {}}
                                    >
                                        <MaterialIcons
                                            name={event.icon as any}
                                            size={28}
                                            color={isSelected ? '#fff' : '#666'}
                                        />
                                        <View className="ml-4 flex-1">
                                            <Text className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                                {event.label}
                                            </Text>
                                            <Text className={`text-sm ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                                                {event.description}
                                            </Text>
                                        </View>
                                        {isSelected && <MaterialIcons name="check" size={24} color="#fff" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            onPress={() => eventType && setStep('length')}
                            disabled={!eventType}
                            className="h-14 rounded-2xl items-center justify-center mt-6"
                            style={{ backgroundColor: eventType ? colors.primary : '#d1d5db' }}
                        >
                            <Text className="text-white font-bold text-lg">Continuar</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'length':
                return (
                    <View className="flex-1 p-6">
                        <Text className={`text-xl font-bold mb-2 ${classes.text}`}>Tipo de Ropa</Text>
                        <Text className="text-gray-500 mb-6">Que longitud prefieres?</Text>

                        <Text className={`font-semibold mb-3 ${classes.text}`}>Parte de Arriba</Text>
                        <View className="flex-row gap-3 mb-6">
                            <TouchableOpacity
                                onPress={() => setTopLength('manga_corta')}
                                className={`flex-1 p-4 rounded-xl items-center ${topLength === 'manga_corta' ? '' : 'bg-gray-100'}`}
                                style={topLength === 'manga_corta' ? { backgroundColor: colors.primary } : {}}
                            >
                                <MaterialIcons name="wb-sunny" size={32} color={topLength === 'manga_corta' ? '#fff' : '#666'} />
                                <Text className={`font-medium mt-2 ${topLength === 'manga_corta' ? 'text-white' : 'text-gray-700'}`}>
                                    Manga Corta
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setTopLength('manga_larga')}
                                className={`flex-1 p-4 rounded-xl items-center ${topLength === 'manga_larga' ? '' : 'bg-gray-100'}`}
                                style={topLength === 'manga_larga' ? { backgroundColor: colors.primary } : {}}
                            >
                                <MaterialIcons name="ac-unit" size={32} color={topLength === 'manga_larga' ? '#fff' : '#666'} />
                                <Text className={`font-medium mt-2 ${topLength === 'manga_larga' ? 'text-white' : 'text-gray-700'}`}>
                                    Manga Larga
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text className={`font-semibold mb-3 ${classes.text}`}>Parte de Abajo</Text>
                        <View className="flex-row gap-3 mb-6">
                            <TouchableOpacity
                                onPress={() => setBottomLength('corto')}
                                className={`flex-1 p-4 rounded-xl items-center ${bottomLength === 'corto' ? '' : 'bg-gray-100'}`}
                                style={bottomLength === 'corto' ? { backgroundColor: colors.primary } : {}}
                            >
                                <MaterialIcons name="content-cut" size={32} color={bottomLength === 'corto' ? '#fff' : '#666'} />
                                <Text className={`font-medium mt-2 ${bottomLength === 'corto' ? 'text-white' : 'text-gray-700'}`}>
                                    Corto
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setBottomLength('largo')}
                                className={`flex-1 p-4 rounded-xl items-center ${bottomLength === 'largo' ? '' : 'bg-gray-100'}`}
                                style={bottomLength === 'largo' ? { backgroundColor: colors.primary } : {}}
                            >
                                <MaterialIcons name="straighten" size={32} color={bottomLength === 'largo' ? '#fff' : '#666'} />
                                <Text className={`font-medium mt-2 ${bottomLength === 'largo' ? 'text-white' : 'text-gray-700'}`}>
                                    Largo
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={() => topLength && bottomLength && setStep('colors')}
                            disabled={!topLength || !bottomLength}
                            className="h-14 rounded-2xl items-center justify-center mt-4"
                            style={{ backgroundColor: topLength && bottomLength ? colors.primary : '#d1d5db' }}
                        >
                            <Text className="text-white font-bold text-lg">Continuar</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'colors':
                // Detectar colores recomendados/evitados por IA (normalizados)
                const aiRecommended = (customerAnalysis?.colors_that_favor || []).map(c => c.toLowerCase());
                const aiAvoid = (customerAnalysis?.colors_to_avoid || []).map(c => c.toLowerCase());

                return (
                    <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 120 }}>
                        <Text className={`text-xl font-bold mb-2 ${classes.text}`}>Preferencias de Color</Text>
                        <Text className="text-gray-500 mb-4">
                            Los colores con <Text className="text-yellow-600">★</Text> te favorecen segun tu tono de piel
                        </Text>

                        {/* Botones rapidos para aplicar recomendaciones IA */}
                        {(aiRecommended.length > 0 || aiAvoid.length > 0) && (
                            <View className="flex-row gap-3 mb-4">
                                {aiRecommended.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            const colorsToAdd = COLOR_PALETTE
                                                .filter(c => aiRecommended.some(r => c.name.toLowerCase().includes(r) || r.includes(c.name.toLowerCase())))
                                                .map(c => c.name);
                                            setFavoriteColors([...new Set([...favoriteColors, ...colorsToAdd])]);
                                            setAvoidColors(avoidColors.filter(c => !colorsToAdd.includes(c)));
                                        }}
                                        className="flex-1 py-3 rounded-xl flex-row items-center justify-center gap-2"
                                        style={{ backgroundColor: `${colors.primary}15` }}
                                    >
                                        <MaterialIcons name="star" size={18} color={colors.primary} />
                                        <Text style={{ color: colors.primary }} className="font-semibold text-sm">Usar recomendados</Text>
                                    </TouchableOpacity>
                                )}
                                {aiAvoid.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            const colorsToAvoid = COLOR_PALETTE
                                                .filter(c => aiAvoid.some(r => c.name.toLowerCase().includes(r) || r.includes(c.name.toLowerCase())))
                                                .map(c => c.name);
                                            setAvoidColors([...new Set([...avoidColors, ...colorsToAvoid])]);
                                            setFavoriteColors(favoriteColors.filter(c => !colorsToAvoid.includes(c)));
                                        }}
                                        className="flex-1 py-3 rounded-xl flex-row items-center justify-center gap-2 bg-gray-100"
                                    >
                                        <MaterialIcons name="block" size={18} color="#666" />
                                        <Text className="font-semibold text-sm text-gray-600">Evitar no recomendados</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Instruccion */}
                        <Text className="text-gray-400 text-xs mb-3">Toca: nada → favorito → evitar → nada</Text>

                        {/* Paleta de colores */}
                        <View className="flex-row flex-wrap gap-3 mb-6">
                            {COLOR_PALETTE.map(color => {
                                const isFav = favoriteColors.includes(color.name);
                                const isAvoid = avoidColors.includes(color.name);
                                const isAiRecommended = aiRecommended.some(r => color.name.toLowerCase().includes(r) || r.includes(color.name.toLowerCase()));
                                const isAiAvoid = aiAvoid.some(r => color.name.toLowerCase().includes(r) || r.includes(color.name.toLowerCase()));

                                return (
                                    <TouchableOpacity
                                        key={color.name}
                                        onPress={() => {
                                            if (!isFav && !isAvoid) {
                                                setFavoriteColors([...favoriteColors, color.name]);
                                            } else if (isFav) {
                                                setFavoriteColors(favoriteColors.filter(c => c !== color.name));
                                                setAvoidColors([...avoidColors, color.name]);
                                            } else {
                                                setAvoidColors(avoidColors.filter(c => c !== color.name));
                                            }
                                        }}
                                        className="items-center"
                                        style={{ width: (width - 48 - 24) / 5 }}
                                    >
                                        <View className="relative">
                                            <View
                                                className="w-11 h-11 rounded-full items-center justify-center"
                                                style={{
                                                    backgroundColor: color.hex,
                                                    borderWidth: isFav || isAvoid ? 3 : 1,
                                                    borderColor: isFav ? '#22c55e' : isAvoid ? '#ef4444' : '#e5e7eb',
                                                }}
                                            >
                                                {isFav && <MaterialIcons name="favorite" size={16} color={color.hex === '#FFFFFF' ? '#22c55e' : '#fff'} />}
                                                {isAvoid && <MaterialIcons name="close" size={16} color={color.hex === '#FFFFFF' ? '#ef4444' : '#fff'} />}
                                            </View>
                                            {/* Indicador IA */}
                                            {isAiRecommended && !isFav && !isAvoid && (
                                                <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 items-center justify-center">
                                                    <Text className="text-[8px] text-yellow-900">★</Text>
                                                </View>
                                            )}
                                            {isAiAvoid && !isFav && !isAvoid && (
                                                <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-400 items-center justify-center">
                                                    <Text className="text-[8px] text-white">✕</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text className="text-[10px] text-center text-gray-600 mt-1" numberOfLines={1}>
                                            {color.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Resumen compacto */}
                        {(favoriteColors.length > 0 || avoidColors.length > 0) && (
                            <View className="mb-4 p-3 rounded-xl bg-gray-50">
                                {favoriteColors.length > 0 && (
                                    <Text className="text-sm text-gray-700 mb-1">
                                        <Text className="text-green-600 font-medium">Favoritos:</Text> {favoriteColors.join(', ')}
                                    </Text>
                                )}
                                {avoidColors.length > 0 && (
                                    <Text className="text-sm text-gray-700">
                                        <Text className="text-red-500 font-medium">Evitar:</Text> {avoidColors.join(', ')}
                                    </Text>
                                )}
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={generateRecommendations}
                            className="h-14 rounded-2xl items-center justify-center"
                            style={{ backgroundColor: colors.primary }}
                        >
                            <Text className="text-white font-bold text-lg">Generar Recomendaciones</Text>
                        </TouchableOpacity>
                    </ScrollView>
                );

            case 'generating':
                return (
                    <View className="flex-1 items-center justify-center p-6">
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text className={`text-lg font-semibold mt-4 ${classes.text}`}>
                            {itemsLoading ? 'Cargando prendas...' : 'Creando outfits perfectos...'}
                        </Text>
                        <Text className="text-gray-500 mt-2 text-center">
                            {itemsLoading
                                ? 'Obteniendo tu colección de la tienda'
                                : `Analizando ${items.length} prendas para encontrar las mejores combinaciones`
                            }
                        </Text>
                    </View>
                );

            case 'results':
                // Textos amigables para el análisis
                const skinToneLabels: Record<string, string> = {
                    'muy_claro': 'Piel clara',
                    'claro': 'Piel clara',
                    'medio': 'Piel media',
                    'bronceado': 'Piel bronceada',
                    'oscuro': 'Piel oscura',
                    'muy_oscuro': 'Piel oscura',
                };
                const undertoneLabels: Record<string, string> = {
                    'frio': 'subtono frío (le favorecen azules, grises, platas)',
                    'calido': 'subtono cálido (le favorecen dorados, marrones, beiges)',
                    'neutro': 'subtono neutro (versatil con la mayoría de colores)',
                };
                const bodyLabels: Record<string, string> = {
                    'delgado': 'Complexión estilizada',
                    'atletico': 'Complexión atlética',
                    'medio': 'Complexión media',
                    'robusto': 'Complexión robusta',
                    'corpulento': 'Complexión grande',
                };
                const eventLabels: Record<string, string> = {
                    'formal': 'evento formal',
                    'elegante': 'ocasión elegante',
                    'trabajo': 'entorno laboral',
                    'casual': 'uso casual',
                };

                return (
                    <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
                        <View className="flex-row justify-between items-center mb-4">
                            <View>
                                <Text className={`text-xl font-bold ${classes.text}`}>Tus Outfits</Text>
                                <Text className="text-gray-500">Selecciona uno para probartelo</Text>
                            </View>
                            <TouchableOpacity onPress={resetFlow}>
                                <Text style={{ color: colors.primary }} className="font-semibold">Reiniciar</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Resumen para el vendedor */}
                        {customerAnalysis && (
                            <View className="mb-6 p-4 rounded-2xl border border-gray-200" style={{ backgroundColor: `${colors.primary}08` }}>
                                <View className="flex-row items-center gap-2 mb-3">
                                    <MaterialIcons name="psychology" size={20} color={colors.primary} />
                                    <Text style={{ color: colors.primary }} className="font-bold">Resumen del Análisis</Text>
                                </View>

                                {/* Info del cliente */}
                                <Text className="text-gray-700 text-sm leading-5 mb-2">
                                    <Text className="font-semibold">Perfil: </Text>
                                    {skinToneLabels[customerAnalysis.skin_tone] || 'Piel media'} con {undertoneLabels[customerAnalysis.skin_undertone] || 'subtono neutro'}.
                                    {' '}{bodyLabels[customerAnalysis.body_type] || ''}.
                                    {customerAnalysis.style_vibe && ` Estilo: ${customerAnalysis.style_vibe}.`}
                                </Text>

                                {/* Colores que favorecen */}
                                {customerAnalysis.colors_that_favor && customerAnalysis.colors_that_favor.length > 0 && (
                                    <Text className="text-gray-700 text-sm leading-5 mb-2">
                                        <Text className="font-semibold text-green-700">Colores recomendados: </Text>
                                        {customerAnalysis.colors_that_favor.join(', ')}.
                                    </Text>
                                )}

                                {/* Colores a evitar */}
                                {customerAnalysis.colors_to_avoid && customerAnalysis.colors_to_avoid.length > 0 && (
                                    <Text className="text-gray-700 text-sm leading-5 mb-2">
                                        <Text className="font-semibold text-red-600">Mejor evitar: </Text>
                                        {customerAnalysis.colors_to_avoid.join(', ')}.
                                    </Text>
                                )}

                                {/* Por qué estos outfits */}
                                <View className="mt-2 pt-2 border-t border-gray-200">
                                    <Text className="text-gray-600 text-xs">
                                        <Text className="font-semibold">Criterios aplicados: </Text>
                                        {eventType && `${eventLabels[eventType] || eventType}`}
                                        {topLength === 'manga_larga' ? ', manga larga' : topLength === 'manga_corta' ? ', manga corta' : ''}
                                        {bottomLength === 'largo' ? ', pantalón largo' : bottomLength === 'corto' ? ', pantalón corto' : ''}
                                        {favoriteColors.length > 0 && `, preferencia: ${favoriteColors.slice(0, 3).join(', ')}`}
                                        {avoidColors.length > 0 && `, evitando: ${avoidColors.slice(0, 2).join(', ')}`}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {recommendedOutfits.length === 0 ? (
                            <View className="py-10 items-center">
                                <MaterialIcons name="sentiment-dissatisfied" size={48} color="#9ca3af" />
                                <Text className="text-gray-500 mt-4 text-center">
                                    No encontramos outfits con tus preferencias.{'\n'}Intenta con menos restricciones.
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setStep('colors')}
                                    className="mt-4 px-6 py-3 rounded-xl"
                                    style={{ backgroundColor: colors.primary }}
                                >
                                    <Text className="text-white font-semibold">Cambiar preferencias</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View className="gap-6">
                                {recommendedOutfits.map((outfit, index) => {
                                    const isGenerating = generatingTryOn && tryOnOutfitIndex === index;
                                    return (
                                        <View key={index} className="bg-white rounded-2xl p-4 border border-gray-100">
                                            <View className="flex-row justify-between items-center mb-3">
                                                <Text className="font-bold text-lg">Outfit {index + 1}</Text>
                                                <View className="flex-row items-center gap-1 px-3 py-1 rounded-full" style={{ backgroundColor: `${colors.primary}20` }}>
                                                    <MaterialIcons name="star" size={16} color={colors.primary} />
                                                    <Text style={{ color: colors.primary }} className="font-semibold">
                                                        {Math.min(10, Math.round(outfit.score / 10))}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View className="flex-row gap-2 mb-4">
                                                {/* Abrigo */}
                                                <TouchableOpacity className="flex-1" onPress={() => openEditModal(index, 'outerwear')}>
                                                    <View className="relative">
                                                        {outfit.outerwear ? (
                                                            <Image source={{ uri: outfit.outerwear.image_url }} className="w-full aspect-[3/4] rounded-xl" resizeMode="cover" />
                                                        ) : (
                                                            <View className="w-full aspect-[3/4] rounded-xl bg-gray-100 items-center justify-center">
                                                                <MaterialIcons name="ac-unit" size={24} color="#d1d5db" />
                                                            </View>
                                                        )}
                                                        <View className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 items-center justify-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 }}>
                                                            <MaterialIcons name="edit" size={14} color={colors.primary} />
                                                        </View>
                                                    </View>
                                                    <Text className="text-[10px] text-gray-500 mt-1 text-center" numberOfLines={1}>
                                                        {outfit.outerwear?.name || 'Abrigo'}
                                                    </Text>
                                                </TouchableOpacity>
                                                {/* Parte Arriba */}
                                                <TouchableOpacity className="flex-1" onPress={() => openEditModal(index, 'top')}>
                                                    <View className="relative">
                                                        <Image source={{ uri: outfit.top.image_url }} className="w-full aspect-[3/4] rounded-xl" resizeMode="cover" />
                                                        <View className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 items-center justify-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 }}>
                                                            <MaterialIcons name="edit" size={14} color={colors.primary} />
                                                        </View>
                                                    </View>
                                                    <Text className="text-[10px] text-gray-500 mt-1 text-center" numberOfLines={1}>
                                                        {outfit.top.name}
                                                    </Text>
                                                </TouchableOpacity>
                                                {/* Parte Abajo */}
                                                <TouchableOpacity className="flex-1" onPress={() => openEditModal(index, 'bottom')}>
                                                    <View className="relative">
                                                        <Image source={{ uri: outfit.bottom.image_url }} className="w-full aspect-[3/4] rounded-xl" resizeMode="cover" />
                                                        <View className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 items-center justify-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 }}>
                                                            <MaterialIcons name="edit" size={14} color={colors.primary} />
                                                        </View>
                                                    </View>
                                                    <Text className="text-[10px] text-gray-500 mt-1 text-center" numberOfLines={1}>
                                                        {outfit.bottom.name}
                                                    </Text>
                                                </TouchableOpacity>
                                                {/* Calzado */}
                                                <TouchableOpacity className="flex-1" onPress={() => openEditModal(index, 'shoes')}>
                                                    <View className="relative">
                                                        {outfit.shoes ? (
                                                            <Image source={{ uri: outfit.shoes.image_url }} className="w-full aspect-[3/4] rounded-xl" resizeMode="cover" />
                                                        ) : (
                                                            <View className="w-full aspect-[3/4] rounded-xl bg-gray-100 items-center justify-center">
                                                                <MaterialCommunityIcons name="shoe-formal" size={24} color="#d1d5db" />
                                                            </View>
                                                        )}
                                                        <View className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 items-center justify-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 }}>
                                                            <MaterialIcons name="edit" size={14} color={colors.primary} />
                                                        </View>
                                                    </View>
                                                    <Text className="text-[10px] text-gray-500 mt-1 text-center" numberOfLines={1}>
                                                        {outfit.shoes?.name || 'Calzado'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>

                                            <TouchableOpacity
                                                onPress={() => generateTryOnDirect(outfit, index)}
                                                disabled={generatingTryOn}
                                                className="h-12 rounded-xl items-center justify-center flex-row gap-2"
                                                style={{ backgroundColor: isGenerating ? '#9ca3af' : colors.primary }}
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <ActivityIndicator size="small" color="#fff" />
                                                        <Text className="text-white font-semibold">Generando...</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <MaterialIcons name="auto-awesome" size={20} color="#fff" />
                                                        <Text className="text-white font-semibold">Probar este Outfit</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </ScrollView>
                );
        }
    };

    return (
        <SafeAreaView className={`flex-1 ${classes.background}`} edges={['top']}>
            {/* Header */}
            <View className={`px-6 py-4 border-b border-gray-200 flex-row justify-between items-center ${isFemale ? 'bg-white' : 'bg-transparent'}`}>
                <Text className={`text-2xl font-extrabold tracking-tight font-display ${classes.text}`}>
                    PERSONAL SHOPPER
                </Text>
                {step !== 'photo' && step !== 'analyzing' && step !== 'generating' && (
                    <TouchableOpacity onPress={resetFlow}>
                        <MaterialIcons name="refresh" size={24} color={colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Progress indicator */}
            {step !== 'photo' && step !== 'analyzing' && step !== 'generating' && (
                <View className="flex-row px-6 py-3 gap-2">
                    {['event', 'length', 'colors', 'results'].map((s, i) => (
                        <View
                            key={s}
                            className="flex-1 h-1 rounded-full"
                            style={{
                                backgroundColor: ['event', 'length', 'colors', 'results'].indexOf(step) >= i
                                    ? colors.primary
                                    : '#e5e7eb',
                            }}
                        />
                    ))}
                </View>
            )}

            {renderStep()}

            {/* Modal para cambiar prenda */}
            <Modal visible={editingCategory !== null} animationType="slide" transparent>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white rounded-t-3xl max-h-[85%]">
                        {/* Header */}
                        <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
                            <Text className="text-lg font-bold">
                                Cambiar {editingCategory === 'outerwear' ? 'Abrigo' : editingCategory === 'top' ? 'Parte Arriba' : editingCategory === 'bottom' ? 'Parte Abajo' : 'Calzado'}
                            </Text>
                            <TouchableOpacity onPress={closeEditModal} className="p-2">
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* Tabs de clasificación */}
                        <View className="flex-row p-3 gap-2 border-b border-gray-100">
                            <TouchableOpacity
                                onPress={() => setEditingTab('recommended')}
                                className={`flex-1 flex-row items-center justify-center gap-1 py-2 px-3 rounded-xl ${editingTab === 'recommended' ? 'bg-green-100' : 'bg-gray-100'}`}
                            >
                                <MaterialIcons name="thumb-up" size={16} color={editingTab === 'recommended' ? '#22c55e' : '#9ca3af'} />
                                <Text className={`text-xs font-semibold ${editingTab === 'recommended' ? 'text-green-700' : 'text-gray-500'}`}>
                                    Combina
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setEditingTab('alternatives')}
                                className={`flex-1 flex-row items-center justify-center gap-1 py-2 px-3 rounded-xl ${editingTab === 'alternatives' ? 'bg-yellow-100' : 'bg-gray-100'}`}
                            >
                                <MaterialIcons name="swap-horiz" size={16} color={editingTab === 'alternatives' ? '#eab308' : '#9ca3af'} />
                                <Text className={`text-xs font-semibold ${editingTab === 'alternatives' ? 'text-yellow-700' : 'text-gray-500'}`}>
                                    Opcional
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setEditingTab('notRecommended')}
                                className={`flex-1 flex-row items-center justify-center gap-1 py-2 px-3 rounded-xl ${editingTab === 'notRecommended' ? 'bg-red-100' : 'bg-gray-100'}`}
                            >
                                <MaterialIcons name="thumb-down" size={16} color={editingTab === 'notRecommended' ? '#ef4444' : '#9ca3af'} />
                                <Text className={`text-xs font-semibold ${editingTab === 'notRecommended' ? 'text-red-600' : 'text-gray-500'}`}>
                                    No combina
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Opción para quitar prenda (solo outerwear y shoes) */}
                        {(editingCategory === 'outerwear' || editingCategory === 'shoes') && (
                            <TouchableOpacity
                                onPress={() => changeItem(null)}
                                className="flex-row items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50"
                            >
                                <View className="w-12 h-14 rounded-lg bg-gray-200 items-center justify-center">
                                    <MaterialIcons name="remove-circle-outline" size={20} color="#9ca3af" />
                                </View>
                                <Text className="text-gray-600 font-medium">Sin {editingCategory === 'outerwear' ? 'abrigo' : 'calzado'}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Lista de items del tab seleccionado */}
                        <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 40 }}>
                            {editingCategory && (() => {
                                const { recommended, alternatives, notRecommended } = getItemsByCategoryClassified(editingCategory);

                                // Seleccionar items según el tab activo
                                const currentItems = editingTab === 'recommended' ? recommended
                                    : editingTab === 'alternatives' ? alternatives
                                    : notRecommended;

                                const emptyMessages = {
                                    recommended: 'No hay prendas que combinen perfecto',
                                    alternatives: 'No hay alternativas disponibles',
                                    notRecommended: 'No hay prendas en esta categoría'
                                };

                                return currentItems.length > 0 ? (
                                    <View className="flex-row flex-wrap gap-2">
                                        {currentItems.map(item => {
                                            const isSelected = editingOutfitIndex !== null &&
                                                recommendedOutfits[editingOutfitIndex]?.[editingCategory]?.id === item.id;
                                            return (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    onPress={() => changeItem(item)}
                                                    className="rounded-xl overflow-hidden"
                                                    style={{
                                                        width: '31%',
                                                        aspectRatio: 3 / 4,
                                                        borderWidth: isSelected ? 3 : 1,
                                                        borderColor: isSelected ? colors.primary : '#e5e7eb',
                                                    }}
                                                >
                                                    <Image source={{ uri: item.image_url }} className="w-full h-full" resizeMode="cover" />
                                                    {isSelected && (
                                                        <View className="absolute top-1 right-1 w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}>
                                                            <MaterialIcons name="check" size={14} color="#fff" />
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <View className="py-10 items-center">
                                        <MaterialIcons
                                            name={editingTab === 'recommended' ? 'inventory-2' : editingTab === 'alternatives' ? 'swap-horiz' : 'block'}
                                            size={40}
                                            color="#d1d5db"
                                        />
                                        <Text className="text-gray-400 mt-2 text-center">{emptyMessages[editingTab]}</Text>
                                    </View>
                                );
                            })()}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal resultado try-on */}
            <Modal visible={!!tryOnResult} animationType="slide" transparent>
                <View className="flex-1 bg-black/90 justify-center items-center p-6">
                    <View className="bg-white rounded-3xl overflow-hidden w-full max-w-md">
                        {/* Header */}
                        <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
                            <Text className="text-lg font-bold">Resultado</Text>
                            <TouchableOpacity onPress={closeTryOnModal} className="p-2">
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* Imagen resultado */}
                        {tryOnResult && (
                            <Image
                                source={{ uri: tryOnResult }}
                                className="w-full aspect-[3/4]"
                                resizeMode="contain"
                            />
                        )}

                        {/* Botones */}
                        <View className="p-4 gap-3">
                            <TouchableOpacity
                                onPress={() => {
                                    // Descargar imagen
                                    if (tryOnResult && Platform.OS === 'web') {
                                        const link = document.createElement('a');
                                        link.href = tryOnResult;
                                        link.download = `outfit-${Date.now()}.png`;
                                        link.click();
                                    }
                                }}
                                className="h-12 rounded-xl items-center justify-center flex-row gap-2 bg-gray-100"
                            >
                                <MaterialIcons name="download" size={20} color="#333" />
                                <Text className="font-semibold text-gray-800">Descargar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={closeTryOnModal}
                                className="h-12 rounded-xl items-center justify-center"
                                style={{ backgroundColor: colors.primary }}
                            >
                                <Text className="text-white font-semibold">Probar otro Outfit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
