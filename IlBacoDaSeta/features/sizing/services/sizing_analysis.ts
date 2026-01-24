// ============================================================
// Servicio de Análisis de Tallas con IA
// ============================================================
// Usa Gemini 2.0 Flash para analizar la foto del usuario y
// determinar ajustes de talla basados en su complexión física.

import { supabase } from '@/lib/supabase';

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export interface SizingAnalysisResult {
    body_type: 'delgado' | 'atletico' | 'medio' | 'robusto' | 'corpulento';
    shoulder_width: 'estrecho' | 'medio' | 'ancho';
    torso_length: 'corto' | 'medio' | 'largo';
    build_notes: string;
    fit_adjustment: number;  // -1 a +1
    confidence: number;      // 0 a 1
}

export interface UserSizingProfile {
    user_id: string;
    height_cm?: number;
    reference_brand: string;
    reference_size_top?: string;
    reference_size_bottom?: string;
    reference_size_shoes?: string;
    preferred_fit: 'slim' | 'regular' | 'loose';
    // Medidas manuales
    chest_cm?: number;
    waist_cm?: number;
    hip_cm?: number;
    shoe_size_eu?: string;
    // Análisis IA
    ai_body_type?: string;
    ai_shoulder_width?: string;
    ai_torso_length?: string;
    ai_build_notes?: string;
    ai_fit_adjustment?: number;
    ai_confidence?: number;
    ai_analyzed_at?: string;
    onboarding_completed: boolean;
    measurements_saved?: boolean;
}

export interface SizeRecommendation {
    recommended_size: string;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
    alternative_size?: string;
}

// ------------------------------------------------------------
// CONSTANTES
// ------------------------------------------------------------

const ANALYSIS_MODEL = 'gemini-2.0-flash-exp';
const ANALYSIS_TIMEOUT = 20000; // 20 segundos

// Prompt estructurado para análisis de sizing
const SIZING_ANALYSIS_PROMPT = `
Analiza esta foto de una persona para determinar su perfil de tallas.
Eres un experto en moda y patronaje con años de experiencia.

IMPORTANTE: Devuelve SOLO un objeto JSON válido, sin markdown ni texto adicional.

El JSON debe tener estas claves EXACTAS:

{
    "body_type": "VALOR",
    "shoulder_width": "VALOR",
    "torso_length": "VALOR",
    "build_notes": "DESCRIPCIÓN",
    "fit_adjustment": NÚMERO,
    "confidence": NÚMERO
}

VALORES PERMITIDOS:

body_type - Complexión corporal general:
- "delgado": Constitución delgada, poco volumen corporal
- "atletico": Musculatura definida, hombros anchos, cintura estrecha
- "medio": Constitución promedio, proporciones estándar
- "robusto": Constitución ancha, volumen corporal considerable
- "corpulento": Constitución muy ancha, mucho volumen

shoulder_width - Anchura de hombros relativa al cuerpo:
- "estrecho": Hombros más estrechos que la media
- "medio": Hombros de anchura promedio
- "ancho": Hombros notablemente anchos

torso_length - Longitud del torso relativa a las piernas:
- "corto": Torso corto (piernas proporcionalmente más largas)
- "medio": Proporciones estándar
- "largo": Torso largo (piernas proporcionalmente más cortas)

build_notes - String con observaciones relevantes para el tallaje (máx 50 palabras):
- Menciona si tiene abdomen prominente, brazos largos, cuello ancho, etc.
- Cualquier característica que afecte al fit de la ropa

fit_adjustment - Número decimal entre -1 y +1:
- -1: Recomendar una talla MENOS (persona muy delgada/pequeña)
- -0.5: Recomendar media talla menos
- 0: Sin ajuste, tallas estándar
- +0.5: Recomendar media talla más (algo robusto/ancho)
- +1: Recomendar una talla MÁS (persona robusta/corpulenta)

confidence - Número decimal entre 0 y 1:
- 0.9-1.0: Foto clara de cuerpo completo, muy seguro
- 0.7-0.8: Foto clara pero parcial, bastante seguro
- 0.5-0.6: Foto con limitaciones, moderadamente seguro
- 0.3-0.4: Foto difícil de analizar, poca confianza
- 0.0-0.2: No se puede analizar correctamente

CRITERIOS DE ANÁLISIS:
1. Si la persona parece robusta o tiene abdomen prominente -> fit_adjustment +0.5 a +1
2. Si la persona es delgada sin volumen -> fit_adjustment -0.5 a 0
3. Si tiene hombros muy anchos -> considerar +0.5 para tops
4. Si el torso es largo -> notar en build_notes (afecta largo de camisas)
5. Analiza objetivamente sin juzgar la apariencia

EJEMPLO DE RESPUESTA:
{"body_type":"medio","shoulder_width":"medio","torso_length":"medio","build_notes":"Constitución promedio, proporciones equilibradas. Sin características especiales que requieran ajuste.","fit_adjustment":0,"confidence":0.85}
`;

