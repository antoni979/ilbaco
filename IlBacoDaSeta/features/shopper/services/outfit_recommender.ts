// Algoritmo de recomendacion de outfits para Personal Shopper
// Optimizado para moda femenina y velocidad

import { CustomerAnalysis } from './customer_analysis';

type ClosetItem = {
    id: number;
    brand: string;
    name: string;
    image_url: string;
    category?: string;
    characteristics?: {
        color?: string;
        secondary_color?: string;
        category?: string;
        sub_category?: string;
        style?: string;
        season?: string;
        pattern?: string;
    };
};

export type RecommendedOutfit = {
    outerwear?: ClosetItem;
    top: ClosetItem;
    bottom: ClosetItem;
    shoes?: ClosetItem;
    score: number;
    reasoning: string;
};

interface RecommendationParams {
    items: ClosetItem[];
    customerAnalysis: CustomerAnalysis | null;
    eventType: 'formal' | 'elegante' | 'trabajo' | 'casual';
    topLength: 'manga_corta' | 'manga_larga';
    bottomLength: 'corto' | 'largo';
    favoriteColors: string[];
    avoidColors: string[];
}

// ============================================
// CONFIGURACIÓN DE MODA FEMENINA ACTUAL
// ============================================

// Estilos por evento (moda femenina 2024-2025)
const STYLE_BY_EVENT: Record<string, string[]> = {
    formal: ['Elegante', 'Formal', 'Business'],
    elegante: ['Elegante', 'Fiesta', 'Formal'],
    trabajo: ['Business', 'Elegante', 'Casual'],
    casual: ['Casual', 'Streetwear', 'Vintage'],
};

// Categorías de prendas femeninas
const OUTERWEAR_CATS = ['abrigo', 'chaqueta', 'blazer', 'gabardina', 'cardigan', 'trench', 'plumas', 'parka'];
const TOP_CATS = ['camiseta', 'camisa', 'top', 'blusa', 'jersey', 'sudadera', 'body', 'cuerpo'];
const BOTTOM_CATS = ['pantalón', 'pantalon', 'falda', 'jeans', 'vaquero', 'shorts', 'bermuda'];
const SHOES_CATS = ['calzado', 'zapato', 'bota', 'sandalia', 'tacón', 'bailarina', 'deportiva', 'zapatilla'];
const DRESS_CATS = ['vestido', 'mono'];

// Colores neutros (base de cualquier outfit)
const NEUTRALS = ['negro', 'blanco', 'gris', 'beige', 'crema', 'azul marino', 'camel', 'marrón', 'nude'];

// Combinaciones clásicas de moda femenina
const CLASSIC_COMBOS: [string, string][] = [
    // Básicos atemporales
    ['negro', 'blanco'],
    ['negro', 'beige'],
    ['azul marino', 'blanco'],
    ['gris', 'rosa'],
    ['beige', 'blanco'],
    ['camel', 'negro'],
    ['crema', 'azul marino'],
    // Tendencias actuales
    ['verde', 'beige'],
    ['burdeos', 'camel'],
    ['azul', 'beige'],
    ['rosa', 'gris'],
    ['lavanda', 'blanco'],
    ['terracota', 'crema'],
];

// Colores que chocan (evitar juntos)
const CLASHING: [string, string][] = [
    ['rojo', 'naranja'],
    ['rojo', 'rosa'],
    ['naranja', 'rosa'],
    ['verde', 'rojo'],
    ['morado', 'naranja'],
];

// Combinaciones elegantes por evento
const ELEGANT_COMBOS: Record<string, string[][]> = {
    formal: [
        ['negro', 'negro'], // Total black
        ['azul marino', 'negro'],
        ['burdeos', 'negro'],
        ['beige', 'blanco'],
    ],
    elegante: [
        ['negro', 'dorado'],
        ['burdeos', 'negro'],
        ['verde', 'negro'],
        ['azul', 'plata'],
    ],
    trabajo: [
        ['azul marino', 'blanco'],
        ['gris', 'blanco'],
        ['beige', 'azul'],
        ['negro', 'gris'],
    ],
    casual: [
        ['blanco', 'azul'],
        ['beige', 'blanco'],
        ['gris', 'rosa'],
        ['verde', 'blanco'],
    ],
};

