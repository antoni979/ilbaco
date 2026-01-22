import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useGenderTheme } from '@/features/theme/hooks';
import { router } from 'expo-router';

// Types
type ClosetItem = {
    id: number;
    brand: string;
    name: string;
    image_url: string;
    category?: string;
    characteristics?: any; // JSONB: { season, color, style, ... }
};

type BottomLength = 'Largo' | 'Corto';
type TopLength = 'Largo' | 'Corto';
type Gender = 'male' | 'female' | null;

export default function AssistantScreen() {
    // Remove router usage
    const { classes, colors, isFemale } = useGenderTheme();

    // State - NUEVOS FILTROS
    const [bottomLength, setBottomLength] = useState<BottomLength>('Largo');
    const [topLength, setTopLength] = useState<TopLength>('Largo');
    const [formality, setFormality] = useState<number>(3); // 1 (Muy Casual) a 5 (Muy Formal)
    const [items, setItems] = useState<ClosetItem[]>([]);
    const [gender, setGender] = useState<Gender>(null);
    // Múltiples outfits generados (ahora array en lugar de objeto único)
    type GeneratedOutfit = {
        top?: ClosetItem;
        bottom?: ClosetItem;
        shoes?: ClosetItem;
        outerwear?: ClosetItem;
        score?: number; // Score del outfit (1-10)
    };
    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [userModelPhoto, setUserModelPhoto] = useState<string | null>(null);

    // Initial Data Fetch
    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Gender
            // Fetch Gender & Model Photo
            const { data: profile } = await supabase
                .from('profiles')
                .select('gender, model_photo_url')
                .eq('id', user.id)
                .single();
            setGender(profile?.gender || null);
            setUserModelPhoto(profile?.model_photo_url || null);

            // Fetch Items
            const { data: userItems, error } = await supabase
                .from('items')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (!error && userItems) {
                setItems(userItems);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Use standard useEffect instead of useFocusEffect to avoid Nav Context issues
    useEffect(() => {
        fetchData();
    }, []);

    // Helper: Normalize text (remove accents, lowercase, trim)
    const normalize = (text: string) => {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
            .trim();
    };

    // Logic: Helper to classifying categories
    const isTop = (cat: string) => {
        const normalized = normalize(cat);
        return ['camiseta', 'camisa', 'polo', 'top', 'blusa', 'jersey', 'sudadera', 'chaleco', 'body', 't-shirt', 'shirt', 'sweater', 'hoodie', 'vestido', 'dress', 'mono'].some(t => normalized.includes(t));
    };
    const isBottom = (cat: string) => {
        const normalized = normalize(cat);
        return ['pantalon', 'shorts', 'falda', 'jeans', 'chino', 'bañador', 'baño', 'banador', 'bano', 'leggings', 'bermuda', 'mallas', 'jogger', 'pants', 'trousers', 'skirt'].some(b => normalized.includes(b));
    };
    const isShoes = (cat: string) => {
        const normalized = normalize(cat);
        return ['calzado', 'zapatos', 'zapatillas', 'botas', 'mocasines', 'sandalias', 'tacones', 'tenis', 'sneakers', 'shoes', 'boots'].some(s => normalized.includes(s));
    };
    const isOuterwear = (cat: string) => {
        const normalized = normalize(cat);
        return ['abrigo', 'chaqueta', 'americana', 'blazer', 'gabardina', 'cazadora', 'cardigan', 'coat', 'jacket'].some(o => normalized.includes(o));
    };

    // Logic: Color helper
    const isDarkColor = (color: string) => ['negro', 'azul marino', 'gris oscuro', 'marrón', 'black', 'navy', 'grey', 'vino', 'burdeos'].some(c => color?.toLowerCase().includes(c));

    // ADVANCED COLOR CLASSIFICATION HELPERS
    const isNeutralColor = (color: string) => {
        const c = normalize(color);
        return ['negro', 'blanco', 'gris', 'beige', 'crema', 'kaki', 'caqui', 'azul marino', 'camel', 'denim',
                'black', 'white', 'grey', 'navy', 'cream', 'khaki'].some(n => c.includes(n));
    };

    const isLightColor = (color: string) => {
        const c = normalize(color);
        return ['blanco', 'beige', 'crema', 'gris claro', 'rosa claro', 'azul claro', 'celeste', 'amarillo claro',
                'white', 'cream', 'light grey', 'light blue', 'light pink', 'pastel'].some(l => c.includes(l));
    };

    const isVibrantColor = (color: string) => {
        const c = normalize(color);
        return ['rojo', 'naranja', 'amarillo', 'fucsia', 'morado', 'verde lima', 'turquesa', 'rosa fuerte',
                'red', 'orange', 'yellow', 'pink', 'purple', 'neon', 'bright'].some(v => c.includes(v));
    };

    // Classic color combinations that ALWAYS work
    const classicCombinations = [
        ['azul marino', 'blanco'], ['azul marino', 'white'],
        ['negro', 'blanco'], ['black', 'white'],
        ['gris', 'rosa'], ['grey', 'pink'],
        ['beige', 'blanco'], ['beige', 'white'],
        ['azul marino', 'beige'], ['navy', 'beige'],
        ['negro', 'gris'], ['black', 'grey'],
        ['marron', 'beige'], ['brown', 'beige'],
        ['gris', 'azul'], ['grey', 'blue'],
        ['denim', 'blanco'], ['denim', 'white']
    ];

    // Colors that clash (should avoid)
    const clashingCombinations = [
        ['azul marino', 'rojo'], ['navy', 'red'],
        ['marron', 'negro'], ['brown', 'black'],
        ['verde', 'rojo'], ['green', 'red'],
        ['naranja', 'rosa'], ['orange', 'pink'],
        ['morado', 'rojo'], ['purple', 'red'],
        ['azul electrico', 'verde lima']
    ];

    const isClassicCombo = (color1: string, color2: string): boolean => {
        const c1 = normalize(color1);
        const c2 = normalize(color2);
        return classicCombinations.some(([a, b]) =>
            (c1.includes(a) && c2.includes(b)) || (c1.includes(b) && c2.includes(a))
        );
    };

    const isClashingCombo = (color1: string, color2: string): boolean => {
        const c1 = normalize(color1);
        const c2 = normalize(color2);
        return clashingCombinations.some(([a, b]) =>
            (c1.includes(a) && c2.includes(b)) || (c1.includes(b) && c2.includes(a))
        );
    };

    // Convert raw score to 1-10 scale (STRICT VERSION - más exigente)
    const scoreToRating = (score: number): number => {
        // Scores typically range from -50 to +100
        // Map to 1-10 scale with STRICT criteria
        // Un 10/10 debe ser EXCEPCIONAL (score >= 90)
        if (score < 0) return 1;      // Muy malo
        if (score < 15) return 2;     // Malo
        if (score < 25) return 3;     // Pobre
        if (score < 35) return 4;     // Insuficiente
        if (score < 45) return 5;     // Mediocre
        if (score < 55) return 6;     // Aceptable
        if (score < 65) return 7;     // Bueno
        if (score < 75) return 8;     // Muy bueno
        if (score < 85) return 9;     // Excelente
        if (score < 90) return 9;     // Excelente+
        return 10;                     // Perfecto (score >= 90) ⭐
    };

    // CORE LOGIC: Generate Outfit (Smart Selection)
    const generateOutfit = async () => {
        console.log('[OUTFIT] Starting outfit generation...');
        setIsGenerating(true);
        try {
            // 1. FRESH DATA FETCH (Avoid Cache/Stale State)
            console.log('[OUTFIT] Fetching user...');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('[OUTFIT] No user found');
                throw new Error("No user");
            }
            console.log('[OUTFIT] User found:', user.id);

            console.log('[OUTFIT] Fetching items...');
            const { data: freshItems, error } = await supabase
                .from('items')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error || !freshItems) {
                console.error("[OUTFIT] Error fetching fresh items", error);
                setIsGenerating(false);
                return;
            }

            console.log(`[OUTFIT] Found ${freshItems.length} items`);

            // Update local state to keep it in sync, but use 'freshItems' for logic
            setItems(freshItems);

            // 2. NUEVA LÓGICA: Filtrar por largo y formalidad

            console.log(`[OUTFIT] Filtering by length - Top: ${topLength}, Bottom: ${bottomLength}`);
            console.log(`[OUTFIT] Formality level: ${formality}/5`);

            // Helper: Determinar si una prenda es "larga" o "corta"
            const isLongTop = (cat: string) => {
                const c = normalize(cat);
                // Manga larga: camisa, jersey, sudadera, blazer, abrigo
                return ['camisa', 'jersey', 'sudadera', 'blazer', 'cardigan', 'abrigo', 'chaqueta', 'americana'].some(t => c.includes(t));
            };

            const isShortTop = (cat: string) => {
                const c = normalize(cat);
                // Manga corta: camiseta, polo, top, blusa sin mangas
                return ['camiseta', 'polo', 'top', 't-shirt', 'tirantes', 'tank'].some(t => c.includes(t)) ||
                       (c.includes('blusa') && !c.includes('manga larga'));
            };

            const isLongBottom = (cat: string) => {
                const c = normalize(cat);
                // Largo: pantalón largo, falda larga, vestido largo, jeans
                if (c.includes('corto') || c.includes('short') || c.includes('bermuda')) return false;
                return ['pantalon', 'jean', 'chino', 'jogger', 'palazzo', 'cargo', 'vestido largo', 'falda larga', 'falda midi'].some(b => c.includes(b)) ||
                       (c.includes('falda') && !c.includes('mini') && !c.includes('corta')) ||
                       (c.includes('vestido') && !c.includes('corto') && !c.includes('mini'));
            };

            const isShortBottom = (cat: string) => {
                const c = normalize(cat);
                // Corto: shorts, pantalón corto, falda corta/mini, vestido corto, bañador
                return ['short', 'corto', 'bermuda', 'banador', 'bano', 'mini', 'falda corta', 'vestido corto'].some(b => c.includes(b));
            };

            // NO FILTRAR POR TEMPORADA - Usar todas las prendas
            const allItems = freshItems;

            console.log(`[OUTFIT] Total items available: ${allItems.length}`);

            // Group Components y aplicar filtros de largo
            let tops = allItems.filter(i => isTop(i.category || ''));
            let bottoms = allItems.filter(i => isBottom(i.category || ''));
            const outer = allItems.filter(i => isOuterwear(i.category || ''));
            const allShoes = allItems.filter(i => isShoes(i.category || ''));

            // FILTRAR TOPS POR LARGO
            if (topLength === 'Largo') {
                tops = tops.filter(t => isLongTop(t.category || ''));
                console.log(`[OUTFIT] Filtering tops: Manga Larga`);
            } else {
                tops = tops.filter(t => isShortTop(t.category || ''));
                console.log(`[OUTFIT] Filtering tops: Manga Corta`);
            }

            // FILTRAR BOTTOMS POR LARGO
            if (bottomLength === 'Largo') {
                bottoms = bottoms.filter(b => isLongBottom(b.category || ''));
                console.log(`[OUTFIT] Filtering bottoms: Largo`);
            } else {
                bottoms = bottoms.filter(b => isShortBottom(b.category || ''));
                console.log(`[OUTFIT] Filtering bottoms: Corto`);
            }

            // SHOES: Filtrar según formalidad
            const shoes = allShoes.filter(shoe => {
                const cat = (shoe.category || '').toLowerCase();

                // Muy formal (4-5): Solo zapatos formales
                if (formality >= 4) {
                    return ['zapato', 'mocasin', 'tacon', 'oxford', 'formal'].some(t => cat.includes(t));
                }

                // Muy casual (1-2): Permitir deportivas, excluir muy formales
                if (formality <= 2) {
                    return !['oxford', 'formal', 'tacon alto'].some(t => cat.includes(t));
                }

                // Medio (3): Permitir casi todo excepto extremos
                return !['chancla', 'sandalia playera'].some(t => cat.includes(t));
            });

            console.log(`[OUTFIT] Grouped - Tops: ${tops.length}, Bottoms: ${bottoms.length}, Shoes: ${shoes.length}, Outer: ${outer.length}`);

            // DEBUG: Log which items were classified as tops
            if (tops.length > 0) {
                console.log('[OUTFIT] Items classified as TOPS:');
                tops.forEach(t => console.log(`  - "${t.name}" (${t.category})`));
            }

            // DEBUG: Log items that weren't classified
            const unclassified = allItems.filter(i =>
                !isTop(i.category || '') &&
                !isBottom(i.category || '') &&
                !isShoes(i.category || '') &&
                !isOuterwear(i.category || '')
            );
            if (unclassified.length > 0) {
                console.log('[OUTFIT] UNCLASSIFIED items:');
                unclassified.forEach(u => console.log(`  - "${u.name}" (${u.category})`));
            }

            // Score Combinations (Smart Logic)
            let bestCombination: { top?: ClosetItem, bottom?: ClosetItem } = {};

            // Define neutral colors globally for all scoring functions
            const neutralColors = ['negro', 'gris', 'blanco', 'beige', 'azul marino', 'denim', 'kaki', 'caqui', 'black', 'grey', 'white', 'navy'];

            if (tops.length > 0 && bottoms.length > 0) {
                console.log('[OUTFIT] Scoring combinations...');
                type ScoredCombo = { top: ClosetItem, bottom: ClosetItem, score: number };
                const combos: ScoredCombo[] = [];

                tops.forEach(top => {
                    bottoms.forEach(bottom => {
                        let score = 0;
                        const topColor = (top.characteristics?.color || '').toLowerCase();
                        const bottomColor = (bottom.characteristics?.color || '').toLowerCase();
                        const topStyle = (top.characteristics?.style || '').toLowerCase();
                        const bottomStyle = (bottom.characteristics?.style || '').toLowerCase();
                        const topCat = (top.category || '').toLowerCase();
                        const bottomCat = (bottom.category || '').toLowerCase();

                        // === POSITIVE RULES ===

                        // Rule 1: CONTRAST CLARO/OSCURO (+12) - PRINCIPAL
                        const topIsDark = isDarkColor(topColor);
                        const topIsLight = isLightColor(topColor);
                        const bottomIsDark = isDarkColor(bottomColor);
                        const bottomIsLight = isLightColor(bottomColor);

                        if ((topIsDark && bottomIsLight) || (topIsLight && bottomIsDark)) {
                            score += 12; // Perfect contrast
                            console.log(`[SCORE] +12 Contraste claro/oscuro: ${top.name} + ${bottom.name}`);
                        }

                        // Rule 2: NEUTRALES CON CUALQUIER COLOR (+10)
                        const topIsNeutral = isNeutralColor(topColor);
                        const bottomIsNeutral = isNeutralColor(bottomColor);

                        if (bottomIsNeutral) {
                            score += 10;
                            console.log(`[SCORE] +10 Bottom neutro: ${bottom.name}`);
                        }
                        if (topIsNeutral && !bottomIsNeutral) {
                            score += 8;
                            console.log(`[SCORE] +8 Top neutro con bottom color: ${top.name}`);
                        }

                        // Rule 3: COMBINACIONES CLÁSICAS (+15)
                        if (isClassicCombo(topColor, bottomColor)) {
                            score += 15;
                            console.log(`[SCORE] +15 Combinación clásica: ${topColor} + ${bottomColor}`);
                        }

                        // Rule 4: MONOCROMÁTICO INTELIGENTE (+8)
                        // Same color family but different shades
                        if (topColor.includes(bottomColor) || bottomColor.includes(topColor)) {
                            if ((topIsDark && bottomIsLight) || (topIsLight && bottomIsDark)) {
                                score += 8;
                                console.log(`[SCORE] +8 Monocromático inteligente: ${topColor} + ${bottomColor}`);
                            }
                        }

                        // Rule 5: Style Consistency (+8)
                        if (topStyle && bottomStyle && topStyle === bottomStyle) {
                            score += 8;
                            console.log(`[SCORE] +8 Estilos coinciden: ${topStyle}`);
                        }

                        // === NEGATIVE RULES (PENALIZACIONES) ===

                        // Penalty 1: MONOCROMÁTICO ABURRIDO (-12)
                        // Permitir monocromático en contextos formales (formality >= 4)
                        if (topColor === bottomColor && topColor !== '' && formality < 4) {
                            // Mismo color exacto sin contraste
                            if (!(topIsDark && bottomIsLight) && !(topIsLight && bottomIsDark)) {
                                score -= 12;
                                console.log(`[SCORE] -12 Monocromático aburrido: ${topColor} = ${bottomColor}`);
                            }
                        }

                        // Penalty 2: COLORES QUE CHOCAN (-15)
                        if (isClashingCombo(topColor, bottomColor)) {
                            score -= 15;
                            console.log(`[SCORE] -15 Colores chocan: ${topColor} + ${bottomColor}`);
                        }

                        // Penalty 3: DOS COLORES VIBRANTES (-18)
                        const topIsVibrant = isVibrantColor(topColor);
                        const bottomIsVibrant = isVibrantColor(bottomColor);
                        if (topIsVibrant && bottomIsVibrant && topColor !== bottomColor) {
                            score -= 18;
                            console.log(`[SCORE] -18 Dos colores vibrantes: ${topColor} + ${bottomColor}`);
                        }

                        // Penalty 4: FALTA DE CONTRASTE (-8)
                        if ((topIsLight && bottomIsLight && !topIsNeutral && !bottomIsNeutral) ||
                            (topIsDark && bottomIsDark && topColor !== bottomColor)) {
                            score -= 8;
                            console.log(`[SCORE] -8 Falta de contraste: ambos claros o ambos oscuros`);
                        }

                        // Penalty 5: MEZCLA DE ESTILOS INCOMPATIBLES (-20)
                        const topIsDeportivo = ['deportivo', 'sport', 'athletic', 'casual'].some(s => topStyle.includes(s)) ||
                                               ['sudadera', 'hoodie', 'jogger'].some(c => topCat.includes(c));
                        const bottomIsDeportivo = ['deportivo', 'sport', 'athletic', 'casual'].some(s => bottomStyle.includes(s)) ||
                                                  ['jogger', 'chandal'].some(c => bottomCat.includes(c));
                        const topIsFormal = ['formal', 'elegante', 'smart'].some(s => topStyle.includes(s)) ||
                                            ['camisa', 'shirt', 'blazer', 'americana'].some(c => topCat.includes(c));
                        const bottomIsFormal = ['formal', 'elegante', 'smart'].some(s => bottomStyle.includes(s)) ||
                                               ['pantalon', 'trousers', 'vestir'].some(c => bottomCat.includes(c)) &&
                                               !bottomCat.includes('jean');

                        if ((topIsDeportivo && bottomIsFormal) || (topIsFormal && bottomIsDeportivo)) {
                            score -= 20;
                            console.log(`[SCORE] -20 Mezcla estilos incompatibles: deportivo + formal`);
                        }

                        // === FORMALITY-SPECIFIC RULES ===
                        // formality: 1 (Muy Casual) → 5 (Muy Formal)

                        if (formality >= 4) {
                            // MUY FORMAL (4-5): Trajes, vestidos, camisas
                            // Premios
                            if (topCat.includes('camisa') || topCat.includes('blusa') || topCat.includes('vestido')) score += 20;
                            if (topCat.includes('vestido')) score += 25;
                            if (topCat.includes('americana') || topCat.includes('blazer')) score += 20;
                            if (bottomCat.includes('pantalon') && !bottomCat.includes('jean')) score += 15;
                            if (bottomCat.includes('falda')) score += 15;
                            if (topIsNeutral || bottomIsNeutral || isDarkColor(topColor) || isDarkColor(bottomColor)) score += 10;

                            // Penalizaciones
                            if (bottomCat.includes('jean')) score -= 15;
                            if (topCat.includes('camiseta') || topCat.includes('t-shirt')) score -= 20;
                            if (topCat.includes('sudadera')) score -= 25;
                            if (topIsVibrant || bottomIsVibrant) score -= 10;
                        }

                        if (formality === 3) {
                            // SMART CASUAL (3): Equilibrio entre casual y formal
                            // Premios
                            if (topCat.includes('camisa') || topCat.includes('polo')) score += 10;
                            if (bottomCat.includes('chino') || (bottomCat.includes('pantalon') && !bottomCat.includes('jean'))) score += 8;
                            if (topIsNeutral && bottomIsNeutral) score += 8;

                            // Penalizaciones leves
                            if (topCat.includes('sudadera') || bottomCat.includes('chandal')) score -= 10;
                            if (topIsVibrant && bottomIsVibrant) score -= 8;
                        }

                        if (formality <= 2) {
                            // MUY CASUAL (1-2): Ropa cómoda, deportiva
                            // Premios
                            if (topCat.includes('camiseta') || topCat.includes('polo')) score += 5;
                            if (bottomCat.includes('jean')) score += 5;

                            // Penalizaciones para prendas demasiado formales
                            if (topCat.includes('traje') || topCat.includes('americana') || bottomCat.includes('traje')) score -= 15;
                            if (topCat.includes('camisa') && topCat.includes('formal')) score -= 10;
                        }

                        combos.push({ top, bottom, score });
                    });
                });

                // Sort descending
                combos.sort((a, b) => b.score - a.score);

                // FILTRAR POR SCORE MÍNIMO - Solo outfits con calidad decente
                const MIN_SCORE_THRESHOLD = 30; // Threshold mínimo para considerar un outfit aceptable
                const goodCombos = combos.filter(c => c.score >= MIN_SCORE_THRESHOLD);

                console.log(`[OUTFIT] Total combos: ${combos.length}, Good combos (score >= ${MIN_SCORE_THRESHOLD}): ${goodCombos.length}`);

                if (goodCombos.length === 0) {
                    console.warn('[OUTFIT] No se encontraron combinaciones con score suficiente');
                    alert('No se pudieron generar outfits de buena calidad con tu armario actual. Intenta añadir más prendas que combinen bien entre sí (prendas neutras como negro, gris, beige son muy versátiles).');
                    setIsGenerating(false);
                    return;
                }

                // NUEVO: Generar MÚLTIPLES outfits (hasta 5, o menos si no hay suficientes combinaciones)
                const MAX_OUTFITS = 5;
                const selectedOutfits: GeneratedOutfit[] = [];

                // Mezclar aleatoriamente los buenos candidatos para más variedad
                const shuffledCombos = [...goodCombos].sort(() => Math.random() - 0.5);
                const candidates = shuffledCombos.slice(0, Math.min(shuffledCombos.length, 20));

                const usedCombos = new Set<string>();
                const random = <T,>(arr: T[]): T | undefined =>
                    arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : undefined;

                // Helper function: Score shoes with outfit (IMPROVED)
                const scoreShoes = (shoe: ClosetItem, top: ClosetItem, bottom: ClosetItem): number => {
                    let score = 0;
                    const shoeColor = (shoe.characteristics?.color || '').toLowerCase();
                    const topColor = (top.characteristics?.color || '').toLowerCase();
                    const bottomColor = (bottom.characteristics?.color || '').toLowerCase();
                    const shoeCat = (shoe.category || '').toLowerCase();

                    // Rule 1: Color matching (INCREASED from +10 to +15)
                    if (shoeColor === topColor || shoeColor === bottomColor) {
                        score += 15;
                        console.log(`[SHOES] +15 Color match: ${shoe.name}`);
                    }

                    // Rule 2: Neutral colors always good (INCREASED from +8 to +12)
                    if (isNeutralColor(shoeColor)) {
                        score += 12;
                        console.log(`[SHOES] +12 Neutral color: ${shoe.name}`);
                    }

                    // Rule 3: Smart contrast
                    const shoeIsDark = isDarkColor(shoeColor);
                    const outfitIsLight = isLightColor(topColor) || isLightColor(bottomColor);
                    if (shoeIsDark && outfitIsLight) {
                        score += 10;
                        console.log(`[SHOES] +10 Contraste zapatos oscuros con outfit claro`);
                    }

                    // Rule 4: Formality appropriateness
                    if (formality >= 4) {
                        // MUY FORMAL: Zapatos formales obligatorios
                        if (['zapato', 'mocasin', 'tacon', 'oxford', 'formal'].some(t => shoeCat.includes(t))) {
                            score += 20;
                            console.log(`[SHOES] +20 Zapatos formales para alta formalidad`);
                        }
                        // Penalizar deportivas fuertemente
                        if (['deportiv', 'sneaker', 'zapatilla'].some(t => shoeCat.includes(t))) {
                            score -= 30;
                            console.log(`[SHOES] -30 Deportivas en contexto formal ❌`);
                        }
                        // Penalizar chanclas/sandalias
                        if (['chancla', 'sandalia', 'flip'].some(t => shoeCat.includes(t))) {
                            score -= 25;
                            console.log(`[SHOES] -25 Chanclas/sandalias en contexto formal ❌`);
                        }
                    } else if (formality === 3) {
                        // SMART CASUAL: Variedad permitida
                        if (['zapato', 'mocasin', 'bota'].some(t => shoeCat.includes(t))) {
                            score += 10;
                        }
                        if (['zapatilla', 'sneaker'].some(t => shoeCat.includes(t)) && !shoeCat.includes('deportiv')) {
                            score += 5; // Sneakers elegantes ok
                        }
                    } else {
                        // CASUAL (1-2): Sneakers y comodidad
                        if (['zapatilla', 'sneaker', 'deportiv'].some(t => shoeCat.includes(t))) {
                            score += 8;
                        }
                        // Penalizar zapatos demasiado formales en contexto casual
                        if (['oxford', 'formal', 'tacon alto'].some(t => shoeCat.includes(t))) {
                            score -= 5;
                        }
                    }

                    // Rule 5: Penalizar zapatos vibrantes con outfit vibrante
                    if (isVibrantColor(shoeColor) && (isVibrantColor(topColor) || isVibrantColor(bottomColor))) {
                        score -= 10;
                        console.log(`[SHOES] -10 Zapatos vibrantes + outfit vibrante ❌`);
                    }

                    // Rule 6: Material consistency (si está disponible)
                    const shoeMaterial = (shoe.characteristics?.material_guess || '').toLowerCase();
                    const topMaterial = (top.characteristics?.material_guess || '').toLowerCase();
                    if (shoeMaterial && topMaterial && shoeMaterial === topMaterial) {
                        score += 5;
                    }

                    return score;
                };

                // Helper function: Score outerwear with outfit (IMPROVED)
                const scoreOuterwear = (outerwear: ClosetItem, top: ClosetItem, bottom: ClosetItem): number => {
                    let score = 0;
                    const outerColor = (outerwear.characteristics?.color || '').toLowerCase();
                    const topColor = (top.characteristics?.color || '').toLowerCase();
                    const bottomColor = (bottom.characteristics?.color || '').toLowerCase();
                    const outerStyle = (outerwear.characteristics?.style || '').toLowerCase();
                    const topStyle = (top.characteristics?.style || '').toLowerCase();
                    const outerCat = (outerwear.category || '').toLowerCase();

                    // Rule 1: Neutral outerwear is VERY versatile (INCREASED from +10 to +15)
                    if (isNeutralColor(outerColor)) {
                        score += 15;
                        console.log(`[OUTER] +15 Abrigo neutro: ${outerwear.name}`);
                    }

                    // Rule 2: Color harmony (INCREASED from +8 to +12)
                    if (outerColor === topColor || outerColor === bottomColor) {
                        score += 12;
                        console.log(`[OUTER] +12 Color coincide con outfit`);
                    }

                    // Rule 3: Classic combinations
                    if (isClassicCombo(outerColor, topColor) || isClassicCombo(outerColor, bottomColor)) {
                        score += 10;
                        console.log(`[OUTER] +10 Combinación clásica`);
                    }

                    // Rule 4: Style consistency
                    if (outerStyle && topStyle && outerStyle === topStyle) {
                        score += 7;
                    }

                    // Rule 5: Formality appropriateness
                    if (formality >= 4) {
                        // MUY FORMAL: Blazers, americanas, abrigos elegantes
                        if (['americana', 'blazer', 'abrigo', 'chaqueta'].some(t => outerCat.includes(t)) &&
                            !outerCat.includes('deportiv')) {
                            score += 15;
                            console.log(`[OUTER] +15 Abrigo apropiado para alta formalidad`);
                        }
                        // Penalizar prendas casuales
                        if (['sudadera', 'hoodie', 'deportiva', 'bomber'].some(t => outerCat.includes(t))) {
                            score -= 20;
                            console.log(`[OUTER] -20 Abrigo casual en contexto formal ❌`);
                        }
                    } else if (formality === 3) {
                        // SMART CASUAL: Flexibilidad
                        if (['chaqueta', 'blazer', 'americana', 'cardigan'].some(t => outerCat.includes(t))) {
                            score += 8;
                        }
                    } else {
                        // CASUAL (1-2): Comodidad
                        if (['sudadera', 'hoodie', 'chaqueta deportiva', 'bomber'].some(t => outerCat.includes(t))) {
                            score += 5;
                        }
                        // Penalizar prendas demasiado formales
                        if (['americana', 'traje'].some(t => outerCat.includes(t))) {
                            score -= 8;
                        }
                    }

                    // Rule 6: Penalizar abrigo vibrante con outfit ya vibrante
                    if (isVibrantColor(outerColor) && (isVibrantColor(topColor) || isVibrantColor(bottomColor))) {
                        score -= 12;
                        console.log(`[OUTER] -12 Abrigo vibrante + outfit vibrante ❌`);
                    }

                    // Rule 7: Avoid clashing colors
                    if (isClashingCombo(outerColor, topColor) || isClashingCombo(outerColor, bottomColor)) {
                        score -= 15;
                        console.log(`[OUTER] -15 Colores chocan con outfit ❌`);
                    }

                    return score;
                };

                // Generar tantos outfits únicos como sea posible (máximo 5, solo los buenos)
                for (const combo of candidates) {
                    if (selectedOutfits.length >= MAX_OUTFITS) break;

                    // Start with base combo score
                    let totalScore = combo.score;

                    // SMART SHOES SELECTION: Score all shoes and pick the best
                    let selectedShoes: ClosetItem | undefined = undefined;
                    let shoesScore = 0;
                    if (shoes.length > 0) {
                        const scoredShoes = shoes.map(shoe => ({
                            shoe,
                            score: scoreShoes(shoe, combo.top, combo.bottom)
                        }));
                        scoredShoes.sort((a, b) => b.score - a.score);

                        // Pick from top 3 to add some variety
                        const topShoes = scoredShoes.slice(0, Math.min(3, scoredShoes.length));
                        const randomTopShoe = topShoes[Math.floor(Math.random() * topShoes.length)];
                        selectedShoes = randomTopShoe.shoe;
                        shoesScore = randomTopShoe.score;
                        totalScore += shoesScore;

                        console.log(`[OUTFIT] Selected shoes: "${selectedShoes.name}" (score: ${randomTopShoe.score})`);
                    }

                    // SMART OUTERWEAR SELECTION: Based on formality and top length
                    let selectedOuter: ClosetItem | undefined = undefined;
                    let outerScore = 0;
                    if (outer.length > 0) {
                        // Incluir outerwear si:
                        // 1. Usuario seleccionó manga larga (más probabilidad de necesitar abrigo)
                        // 2. Formalidad alta (blazers/americanas)
                        // 3. Aleatoriamente para variedad
                        const shouldIncludeOuter =
                            (topLength === 'Largo' && Math.random() > 0.4) ||
                            (formality >= 4 && Math.random() > 0.5) ||
                            (formality === 3 && Math.random() > 0.6) ||
                            Math.random() > 0.7; // 30% chance siempre

                        if (shouldIncludeOuter) {
                            const scoredOuter = outer.map(o => ({
                                outer: o,
                                score: scoreOuterwear(o, combo.top, combo.bottom)
                            }));
                            scoredOuter.sort((a, b) => b.score - a.score);

                            // Pick from top 2 to add variety
                            const topOuter = scoredOuter.slice(0, Math.min(2, scoredOuter.length));
                            const randomTopOuter = topOuter[Math.floor(Math.random() * topOuter.length)];
                            selectedOuter = randomTopOuter.outer;
                            outerScore = randomTopOuter.score;
                            totalScore += outerScore;

                            console.log(`[OUTFIT] Selected outerwear: "${selectedOuter.name}" (score: ${randomTopOuter.score})`);
                        }
                    }

                    // VERIFICACIÓN DE DUPLICADOS - Incluye TODAS las piezas (top, bottom, shoes, outerwear)
                    const comboKey = `${combo.top.id}-${combo.bottom.id}-${selectedShoes?.id || 'none'}-${selectedOuter?.id || 'none'}`;

                    // Si este outfit exacto ya existe, skip
                    if (usedCombos.has(comboKey)) {
                        console.log(`[OUTFIT] ⚠️ Outfit duplicado detectado, skipping...`);
                        continue;
                    }

                    usedCombos.add(comboKey);

                    // Convert total score to 1-10 rating
                    const rating = scoreToRating(totalScore);
                    console.log(`[OUTFIT] ✓ Outfit único añadido - Total score: ${totalScore}, Rating: ${rating}/10`);

                    selectedOutfits.push({
                        top: combo.top,
                        bottom: combo.bottom,
                        shoes: selectedShoes,
                        outerwear: selectedOuter,
                        score: rating  // Store the 1-10 rating
                    });
                }

                // Navegar a la pantalla de resultados con los outfits generados
                console.log(`[OUTFIT] ✓ Generados ${selectedOutfits.length} outfits únicos`);

                // Informar si hay menos outfits de lo esperado
                if (selectedOutfits.length < MAX_OUTFITS && selectedOutfits.length < goodCombos.length) {
                    console.log(`[OUTFIT] Se generaron ${selectedOutfits.length} de ${MAX_OUTFITS} posibles. Para más variedad, añade más prendas a tu armario.`);
                }

                if (selectedOutfits.length < 3) {
                    // Si hay muy pocos outfits, avisar al usuario
                    alert(`Se generaron ${selectedOutfits.length} outfit${selectedOutfits.length > 1 ? 's' : ''} de calidad. Para generar más combinaciones, añade más prendas a tu armario (especialmente prendas neutras como negro, gris, beige que combinan fácilmente).`);
                }

                console.log(`[OUTFIT] Navegando a outfit-results...`);

                router.push({
                    pathname: '/outfit-results',
                    params: {
                        outfits: JSON.stringify(selectedOutfits),
                        formality: formality.toString(),
                        topLength,
                        bottomLength,
                        userModelPhoto: userModelPhoto || ''
                    }
                });
            } else {
                console.warn('[OUTFIT] No se pudieron generar outfits: tops o bottoms insuficientes');
                console.warn(`[OUTFIT] Tops: ${tops.length}, Bottoms: ${bottoms.length}`);
                // Show user feedback
                if (Platform.OS === 'android') {
                    // On Android, ensure the user knows why no outfits were generated
                    alert(`No se pudieron generar outfits.\nTops disponibles: ${tops.length}, Bottoms disponibles: ${bottoms.length}\nAsegúrate de tener al menos 1 prenda superior y 1 inferior que coincidan con los filtros seleccionados.`);
                }
            }

        } catch (err) {
            console.error("[OUTFIT] Outfit generation error", err);
            // Show error to user on Android
            if (Platform.OS === 'android') {
                alert(`Error al generar outfit: ${err instanceof Error ? err.message : String(err)}`);
            }
        } finally {
            console.log('[OUTFIT] Outfit generation finished');
            setIsGenerating(false);
        }
    };


    return (
        <SafeAreaView className={`flex-1 ${classes.background}`} edges={['top']}>
            {/* Header */}
            <View className={`px-6 py-4 flex-row justify-between items-center z-10 ${isFemale ? 'bg-white' : 'bg-transparent'}`}>

                <Text className={`text-xl font-bold tracking-[0.15em] font-display uppercase ${classes.text}`}>
                    Stilaro
                </Text>

            </View>

            <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 200 }}>
                <View className="items-center mt-2 mb-8">
                    <Text className={`text-3xl font-serif italic mb-2 ${classes.text}`}>Generador de Outfits</Text>
                    <Text className="text-sm text-center text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                        Personaliza tu look según el largo de las prendas y el nivel de formalidad que necesites.
                    </Text>
                </View>

                {/* Filters Section - NUEVO SISTEMA */}
                <View className="space-y-6 mb-8">
                    {/* Bottom Length Filter */}
                    <View>
                        <View className="flex-row items-center space-x-2 mb-3">
                            <View className="w-1 h-4 bg-primary rounded-full" />
                            <Text className="text-xs font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">Parte de Abajo</Text>
                        </View>
                        <View className="flex-row space-x-3">
                            <TouchableOpacity
                                onPress={() => setBottomLength('Largo')}
                                style={bottomLength === 'Largo' ? { backgroundColor: colors.primary, borderColor: colors.primary } : {}}
                                className={`flex-1 h-14 rounded-2xl items-center justify-center border ${bottomLength === 'Largo' ? '' : `${classes.card} border-gray-200 dark:border-white/10`}`}
                            >
                                <Text className={`text-sm font-semibold ${bottomLength === 'Largo' ? 'text-white dark:text-charcoal' : classes.text}`}>👖 Largo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setBottomLength('Corto')}
                                style={bottomLength === 'Corto' ? { backgroundColor: colors.primary, borderColor: colors.primary } : {}}
                                className={`flex-1 h-14 rounded-2xl items-center justify-center border ${bottomLength === 'Corto' ? '' : `${classes.card} border-gray-200 dark:border-white/10`}`}
                            >
                                <Text className={`text-sm font-semibold ${bottomLength === 'Corto' ? 'text-white dark:text-charcoal' : classes.text}`}>🩳 Corto</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Top Length Filter */}
                    <View>
                        <View className="flex-row items-center space-x-2 mb-3">
                            <View className="w-1 h-4 bg-primary rounded-full" />
                            <Text className="text-xs font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">Parte de Arriba</Text>
                        </View>
                        <View className="flex-row space-x-3">
                            <TouchableOpacity
                                onPress={() => setTopLength('Largo')}
                                style={topLength === 'Largo' ? { backgroundColor: colors.primary, borderColor: colors.primary } : {}}
                                className={`flex-1 h-14 rounded-2xl items-center justify-center border ${topLength === 'Largo' ? '' : `${classes.card} border-gray-200 dark:border-white/10`}`}
                            >
                                <Text className={`text-sm font-semibold ${topLength === 'Largo' ? 'text-white dark:text-charcoal' : classes.text}`}>👔 Manga Larga</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setTopLength('Corto')}
                                style={topLength === 'Corto' ? { backgroundColor: colors.primary, borderColor: colors.primary } : {}}
                                className={`flex-1 h-14 rounded-2xl items-center justify-center border ${topLength === 'Corto' ? '' : `${classes.card} border-gray-200 dark:border-white/10`}`}
                            >
                                <Text className={`text-sm font-semibold ${topLength === 'Corto' ? 'text-white dark:text-charcoal' : classes.text}`}>👕 Manga Corta</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Formality Slider */}
                    <View>
                        <View className="flex-row items-center space-x-2 mb-3">
                            <View className="w-1 h-4 bg-primary rounded-full" />
                            <Text className="text-xs font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">Formalidad</Text>
                        </View>
                        <View className="px-2">
                            <View className="flex-row justify-between mb-2">
                                <Text className={`text-xs ${classes.text}`}>Muy Casual</Text>
                                <Text className={`text-xs ${classes.text}`}>Muy Formal</Text>
                            </View>
                            <View className="flex-row items-center space-x-2">
                                {[1, 2, 3, 4, 5].map((level) => (
                                    <TouchableOpacity
                                        key={level}
                                        onPress={() => setFormality(level)}
                                        style={{
                                            flex: 1,
                                            height: 12,
                                            borderRadius: 6,
                                            backgroundColor: formality >= level ? colors.primary : '#E5E7EB'
                                        }}
                                    />
                                ))}
                            </View>
                            <View className="flex-row justify-between mt-2">
                                <Text className={`text-xs ${formality === 1 ? 'font-bold' : ''} ${classes.text}`}>🏃</Text>
                                <Text className={`text-xs ${formality === 2 ? 'font-bold' : ''} ${classes.text}`}>👕</Text>
                                <Text className={`text-xs ${formality === 3 ? 'font-bold' : ''} ${classes.text}`}>👔</Text>
                                <Text className={`text-xs ${formality === 4 ? 'font-bold' : ''} ${classes.text}`}>🎩</Text>
                                <Text className={`text-xs ${formality === 5 ? 'font-bold' : ''} ${classes.text}`}>🤵</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Placeholder */}
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80, opacity: 0.7 }}>
                    <Text style={{ fontSize: 64, marginBottom: 20 }}>✨</Text>
                    <Text className={`text-xl font-semibold mb-3 ${classes.text}`}>
                        Listos para crear
                    </Text>
                    <Text style={{ color: isFemale ? '#9CA3AF' : '#6B7280', textAlign: 'center', fontSize: 15, fontWeight: '500', lineHeight: 22, paddingHorizontal: 40 }}>
                        Configura tus preferencias y pulsa el botón para generar outfits personalizados
                    </Text>
                </View>

            </ScrollView>

            {/* Footer / Generate Button */}
            <View
                className={`absolute left-0 right-0 p-6 border-t border-gray-100 dark:border-white/5 ${classes.background}`}
                style={{ bottom: Platform.OS === 'ios' ? 90 : 0 }}
            >
                <LinearGradient
                    colors={isFemale ? [colors.primary, colors.primary + 'CC'] : ['#C9A66B', '#A68757']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                        borderRadius: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8
                    }}
                >
                    <TouchableOpacity
                        onPress={generateOutfit}
                        disabled={isGenerating || loading}
                        style={{
                            height: 60,
                            borderRadius: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isGenerating || loading ? 0.7 : 1
                        }}
                        activeOpacity={0.8}
                    >
                        {isGenerating ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={{ fontSize: 24 }}>✨</Text>
                                <Text className="font-display" style={{
                                    color: 'white',
                                    fontSize: 18,
                                    fontWeight: 'bold',
                                    letterSpacing: 2,
                                    textTransform: 'uppercase'
                                }}>
                                    Generar Outfits
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </LinearGradient>
            </View >

            {/* Loading Overlay */}
            {
                loading && (
                    <View className="absolute inset-0 bg-black/20 justify-center items-center z-50">
                        <ActivityIndicator size="large" color="#C9A66B" />
                    </View>
                )
            }
        </SafeAreaView >
    );
}

