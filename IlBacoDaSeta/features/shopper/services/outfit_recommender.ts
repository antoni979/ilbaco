// Algoritmo de recomendacion de outfits para Personal Shopper

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

// Mapeo de estilos por tipo de evento
const STYLE_BY_EVENT: Record<string, string[]> = {
    formal: ['Formal', 'Elegante', 'Business'],
    elegante: ['Elegante', 'Formal', 'Business', 'Fiesta'],
    trabajo: ['Business', 'Casual', 'Formal'],
    casual: ['Casual', 'Streetwear', 'Deportivo', 'Vintage'],
};

// Categorias de prendas
const OUTERWEAR_CATEGORIES = ['abrigo', 'chaqueta', 'cazadora', 'blazer', 'gabardina', 'parka', 'plumas', 'cardigan', 'bomber', 'trench'];
const TOP_CATEGORIES = ['camiseta', 'camisa', 'polo', 'top', 'blusa', 'jersey', 'sudadera', 'chaleco', 'vestido'];
const BOTTOM_CATEGORIES = ['pantalon', 'pantalón', 'shorts', 'falda', 'jeans', 'vaquero', 'bermuda'];
const SHOES_CATEGORIES = ['calzado', 'zapato', 'zapatilla', 'bota', 'sandalia', 'deportiva'];

// Categorias manga corta
const SHORT_SLEEVE_CATEGORIES = ['camiseta', 'polo', 'top'];
const LONG_SLEEVE_CATEGORIES = ['camisa', 'jersey', 'sudadera', 'blusa'];

// Colores neutros que combinan con todo
const NEUTRAL_COLORS = ['negro', 'blanco', 'gris', 'beige', 'azul marino', 'marron', 'camel'];

// Combinaciones clasicas de colores
const CLASSIC_COMBOS: [string, string][] = [
    ['azul marino', 'blanco'],
    ['negro', 'blanco'],
    ['gris', 'azul'],
    ['beige', 'azul marino'],
    ['blanco', 'azul'],
    ['negro', 'gris'],
    ['marron', 'beige'],
    ['verde oliva', 'beige'],
    ['burdeos', 'gris'],
];

function normalizeColor(color: string): string {
    return (color || '').toLowerCase().trim();
}

function isOuterwearCategory(category: string): boolean {
    const cat = category.toLowerCase();
    return OUTERWEAR_CATEGORIES.some(c => cat.includes(c));
}

function isTopCategory(category: string): boolean {
    const cat = category.toLowerCase();
    // Excluir outerwear de tops para evitar duplicados
    if (isOuterwearCategory(cat)) return false;
    return TOP_CATEGORIES.some(c => cat.includes(c));
}

function isBottomCategory(category: string): boolean {
    const cat = category.toLowerCase();
    return BOTTOM_CATEGORIES.some(c => cat.includes(c));
}

function isShoesCategory(category: string): boolean {
    const cat = category.toLowerCase();
    return SHOES_CATEGORIES.some(c => cat.includes(c));
}

function matchesTopLength(item: ClosetItem, length: 'manga_corta' | 'manga_larga'): boolean {
    const subCat = (item.characteristics?.sub_category || item.name || '').toLowerCase();
    const cat = (item.category || item.characteristics?.category || '').toLowerCase();
    const season = (item.characteristics?.season || '').toLowerCase();

    // Detectar explicitamente si es manga corta o larga
    const isExplicitShortSleeve = subCat.includes('manga corta') || subCat.includes('tirantes');
    const isExplicitLongSleeve = subCat.includes('manga larga');

    // Categorias que son inherentemente manga corta (camiseta != camisa)
    const isShortSleeveCategory = cat.includes('camiseta') || cat.includes('polo') || cat.includes('top ') || cat === 'top';
    // Categorias que son inherentemente manga larga (camisa pero NO camiseta)
    const isLongSleeveCategory = (cat.includes('camisa') && !cat.includes('camiseta')) ||
                                  cat.includes('jersey') || cat.includes('sudadera') || cat.includes('blusa');

    if (length === 'manga_corta') {
        // Excluir si explicitamente dice manga larga
        if (isExplicitLongSleeve) return false;
        // Incluir si explicitamente dice manga corta
        if (isExplicitShortSleeve) return true;
        // Incluir categorias de manga corta
        if (isShortSleeveCategory) return true;
        // Excluir categorias de manga larga
        if (isLongSleeveCategory) return false;
        // Items de verano tienden a manga corta
        if (season.includes('verano') || season.includes('primavera')) return true;
        // Por defecto, no incluir si no podemos determinar
        return false;
    } else {
        // Excluir si explicitamente dice manga corta
        if (isExplicitShortSleeve) return false;
        // Incluir si explicitamente dice manga larga
        if (isExplicitLongSleeve) return true;
        // Incluir categorias de manga larga
        if (isLongSleeveCategory) return true;
        // Excluir categorias de manga corta
        if (isShortSleeveCategory) return false;
        // Items de invierno tienden a manga larga
        if (season.includes('invierno') || season.includes('otoño')) return true;
        // Por defecto, no incluir si no podemos determinar
        return false;
    }
}

