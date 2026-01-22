import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform, Dimensions, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { generateVirtualTryOn } from '@/features/assistant/services/virtual_try_on';
import { Modal } from 'react-native';
import { useGenderTheme } from '@/features/theme/hooks';
import { Ionicons } from '@expo/vector-icons';

// Types
type ClosetItem = {
    id: number;
    brand: string;
    name: string;
    image_url: string;
    category?: string;
    characteristics?: any;
};

type GeneratedOutfit = {
    top?: ClosetItem;
    bottom?: ClosetItem;
    shoes?: ClosetItem;
    outerwear?: ClosetItem;
    score?: number; // Rating 1-10
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OutfitResultsScreen() {
    const params = useLocalSearchParams();
    const { colors, isFemale } = useGenderTheme();
    const insets = useSafeAreaInsets();

    // Parse outfits from params
    const outfits: GeneratedOutfit[] = params.outfits
        ? JSON.parse(params.outfits as string)
        : [];
    const formality = parseInt(params.formality as string || '3');
    const topLength = params.topLength as string || 'Largo';
    const bottomLength = params.bottomLength as string || 'Largo';
    const userModelPhoto = params.userModelPhoto as string || null;

    // Convert formality to label
    const getFormalityLabel = (level: number): string => {
        const labels = ['', 'Muy Casual', 'Casual', 'Smart Casual', 'Formal', 'Muy Formal'];
        return labels[level] || 'Smart Casual';
    };

    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);

    // Virtual Try On State
    const [isTryingOn, setIsTryingOn] = useState(false);
    const [tryOnResult, setTryOnResult] = useState<string | null>(null);
    const [showTryOnResult, setShowTryOnResult] = useState(false);
    const [currentOutfitScore, setCurrentOutfitScore] = useState<number | undefined>(undefined);

    // Image Zoom Modal State
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedImageName, setSelectedImageName] = useState<string>('');

    const handleImageClick = (imageUrl: string, itemName: string) => {
        setSelectedImage(imageUrl);
        setSelectedImageName(itemName);
        setShowImageModal(true);
    };

    // Helper: URI to Base64
    const urlToBase64 = async (url: string): Promise<string> => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result;
                    if (typeof base64data === 'string') {
                        const parts = base64data.split(',');
                        resolve(parts.length > 1 ? parts[1] : parts[0]);
                    } else {
                        reject(new Error("Unknown result type"));
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Error converting URL to Base64", e);
            throw e;
        }
    };

    const handleVirtualTryOn = async (outfit: GeneratedOutfit, showOuterwear: boolean = true) => {
        if (!outfit?.top || !outfit?.bottom) return;
        if (!userModelPhoto) {
            alert("Necesitas subir una foto tuya en el Perfil para usar el Probador Virtual.");
            return;
        }

        // Guardar el score del outfit actual
        setCurrentOutfitScore(outfit.score);

        setIsTryingOn(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            const topId = outfit.top.id;
            const bottomId = outfit.bottom.id;
            const shoesId = outfit.shoes?.id;
            const outerwearId = (outfit.outerwear && showOuterwear) ? outfit.outerwear.id : null;

            // Build cache key that includes all items
            const cacheKey = `${topId}-${bottomId}-${shoesId || 'none'}-${outerwearId || 'none'}`;
            console.log(`[VTON] Cache key: ${cacheKey}`);

            // 1. CHECK CACHE FIRST
            console.log(`[VTON] Checking cache for outfit...`);

            // Build query to match all items
            let cacheQuery = supabase
                .from('vton_cache')
                .select('result_image_url')
                .eq('user_id', user.id)
                .eq('top_item_id', topId)
                .eq('bottom_item_id', bottomId);

            // Add shoes filter if present
            if (shoesId) {
                cacheQuery = cacheQuery.eq('shoes_item_id', shoesId);
            } else {
                cacheQuery = cacheQuery.is('shoes_item_id', null);
            }

            // Add outerwear filter if present
            if (outerwearId) {
                cacheQuery = cacheQuery.eq('outerwear_item_id', outerwearId);
            } else {
                cacheQuery = cacheQuery.is('outerwear_item_id', null);
            }

            const { data: cachedResult, error: cacheError } = await cacheQuery.single();

            if (!cacheError && cachedResult) {
                // FOUND IN CACHE!
                console.log(`[VTON] ✓ Found in cache! Using cached image.`);
                setTryOnResult(cachedResult.result_image_url);
                setShowTryOnResult(true);
                setIsTryingOn(false);
                return;
            }

            // 2. NOT IN CACHE - GENERATE NEW
            console.log(`[VTON] Not in cache, generating new image...`);
            const userB64 = await urlToBase64(userModelPhoto);
            const topB64 = await urlToBase64(outfit.top.image_url);
            const bottomB64 = await urlToBase64(outfit.bottom.image_url);
            const shoesB64 = outfit.shoes ? await urlToBase64(outfit.shoes.image_url) : undefined;
            const outerB64 = (outfit.outerwear && showOuterwear)
                ? await urlToBase64(outfit.outerwear.image_url)
                : undefined;

            console.log(`[VTON] Generating with: top, bottom${shoesB64 ? ', shoes' : ''}${outerB64 ? ', outerwear' : ''}`);

            const result = await generateVirtualTryOn(userB64, topB64, bottomB64, shoesB64, outerB64);

            if (result) {
                // 3. SAVE TO CACHE (Try insert, ignore if exists)
                console.log(`[VTON] Saving to cache...`);
                const { error: insertError } = await supabase
                    .from('vton_cache')
                    .insert({
                        user_id: user.id,
                        top_item_id: topId,
                        bottom_item_id: bottomId,
                        shoes_item_id: shoesId || null,
                        outerwear_item_id: outerwearId || null,
                        result_image_url: result
                    });

                if (insertError) {
                    console.warn(`[VTON] Warning: Could not save to cache:`, insertError);
                } else {
                    console.log(`[VTON] ✓ Saved to cache successfully!`);
                }

                setTryOnResult(result);
                setShowTryOnResult(true);
            } else {
                alert("No se pudo generar el probador virtual. Intenta de nuevo.");
            }
        } catch (error: any) {
            console.error("[VTON] Error:", error);
            alert(`Error: ${error.message || 'Ocurrió un error'}`);
        } finally {
            setIsTryingOn(false);
        }
    };

    if (outfits.length === 0) {
        return (
            <View style={[styles.container, !isFemale && styles.containerDark]}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[styles.emptyText, !isFemale && styles.emptyTextDark]}>
                        No se encontraron outfits
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, !isFemale && styles.containerDark]}>
            <StatusBar barStyle={isFemale ? "dark-content" : "light-content"} />

            {/* Elegant Header */}
            <View style={[styles.header, { marginTop: insets.top }]}>
                <View>
                    <Text style={styles.headerSubtitle}>{getFormalityLabel(formality).toUpperCase()}</Text>
                    <Text style={[styles.headerTitle, !isFemale && styles.headerTitleDark]}>
                        Tus Outfits
                    </Text>
                    <Text style={styles.headerDetails}>
                        {topLength === 'Largo' ? '👔 Manga Larga' : '👕 Manga Corta'} • {bottomLength === 'Largo' ? '👖 Largo' : '🩳 Corto'}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={[styles.closeButton, !isFemale && styles.closeButtonDark]}
                >
                    <Ionicons name="close" size={20} color={isFemale ? "#666" : "#999"} />
                </TouchableOpacity>
            </View>

            {/* Page Indicators */}
            {outfits.length > 1 && (
                <View style={styles.indicators}>
                    {outfits.map((_, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => {
                                setCurrentIndex(index);
                                scrollViewRef.current?.scrollTo({
                                    x: SCREEN_WIDTH * index,
                                    animated: true
                                });
                            }}
                            style={[
                                styles.indicator,
                                currentIndex === index && styles.indicatorActive,
                                currentIndex === index && { backgroundColor: colors.primary }
                            ]}
                        />
                    ))}
                </View>
            )}

            {/* Outfits Carousel */}
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setCurrentIndex(index);
                }}
                style={styles.carousel}
            >
                {outfits.map((outfit, index) => (
                    <View key={index} style={{ width: SCREEN_WIDTH }}>
                        <OutfitCard
                            outfit={outfit}
                            index={index}
                            onTryOn={handleVirtualTryOn}
                            isTryingOn={isTryingOn}
                            userModelPhoto={userModelPhoto}
                            colors={colors}
                            isFemale={isFemale}
                            onImageClick={handleImageClick}
                        />
                    </View>
                ))}
            </ScrollView>

            {/* Try On Result Modal */}
            <Modal
                visible={showTryOnResult}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowTryOnResult(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalTitleContainer}>
                                <Text style={styles.modalTitle}>Probador Virtual</Text>
                                {currentOutfitScore !== undefined && (
                                    <View style={[styles.modalScoreBadge, { backgroundColor: colors.primary }]}>
                                        <Text style={styles.modalScoreText}>★ {currentOutfitScore}/10</Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowTryOnResult(false)}
                                style={styles.modalClose}
                            >
                                <Ionicons name="close" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {tryOnResult ? (
                            <View style={styles.modalImage}>
                                <Image
                                    source={{ uri: tryOnResult }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="contain"
                                />
                            </View>
                        ) : (
                            <Text>No se pudo cargar la imagen.</Text>
                        )}

                        <Text style={styles.modalSubtext}>
                            Generado por IA. Puede tener imperfecciones.
                        </Text>

                        <TouchableOpacity
                            onPress={() => setShowTryOnResult(false)}
                            style={[styles.modalButton, { backgroundColor: colors.primary }]}
                        >
                            <Text style={styles.modalButtonText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Image Zoom Modal */}
            <Modal
                visible={showImageModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowImageModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedImageName}</Text>
                            <TouchableOpacity
                                onPress={() => setShowImageModal(false)}
                                style={styles.modalClose}
                            >
                                <Ionicons name="close" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {selectedImage ? (
                            <View style={styles.modalImage}>
                                <Image
                                    source={{ uri: selectedImage }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="contain"
                                />
                            </View>
                        ) : (
                            <Text>No se pudo cargar la imagen.</Text>
                        )}

                        <TouchableOpacity
                            onPress={() => setShowImageModal(false)}
                            style={[styles.modalButton, { backgroundColor: colors.primary }]}
                        >
                            <Text style={styles.modalButtonText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// Outfit Card Component
type OutfitCardProps = {
    outfit: GeneratedOutfit;
    index: number;
    onTryOn: (outfit: GeneratedOutfit, showOuterwear: boolean) => void;
    isTryingOn: boolean;
    userModelPhoto: string | null;
    colors: any;
    isFemale: boolean;
    onImageClick: (imageUrl: string, itemName: string) => void;
};

const OutfitCard = ({
    outfit,
    index,
    onTryOn,
    isTryingOn,
    userModelPhoto,
    colors,
    isFemale,
    onImageClick
}: OutfitCardProps) => {
    const hasCompleteOutfit = outfit.top && outfit.bottom;
    const [showOuterwear, setShowOuterwear] = useState(true);

    return (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.cardScroll}
            style={styles.card}
        >
            {/* Look Number & Outerwear Toggle */}
            <View style={styles.lookHeader}>
                <View style={styles.lookBadge}>
                    <Text style={[styles.lookNumber, { color: colors.primary }]}>
                        Look {index + 1}
                    </Text>
                </View>

                {/* Outerwear Toggle */}
                {outfit.outerwear && (
                    <TouchableOpacity
                        onPress={() => setShowOuterwear(!showOuterwear)}
                        style={[
                            styles.outerToggle,
                            { backgroundColor: showOuterwear ? colors.primary : '#E5E7EB' }
                        ]}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={showOuterwear ? "checkmark-circle" : "close-circle"}
                            size={16}
                            color={showOuterwear ? "white" : "#9CA3AF"}
                        />
                        <Text style={[
                            styles.outerToggleText,
                            { color: showOuterwear ? "white" : "#9CA3AF" }
                        ]}>
                            Abrigo
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Items */}
            <View style={styles.itemsContainer}>
                {/* Outerwear - only if toggle is ON */}
                {outfit.outerwear && showOuterwear && (
                    <ItemShowcase
                        item={outfit.outerwear}
                        label="Abrigo"
                        colors={colors}
                        isFemale={isFemale}
                        onImageClick={onImageClick}
                    />
                )}

                {outfit.top && (
                    <ItemShowcase
                        item={outfit.top}
                        label="Superior"
                        colors={colors}
                        isFemale={isFemale}
                        onImageClick={onImageClick}
                    />
                )}

                {outfit.bottom && (
                    <ItemShowcase
                        item={outfit.bottom}
                        label="Inferior"
                        colors={colors}
                        isFemale={isFemale}
                        onImageClick={onImageClick}
                    />
                )}

                {outfit.shoes && (
                    <ItemShowcase
                        item={outfit.shoes}
                        label="Calzado"
                        colors={colors}
                        isFemale={isFemale}
                        onImageClick={onImageClick}
                    />
                )}
            </View>

            {/* Virtual Try On Button - OCULTO TEMPORALMENTE */}
            {false && hasCompleteOutfit && (
                <TouchableOpacity
                    onPress={() => onTryOn(outfit, showOuterwear)}
                    disabled={isTryingOn || !userModelPhoto}
                    style={[
                        styles.tryOnButton,
                        { backgroundColor: hasCompleteOutfit && userModelPhoto ? colors.primary : '#E5E7EB' }
                    ]}
                    activeOpacity={0.8}
                >
                    {isTryingOn ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Text style={[
                            styles.tryOnButtonText,
                            (!hasCompleteOutfit || !userModelPhoto) && styles.tryOnButtonTextDisabled
                        ]}>
                            {userModelPhoto ? 'PROBADOR VIRTUAL' : 'SUBE FOTO EN PERFIL'}
                        </Text>
                    )}
                </TouchableOpacity>
            )}
        </ScrollView>
    );
};

// Item Showcase Component
const ItemShowcase = ({
    item,
    label,
    colors,
    isFemale,
    onImageClick
}: {
    item: ClosetItem;
    label: string;
    colors: any;
    isFemale: boolean;
    onImageClick: (imageUrl: string, itemName: string) => void;
}) => {
    return (
        <TouchableOpacity
            style={[styles.itemCard, !isFemale && styles.itemCardDark]}
            onPress={() => onImageClick(item.image_url, item.name)}
            activeOpacity={0.7}
        >
            <View style={styles.itemImageContainer}>
                <Image
                    source={{ uri: item.image_url }}
                    style={styles.itemImage}
                    resizeMode="cover"
                />
            </View>
            <View style={styles.itemInfo}>
                <Text style={[styles.itemLabel, { color: colors.primary }]}>
                    {label.toUpperCase()}
                </Text>
                <Text style={[styles.itemName, !isFemale && styles.itemNameDark]} numberOfLines={1}>
                    {item.name}
                </Text>
                <Text style={styles.itemBrand} numberOfLines={1}>
                    {item.brand}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

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
    },
    headerSubtitle: {
        fontSize: 12,
        fontFamily: 'Manrope_600SemiBold',
        color: '#C9A66B',
        letterSpacing: 2,
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
    headerDetails: {
        fontSize: 12,
        fontFamily: 'Manrope_400Regular',
        color: '#9CA3AF',
        marginTop: 4,
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
    indicators: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
        marginBottom: 24,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    indicatorActive: {
        width: 32,
    },
    carousel: {
        flex: 1,
    },
    card: {
        flex: 1,
        paddingHorizontal: 20,
    },
    cardScroll: {
        paddingBottom: 12,
    },
    lookHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    lookBadge: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    lookNumber: {
        fontSize: 12,
        fontFamily: 'Manrope_700Bold',
        letterSpacing: 2,
    },
    scoreBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    scoreText: {
        fontSize: 11,
        fontFamily: 'Manrope_700Bold',
        color: 'white',
        letterSpacing: 0.5,
    },
    outerToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    outerToggleText: {
        fontSize: 11,
        fontFamily: 'Manrope_600SemiBold',
        letterSpacing: 0.5,
    },
    itemsContainer: {
        gap: 8,
    },
    itemCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        flexDirection: 'row',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    itemCardDark: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    itemImageContainer: {
        width: 110,
        height: 110,
        backgroundColor: '#F3F4F6',
    },
    itemImage: {
        width: '100%',
        height: '100%',
    },
    itemInfo: {
        flex: 1,
        padding: 8,
        justifyContent: 'center',
    },
    itemLabel: {
        fontSize: 8,
        fontFamily: 'Manrope_700Bold',
        letterSpacing: 1.5,
        marginBottom: 2,
    },
    itemName: {
        fontSize: 13,
        fontFamily: 'PlayfairDisplay_400Regular',
        color: '#1C1C1E',
        marginBottom: 2,
    },
    itemNameDark: {
        color: '#FFFFFF',
    },
    itemBrand: {
        fontSize: 11,
        fontFamily: 'Manrope_400Regular',
        color: '#9CA3AF',
    },
    tryOnButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#C9A66B',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    tryOnButtonText: {
        fontFamily: 'Manrope_700Bold',
        fontSize: 14,
        letterSpacing: 2,
        color: 'white',
    },
    tryOnButtonTextDisabled: {
        color: '#9CA3AF',
    },
    emptyText: {
        fontFamily: 'Manrope_400Regular',
        color: '#1C1C1E',
    },
    emptyTextDark: {
        color: '#FFFFFF',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 32,
        padding: 24,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalTitle: {
        fontSize: 22,
        fontFamily: 'PlayfairDisplay_400Regular',
    },
    modalScoreBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
    },
    modalScoreText: {
        fontSize: 12,
        fontFamily: 'Manrope_700Bold',
        color: 'white',
        letterSpacing: 0.5,
    },
    modalClose: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalImage: {
        width: '100%',
        aspectRatio: 3 / 4,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
    },
    modalSubtext: {
        marginTop: 16,
        color: '#999',
        textAlign: 'center',
        fontSize: 13,
        fontFamily: 'Manrope_400Regular',
        fontStyle: 'italic',
    },
    modalButton: {
        marginTop: 24,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        width: '100%',
    },
    modalButtonText: {
        color: 'white',
        fontFamily: 'Manrope_700Bold',
        fontSize: 16,
        letterSpacing: 1,
    },
});