// ============================================
// FUNCIONES AUXILIARES OPTIMIZADAS
// ============================================

const normalize = (s: string): string => (s || '').toLowerCase().trim();

const matchesCategory = (item: ClosetItem, cats: string[]): boolean => {
    const cat = normalize(item.category || item.characteristics?.category || '');
    const name = normalize(item.name || '');
    return cats.some(c => cat.includes(c) || name.includes(c));
};

const getColor = (item: ClosetItem): string => normalize(item.characteristics?.color || '');

const colorMatches = (itemColor: string, colorList: string[]): boolean => {
    const c = normalize(itemColor);
    return colorList.some(target => c.includes(normalize(target)) || normalize(target).includes(c));
};

const isNeutral = (color: string): boolean => colorMatches(color, NEUTRALS);

const isTopShortSleeve = (item: ClosetItem): boolean => {
    const cat = normalize(item.category || item.characteristics?.category || '');
    const name = normalize(item.name);
    const season = normalize(item.characteristics?.season || '');

    // Categorías típicamente manga corta
    if (cat.includes('camiseta') || cat.includes('top') || cat.includes('body')) return true;
    // Temporada verano
    if (season.includes('verano') || season.includes('primavera')) return true;
    // Nombre indica manga corta
    if (name.includes('manga corta') || name.includes('tirantes')) return true;
    return false;
};

const isTopLongSleeve = (item: ClosetItem): boolean => {
    const cat = normalize(item.category || item.characteristics?.category || '');
    const name = normalize(item.name);
    const season = normalize(item.characteristics?.season || '');

    // Categorías típicamente manga larga
    if (cat.includes('jersey') || cat.includes('sudadera') || cat.includes('blusa') ||
        (cat.includes('camisa') && !cat.includes('camiseta'))) return true;
    // Temporada invierno
    if (season.includes('invierno') || season.includes('otoño')) return true;
    // Nombre indica manga larga
    if (name.includes('manga larga')) return true;
    return false;
};

const isBottomShort = (item: ClosetItem): boolean => {
    const cat = normalize(item.category || item.characteristics?.category || '');
    const name = normalize(item.name);
    return cat.includes('short') || cat.includes('bermuda') || name.includes('corto');
};

const isBottomLong = (item: ClosetItem): boolean => {
    const cat = normalize(item.category || item.characteristics?.category || '');
    return cat.includes('pantalón') || cat.includes('pantalon') || cat.includes('jean') ||
           cat.includes('vaquero') || cat.includes('falda');
};

// ============================================
// SCORING RÁPIDO Y PRECISO
// ============================================