function matchesBottomLength(item: ClosetItem, length: 'corto' | 'largo'): boolean {
    const subCat = (item.characteristics?.sub_category || item.name || '').toLowerCase();
    const cat = (item.category || item.characteristics?.category || '').toLowerCase();
    const season = (item.characteristics?.season || '').toLowerCase();

    if (length === 'corto') {
        // Corto: shorts, bermudas, o items de verano
        if (cat.includes('short') || cat.includes('bermuda') || cat.includes('corto')) return true;
        if (subCat.includes('corto') || subCat.includes('short')) return true;
        if (season.includes('verano') && !cat.includes('pantalon') && !cat.includes('pantalón')) return true;
        return false;
    } else {
        // Largo: pantalones, jeans, faldas, o items de invierno
        if (cat.includes('pantalon') || cat.includes('pantalón') || cat.includes('jean') || cat.includes('vaquero') || cat.includes('falda')) return true;
        if (subCat.includes('largo')) return true;
        // Por defecto los pantalones son largos
        if (!cat.includes('short') && !cat.includes('bermuda') && !subCat.includes('corto')) return true;
        return false;
    }
}

function getItemColor(item: ClosetItem): string {
    return normalizeColor(item.characteristics?.color || '');
}

function colorInList(itemColor: string, colorList: string[]): boolean {
    const normalized = normalizeColor(itemColor);
    return colorList.some(c => normalized.includes(normalizeColor(c)) || normalizeColor(c).includes(normalized));
}

function scoreOutfit(
    top: ClosetItem,
    bottom: ClosetItem,
    shoes: ClosetItem | undefined,
    params: RecommendationParams
): { score: number; reasoning: string[] } {
    let score = 50; // Base score
    const reasons: string[] = [];

    const topColor = getItemColor(top);
    const bottomColor = getItemColor(bottom);
    const shoesColor = shoes ? getItemColor(shoes) : '';

    const topStyle = (top.characteristics?.style || '').toLowerCase();
    const bottomStyle = (bottom.characteristics?.style || '').toLowerCase();

    // 1. Penalizar colores a evitar (CRITICO)
    if (colorInList(topColor, params.avoidColors)) {
        score -= 100; // Descalifica
        reasons.push('Top tiene color a evitar');
    }
    if (colorInList(bottomColor, params.avoidColors)) {
        score -= 100;
        reasons.push('Bottom tiene color a evitar');
    }
    if (shoes && colorInList(shoesColor, params.avoidColors)) {
        score -= 50;
        reasons.push('Zapatos tienen color a evitar');
    }

    // 2. Bonus por colores favoritos
    if (colorInList(topColor, params.favoriteColors)) {
        score += 20;
        reasons.push('+20 Top color favorito');
    }
    if (colorInList(bottomColor, params.favoriteColors)) {
        score += 15;
        reasons.push('+15 Bottom color favorito');
    }

    // 3. Bonus por colores que favorecen al cliente (de su analisis)
    if (params.customerAnalysis) {
        const favorColors = params.customerAnalysis.colors_that_favor || [];
        if (colorInList(topColor, favorColors)) {
            score += 15;
            reasons.push('+15 Top favorece tono de piel');
        }
        if (colorInList(bottomColor, favorColors)) {
            score += 10;
            reasons.push('+10 Bottom favorece tono de piel');
        }
    }

    // 4. Bonus por estilo apropiado al evento
    const appropriateStyles = STYLE_BY_EVENT[params.eventType] || [];
    if (appropriateStyles.some(s => topStyle.includes(s.toLowerCase()))) {
        score += 15;
        reasons.push('+15 Top estilo apropiado');
    }
    if (appropriateStyles.some(s => bottomStyle.includes(s.toLowerCase()))) {
        score += 10;
        reasons.push('+10 Bottom estilo apropiado');
    }

    // 5. Bonus por combinaciones clasicas
    const isClassicCombo = CLASSIC_COMBOS.some(([c1, c2]) =>
        (topColor.includes(c1) && bottomColor.includes(c2)) ||
        (topColor.includes(c2) && bottomColor.includes(c1))
    );
    if (isClassicCombo) {
        score += 20;
        reasons.push('+20 Combinacion clasica de colores');
    }

    // 6. Bonus por contraste (uno neutro, otro con color)
    const topNeutral = colorInList(topColor, NEUTRAL_COLORS);
    const bottomNeutral = colorInList(bottomColor, NEUTRAL_COLORS);

    if ((topNeutral && !bottomNeutral) || (!topNeutral && bottomNeutral)) {
        score += 12;
        reasons.push('+12 Buen contraste neutro/color');
    }

    // 7. Penalizar dos colores muy vibrantes juntos
    const vibrantColors = ['rojo', 'naranja', 'amarillo', 'rosa', 'morado', 'verde'];
    const topVibrant = vibrantColors.some(c => topColor.includes(c));
    const bottomVibrant = vibrantColors.some(c => bottomColor.includes(c));
    if (topVibrant && bottomVibrant) {
        score -= 15;
        reasons.push('-15 Dos colores vibrantes');
    }

    // 8. Bonus si zapatos combinan
    if (shoes) {
        if (shoesColor === topColor || shoesColor === bottomColor) {
            score += 8;
            reasons.push('+8 Zapatos combinan');
        }
        if (colorInList(shoesColor, NEUTRAL_COLORS)) {
            score += 5;
            reasons.push('+5 Zapatos neutros');
        }
    }

    // 9. Penalizar estilos incompatibles
    const formalStyles = ['formal', 'elegante', 'business'];
    const casualStyles = ['deportivo', 'streetwear'];
    const topFormal = formalStyles.some(s => topStyle.includes(s));
    const bottomCasual = casualStyles.some(s => bottomStyle.includes(s));
    if (topFormal && bottomCasual) {
        score -= 20;
        reasons.push('-20 Estilos incompatibles');
    }

    return { score, reasoning: reasons };
}