// Análisis por defecto si falla la IA
const DEFAULT_ANALYSIS: SizingAnalysisResult = {
    body_type: 'medio',
    shoulder_width: 'medio',
    torso_length: 'medio',
    build_notes: 'Análisis no disponible, usando valores por defecto',
    fit_adjustment: 0,
    confidence: 0.3,
};

// ------------------------------------------------------------
// FUNCIONES AUXILIARES
// ------------------------------------------------------------

const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Timeout: El análisis tardó demasiado');
        }
        throw error;
    }
};

const cleanJsonResponse = (text: string): string => {
    let clean = text
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        clean = jsonMatch[0];
    }

    return clean;
};

const validateAnalysisResult = (result: any): SizingAnalysisResult => {
    const validBodyTypes = ['delgado', 'atletico', 'medio', 'robusto', 'corpulento'];
    const validWidths = ['estrecho', 'medio', 'ancho'];
    const validLengths = ['corto', 'medio', 'largo'];

    return {
        body_type: validBodyTypes.includes(result.body_type)
            ? result.body_type
            : 'medio',
        shoulder_width: validWidths.includes(result.shoulder_width)
            ? result.shoulder_width
            : 'medio',
        torso_length: validLengths.includes(result.torso_length)
            ? result.torso_length
            : 'medio',
        build_notes: typeof result.build_notes === 'string'
            ? result.build_notes.slice(0, 200)
            : '',
        fit_adjustment: typeof result.fit_adjustment === 'number'
            ? Math.max(-1, Math.min(1, result.fit_adjustment))
            : 0,
        confidence: typeof result.confidence === 'number'
            ? Math.max(0, Math.min(1, result.confidence))
            : 0.5,
    };
};

// ------------------------------------------------------------
// FUNCIONES PRINCIPALES
// ------------------------------------------------------------

/**
 * Analiza la foto del usuario con Gemini para determinar su perfil de tallas
 */