const scoreOutfit = (
    top: ClosetItem,
    bottom: ClosetItem,
    shoes: ClosetItem | undefined,
    outerwear: ClosetItem | undefined,
    params: RecommendationParams
): { score: number; reasons: string[] } => {
    let score = 50;
    const reasons: string[] = [];

    const topColor = getColor(top);
    const bottomColor = getColor(bottom);
    const shoesColor = shoes ? getColor(shoes) : '';
    const outerwearColor = outerwear ? getColor(outerwear) : '';

    const topStyle = normalize(top.characteristics?.style || '');
    const bottomStyle = normalize(bottom.characteristics?.style || '');

    // ========== RESTRICCIONES DEL USUARIO (CRÍTICO) ==========

    // Colores a evitar - penalización máxima
    if (colorMatches(topColor, params.avoidColors)) {
        score -= 200;
        reasons.push('Top: color a evitar');
    }
    if (colorMatches(bottomColor, params.avoidColors)) {
        score -= 200;
        reasons.push('Bottom: color a evitar');
    }

    // Colores favoritos - bonus significativo
    if (colorMatches(topColor, params.favoriteColors)) {
        score += 30;
        reasons.push('Top: color favorito');
    }
    if (colorMatches(bottomColor, params.favoriteColors)) {
        score += 25;
        reasons.push('Bottom: color favorito');
    }

    // ========== ANÁLISIS IA DEL CLIENTE ==========

    if (params.customerAnalysis) {
        const { colors_that_favor, colors_to_avoid } = params.customerAnalysis;

        // Colores que favorecen según tono de piel
        if (colors_that_favor?.length) {
            if (colorMatches(topColor, colors_that_favor)) {
                score += 25;
                reasons.push('Top: favorece tu tono');
            }
            if (colorMatches(bottomColor, colors_that_favor)) {
                score += 15;
                reasons.push('Bottom: favorece tu tono');
            }
        }

        // Colores que no favorecen según IA
        if (colors_to_avoid?.length) {
            if (colorMatches(topColor, colors_to_avoid)) {
                score -= 40;
                reasons.push('Top: no favorece tu tono');
            }
        }
    }

    // ========== REGLAS DE MODA FEMENINA ==========

    // Combinaciones clásicas elegantes
    const isClassic = CLASSIC_COMBOS.some(([c1, c2]) =>
        (topColor.includes(c1) && bottomColor.includes(c2)) ||
        (topColor.includes(c2) && bottomColor.includes(c1))
    );
    if (isClassic) {
        score += 25;
        reasons.push('Combinación clásica');
    }

    // Combinaciones específicas por evento
    const eventCombos = ELEGANT_COMBOS[params.eventType] || [];
    const isEventCombo = eventCombos.some(([c1, c2]) =>
        topColor.includes(c1) && bottomColor.includes(c2)
    );
    if (isEventCombo) {
        score += 20;
        reasons.push('Ideal para el evento');
    }

    // Contraste equilibrado (uno neutro, uno color)
    const topNeutral = isNeutral(topColor);
    const bottomNeutral = isNeutral(bottomColor);
    if ((topNeutral && !bottomNeutral) || (!topNeutral && bottomNeutral)) {
        score += 15;
        reasons.push('Buen equilibrio de colores');
    }

    // Total look neutro (elegante y seguro)
    if (topNeutral && bottomNeutral) {
        score += 10;
        reasons.push('Look neutro elegante');
    }

    // Evitar colores que chocan
    const isClashing = CLASHING.some(([c1, c2]) =>
        (topColor.includes(c1) && bottomColor.includes(c2)) ||
        (topColor.includes(c2) && bottomColor.includes(c1))
    );
    if (isClashing) {
        score -= 30;
        reasons.push('Colores que chocan');
    }

    // Estilo apropiado al evento
    const appropriateStyles = STYLE_BY_EVENT[params.eventType] || [];
    if (appropriateStyles.some(s => topStyle.includes(s.toLowerCase()))) {
        score += 15;
        reasons.push('Top: estilo apropiado');
    }
    if (appropriateStyles.some(s => bottomStyle.includes(s.toLowerCase()))) {
        score += 10;
        reasons.push('Bottom: estilo apropiado');
    }

    // ========== ACCESORIOS ==========

    // Zapatos que combinan
    if (shoes) {
        if (isNeutral(shoesColor)) {
            score += 8;
            reasons.push('Calzado neutro');
        }
        if (shoesColor === topColor || shoesColor === bottomColor) {
            score += 5;
            reasons.push('Calzado a juego');
        }
    }

    // Abrigo que combina
    if (outerwear) {
        if (isNeutral(outerwearColor)) {
            score += 8;
            reasons.push('Abrigo neutro');
        }
        if (colorMatches(outerwearColor, params.favoriteColors)) {
            score += 10;
            reasons.push('Abrigo: color favorito');
        }
    }

    return { score, reasons };
};

// ============================================
// GENERADOR DE OUTFITS OPTIMIZADO
// ============================================