export function recommendOutfits(params: RecommendationParams): RecommendedOutfit[] {
    const { items } = params;

    // Separar items por categoria
    const outerwear = items.filter(item => {
        const cat = item.category || item.characteristics?.category || '';
        return isOuterwearCategory(cat);
    });

    const tops = items.filter(item => {
        const cat = item.category || item.characteristics?.category || '';
        if (!isTopCategory(cat)) return false;
        return matchesTopLength(item, params.topLength);
    });

    const bottoms = items.filter(item => {
        const cat = item.category || item.characteristics?.category || '';
        if (!isBottomCategory(cat)) return false;
        return matchesBottomLength(item, params.bottomLength);
    });

    const shoes = items.filter(item => {
        const cat = item.category || item.characteristics?.category || '';
        return isShoesCategory(cat);
    });

    console.log(`[Recommender] Found ${outerwear.length} outerwear, ${tops.length} tops, ${bottoms.length} bottoms, ${shoes.length} shoes`);

    // Si no hay suficientes items, relajar filtros
    let finalTops = tops;
    let finalBottoms = bottoms;

    if (tops.length === 0) {
        finalTops = items.filter(item => {
            const cat = item.category || item.characteristics?.category || '';
            return isTopCategory(cat);
        });
        console.log(`[Recommender] Relaxed top filter: ${finalTops.length} tops`);
    }

    if (bottoms.length === 0) {
        finalBottoms = items.filter(item => {
            const cat = item.category || item.characteristics?.category || '';
            return isBottomCategory(cat);
        });
        console.log(`[Recommender] Relaxed bottom filter: ${finalBottoms.length} bottoms`);
    }

    // Generar todas las combinaciones y puntuar
    const allOutfits: RecommendedOutfit[] = [];

    for (const top of finalTops) {
        for (const bottom of finalBottoms) {
            // Obtener un zapato random o undefined
            const shoe = shoes.length > 0 ? shoes[Math.floor(Math.random() * shoes.length)] : undefined;
            // Obtener un abrigo random o undefined
            const jacket = outerwear.length > 0 ? outerwear[Math.floor(Math.random() * outerwear.length)] : undefined;

            const { score, reasoning } = scoreOutfit(top, bottom, shoe, params);

            // Solo incluir si pasa el minimo
            if (score > 0) {
                allOutfits.push({
                    outerwear: jacket,
                    top,
                    bottom,
                    shoes: shoe,
                    score,
                    reasoning: reasoning.join(', '),
                });
            }
        }
    }

    // Ordenar por score y devolver los 3 mejores
    allOutfits.sort((a, b) => b.score - a.score);

    // Intentar diversificar los outfits (no repetir el mismo top)
    const selected: RecommendedOutfit[] = [];
    const usedTopIds = new Set<number>();
    const usedBottomIds = new Set<number>();

    for (const outfit of allOutfits) {
        if (selected.length >= 3) break;

        // Preferir variedad
        if (selected.length < 2 || !usedTopIds.has(outfit.top.id) || !usedBottomIds.has(outfit.bottom.id)) {
            selected.push(outfit);
            usedTopIds.add(outfit.top.id);
            usedBottomIds.add(outfit.bottom.id);
        }
    }

    // Si no tenemos 3, rellenar con los mejores disponibles
    if (selected.length < 3) {
        for (const outfit of allOutfits) {
            if (selected.length >= 3) break;
            if (!selected.includes(outfit)) {
                selected.push(outfit);
            }
        }
    }

    console.log(`[Recommender] Returning ${selected.length} outfits`);
    return selected;
}