export const analyzeSizingFromPhoto = async (
    base64Image: string
): Promise<SizingAnalysisResult> => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('[SizingAnalysis] Missing API key, usando análisis por defecto');
        return DEFAULT_ANALYSIS;
    }

    try {
        console.log('[SizingAnalysis] Iniciando análisis de sizing...');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL}:generateContent?key=${apiKey}`;

        // Limpiar base64 de prefijos
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

        const response = await fetchWithTimeout(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: SIZING_ANALYSIS_PROMPT },
                                {
                                    inline_data: {
                                        mime_type: 'image/jpeg',
                                        data: cleanBase64,
                                    },
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.2, // Bajo para consistencia
                        maxOutputTokens: 512,
                    },
                }),
            },
            ANALYSIS_TIMEOUT
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('[SizingAnalysis] Error en la API:', data.error?.message);
            return DEFAULT_ANALYSIS;
        }

        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textOutput) {
            console.warn('[SizingAnalysis] Sin respuesta, usando análisis por defecto');
            return DEFAULT_ANALYSIS;
        }

        const cleanJson = cleanJsonResponse(textOutput);
        const parsed = JSON.parse(cleanJson);
        const result = validateAnalysisResult(parsed);

        console.log('[SizingAnalysis] Análisis completado:', result);
        return result;
    } catch (error: any) {
        console.error('[SizingAnalysis] Error:', error.message);
        return DEFAULT_ANALYSIS;
    }
};

/**
 * Guarda o actualiza el perfil de sizing del usuario en Supabase
 */
export const saveSizingProfile = async (
    userId: string,
    profile: Partial<UserSizingProfile>
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('user_sizing_profile')
            .upsert(
                {
                    user_id: userId,
                    ...profile,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            );

        if (error) {
            console.error('[SizingAnalysis] Error guardando perfil:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error('[SizingAnalysis] Error:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Obtiene el perfil de sizing del usuario desde Supabase
 */
export const getSizingProfile = async (
    userId: string
): Promise<UserSizingProfile | null> => {
    try {
        const { data, error } = await supabase
            .from('user_sizing_profile')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No existe el perfil
                return null;
            }
            console.error('[SizingAnalysis] Error obteniendo perfil:', error);
            return null;
        }

        return data as UserSizingProfile;
    } catch (error: any) {
        console.error('[SizingAnalysis] Error:', error.message);
        return null;
    }
};

/**
 * Analiza la foto y guarda el resultado en el perfil del usuario
 */
export const analyzeAndSaveSizing = async (
    userId: string,
    base64Image: string
): Promise<{ success: boolean; analysis?: SizingAnalysisResult; error?: string }> => {
    try {
        // 1. Analizar la foto
        const analysis = await analyzeSizingFromPhoto(base64Image);

        // 2. Guardar en el perfil
        const saveResult = await saveSizingProfile(userId, {
            ai_body_type: analysis.body_type,
            ai_shoulder_width: analysis.shoulder_width,
            ai_torso_length: analysis.torso_length,
            ai_build_notes: analysis.build_notes,
            ai_fit_adjustment: analysis.fit_adjustment,
            ai_confidence: analysis.confidence,
            ai_analyzed_at: new Date().toISOString(),
        });

        if (!saveResult.success) {
            return { success: false, error: saveResult.error };
        }

        return { success: true, analysis };
    } catch (error: any) {
        console.error('[SizingAnalysis] Error en analyzeAndSaveSizing:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Obtiene la talla recomendada llamando a la función de Supabase
 */
export const getRecommendedSize = async (
    userId: string,
    brandName: string,
    category: 'tops' | 'bottoms' | 'shoes',
    gender: 'male' | 'female' | 'unisex' = 'unisex'
): Promise<SizeRecommendation | null> => {
    try {
        const { data, error } = await supabase.rpc('get_recommended_size', {
            p_user_id: userId,
            p_brand_name: brandName,
            p_category: category,
            p_gender: gender,
        });

        if (error) {
            console.error('[SizingAnalysis] Error obteniendo recomendación:', error);
            return null;
        }

        if (!data || data.length === 0) {
            return null;
        }

        const result = data[0];
        return {
            recommended_size: result.recommended_size,
            confidence: result.confidence as 'high' | 'medium' | 'low',
            reasoning: result.reasoning,
            alternative_size: result.alternative_size,
        };
    } catch (error: any) {
        console.error('[SizingAnalysis] Error:', error.message);
        return null;
    }
};

/**
 * Guarda feedback de una compra para mejorar futuras recomendaciones
 */
export const savePurchaseFeedback = async (
    userId: string,
    purchase: {
        itemId?: number;
        brandName: string;
        category: 'tops' | 'bottoms' | 'shoes';
        sizePurchased: string;
        fitFeedback?: 1 | 2 | 3 | 4 | 5;
        returned?: boolean;
        returnReason?: 'too_small' | 'too_big' | 'other';
    }
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase.from('purchase_history').insert({
            user_id: userId,
            item_id: purchase.itemId || null,
            brand_name: purchase.brandName,
            category: purchase.category,
            size_purchased: purchase.sizePurchased,
            fit_feedback: purchase.fitFeedback || null,
            returned: purchase.returned || false,
            return_reason: purchase.returnReason || null,
        });

        if (error) {
            console.error('[SizingAnalysis] Error guardando feedback:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error('[SizingAnalysis] Error:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Obtiene las reglas de sizing de una marca
 */
export const getBrandSizingRules = async (
    brandName: string
): Promise<{
    offset: number;
    fitStyle: string;
    notes: string;
} | null> => {
    try {
        const { data, error } = await supabase
            .from('brand_sizing_rules')
            .select('size_offset, fit_style, notes')
            .eq('brand_name', brandName.toLowerCase())
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Marca no encontrada, devolver valores por defecto
                return { offset: 0, fitStyle: 'regular', notes: 'Marca no registrada' };
            }
            return null;
        }

        return {
            offset: data.size_offset,
            fitStyle: data.fit_style,
            notes: data.notes || '',
        };
    } catch (error: any) {
        console.error('[SizingAnalysis] Error:', error.message);
        return null;
    }
};

// ------------------------------------------------------------
// EXPORTACIONES
// ------------------------------------------------------------

export default {
    analyzeSizingFromPhoto,
    saveSizingProfile,
    getSizingProfile,
    analyzeAndSaveSizing,
    getRecommendedSize,
    savePurchaseFeedback,
    getBrandSizingRules,
};