export function recommendOutfits(params: RecommendationParams): RecommendedOutfit[] {
    const startTime = Date.now();
    const { items } = params;

    // Clasificar items por categoría
    const outerwear = items.filter(i => matchesCategory(i, OUTERWEAR_CATS));
    const allTops = items.filter(i => matchesCategory(i, TOP_CATS) && !matchesCategory(i, OUTERWEAR_CATS));
    const allBottoms = items.filter(i => matchesCategory(i, BOTTOM_CATS));
    const shoes = items.filter(i => matchesCategory(i, SHOES_CATS));
    const dresses = items.filter(i => matchesCategory(i, DRESS_CATS));

    // Filtrar por longitud de manga
    let tops = params.topLength === 'manga_corta'
        ? allTops.filter(isTopShortSleeve)
        : allTops.filter(isTopLongSleeve);

    // Si no hay suficientes, usar todos los tops
    if (tops.length < 3) {
        tops = allTops;
    }

    // Filtrar por longitud de pantalón
    let bottoms = params.bottomLength === 'corto'
        ? allBottoms.filter(isBottomShort)
        : allBottoms.filter(isBottomLong);

    // Si no hay suficientes, usar todos los bottoms
    if (bottoms.length < 3) {
        bottoms = allBottoms;
    }

    console.log(`[Recommender] ${tops.length} tops, ${bottoms.length} bottoms, ${shoes.length} shoes, ${outerwear.length} outerwear`);

    // Limitar combinaciones para velocidad (máximo 50 de cada)
    const maxItems = 15;
    const limitedTops = tops.slice(0, maxItems);
    const limitedBottoms = bottoms.slice(0, maxItems);

    // Seleccionar abrigo y zapatos una vez (el mejor neutral o favorito)
    const bestShoes = shoes.find(s =>
        colorMatches(getColor(s), params.favoriteColors) || isNeutral(getColor(s))
    ) || shoes[0];

    const bestOuterwear = outerwear.find(o =>
        colorMatches(getColor(o), params.favoriteColors) || isNeutral(getColor(o))
    ) || outerwear[0];

    // Generar y puntuar combinaciones
    const scoredOutfits: RecommendedOutfit[] = [];

    for (const top of limitedTops) {
        for (const bottom of limitedBottoms) {
            const { score, reasons } = scoreOutfit(top, bottom, bestShoes, bestOuterwear, params);

            // Solo incluir outfits con score positivo
            if (score > 0) {
                scoredOutfits.push({
                    top,
                    bottom,
                    shoes: bestShoes,
                    outerwear: bestOuterwear,
                    score,
                    reasoning: reasons.join(' | '),
                });
            }
        }
    }

    // Ordenar por score
    scoredOutfits.sort((a, b) => b.score - a.score);

    // Seleccionar top 3 diversificados (no repetir mismo top o bottom)
    const selected: RecommendedOutfit[] = [];
    const usedTops = new Set<number>();
    const usedBottoms = new Set<number>();

    for (const outfit of scoredOutfits) {
        if (selected.length >= 3) break;

        // Preferir variedad en los primeros 2
        if (selected.length < 2) {
            if (!usedTops.has(outfit.top.id) && !usedBottoms.has(outfit.bottom.id)) {
                selected.push(outfit);
                usedTops.add(outfit.top.id);
                usedBottoms.add(outfit.bottom.id);
            }
        } else {
            // El tercero puede repetir algo si es necesario
            if (!usedTops.has(outfit.top.id) || !usedBottoms.has(outfit.bottom.id)) {
                selected.push(outfit);
                usedTops.add(outfit.top.id);
                usedBottoms.add(outfit.bottom.id);
            }
        }
    }

    // Si no tenemos 3, rellenar
    if (selected.length < 3) {
        for (const outfit of scoredOutfits) {
            if (selected.length >= 3) break;
            if (!selected.some(s => s.top.id === outfit.top.id && s.bottom.id === outfit.bottom.id)) {
                selected.push(outfit);
            }
        }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Recommender] ${selected.length} outfits en ${elapsed}ms`);

    return selected;
}
