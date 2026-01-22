// Servicio de analisis de cliente para Personal Shopper
// Usa Gemini 2.0 Flash para analizar foto del cliente

export interface CustomerAnalysis {
    skin_tone: 'muy_claro' | 'claro' | 'medio' | 'bronceado' | 'oscuro' | 'muy_oscuro';
    skin_undertone: 'frio' | 'calido' | 'neutro'; // Para recomendar colores
    body_type: 'delgado' | 'atletico' | 'medio' | 'robusto' | 'corpulento';
    height_estimate: 'bajo' | 'medio' | 'alto'; // Estimacion visual
    style_vibe: string; // Descripcion breve del estilo que proyecta
    recommended_fits: string[]; // Tipos de corte recomendados
    colors_that_favor: string[]; // Colores que le favorecen segun su tono
    colors_to_avoid: string[]; // Colores que NO le favorecen
}

const ANALYSIS_PROMPT = `
Analiza esta foto de una persona para recomendar ropa. Eres un experto en moda y colorimetria.
Devuelve un objeto JSON RAW (sin markdown, sin comillas invertidas) con estas claves exactas:

- skin_tone: Tono de piel. DEBE SER UNO DE: ["muy_claro", "claro", "medio", "bronceado", "oscuro", "muy_oscuro"]

- skin_undertone: Subtono de piel para colorimetria. DEBE SER UNO DE: ["frio", "calido", "neutro"]
  * Frio: venas azuladas/moradas, piel rosada, favorecen plata
  * Calido: venas verdosas, piel dorada/melocoton, favorecen oro
  * Neutro: mezcla de ambos

- body_type: Complexion corporal. DEBE SER UNO DE: ["delgado", "atletico", "medio", "robusto", "corpulento"]

- height_estimate: Estimacion de altura. DEBE SER UNO DE: ["bajo", "medio", "alto"]

- style_vibe: Descripcion breve (max 10 palabras) del estilo que proyecta la persona (ej. "Clasico elegante", "Moderno urbano", "Casual relajado")

- recommended_fits: Array de 2-3 tipos de corte que le favorecerian (ej. ["Slim fit", "Regular", "Oversize"])

- colors_that_favor: Array de 4-6 colores que le favorecen segun su colorimetria (nombres en espanol, ej. ["Azul marino", "Blanco", "Gris", "Verde oliva"])

- colors_to_avoid: Array de 3-4 colores que NO le favorecen segun su colorimetria (nombres en espanol, ej. ["Naranja", "Amarillo", "Rosa"])
  * Subtonos frios: evitar naranjas, amarillos calidos, marrones calidos
  * Subtonos calidos: evitar rosas frios, azules muy frios, grises frios
  * Pieles muy claras: evitar colores que las hagan ver palidas
  * Pieles oscuras: evitar colores que no contrasten bien

IMPORTANTE:
- Analiza objetivamente sin juzgar
- Basa las recomendaciones en teoria del color y proporcion corporal
- Se preciso y profesional
`;

// Modelo economico para analisis
const ANALYSIS_MODEL = 'gemini-2.0-flash-exp';

export const analyzeCustomer = async (base64Image: string): Promise<CustomerAnalysis | null> => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
        console.error("[CustomerAnalysis] Missing EXPO_PUBLIC_GEMINI_API_KEY");
        return null;
    }

    try {
        console.log("[CustomerAnalysis] Iniciando analisis de cliente...");

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL}:generateContent?key=${apiKey}`;

        // Limpiar base64 de prefijos
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: ANALYSIS_PROMPT },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: cleanBase64
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1024,
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("[CustomerAnalysis] Error en la API:", data.error?.message);
            throw new Error(data.error?.message || "Error al analizar cliente");
        }

        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textOutput) {
            throw new Error("No se recibio respuesta del modelo");
        }

        // Limpiar y parsear JSON
        let cleanJson = textOutput
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();

        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanJson = jsonMatch[0];
        }

        const result = JSON.parse(cleanJson) as CustomerAnalysis;
        console.log("[CustomerAnalysis] Analisis completado:", result);
        return result;

    } catch (error: any) {
        console.error("[CustomerAnalysis] Error:", error.message);
        return null;
    }
};

// Colores predefinidos para la UI
export const COLOR_PALETTE = [
    { name: 'Negro', hex: '#000000' },
    { name: 'Blanco', hex: '#FFFFFF' },
    { name: 'Gris', hex: '#808080' },
    { name: 'Azul Marino', hex: '#000080' },
    { name: 'Azul', hex: '#0066CC' },
    { name: 'Azul Claro', hex: '#87CEEB' },
    { name: 'Rojo', hex: '#CC0000' },
    { name: 'Burdeos', hex: '#800020' },
    { name: 'Rosa', hex: '#FFC0CB' },
    { name: 'Verde', hex: '#228B22' },
    { name: 'Verde Oliva', hex: '#808000' },
    { name: 'Verde Menta', hex: '#98FF98' },
    { name: 'Beige', hex: '#F5F5DC' },
    { name: 'Marron', hex: '#8B4513' },
    { name: 'Camel', hex: '#C19A6B' },
    { name: 'Naranja', hex: '#FF8C00' },
    { name: 'Amarillo', hex: '#FFD700' },
    { name: 'Morado', hex: '#800080' },
    { name: 'Lavanda', hex: '#E6E6FA' },
];

// Tipos de eventos
export const EVENT_TYPES = [
    { key: 'formal', label: 'Evento Formal', description: 'Bodas, galas, eventos de etiqueta', icon: 'stars' },
    { key: 'elegante', label: 'Elegante', description: 'Cenas, fines de semana especiales', icon: 'restaurant' },
    { key: 'trabajo', label: 'Trabajo', description: 'Oficina, reuniones, business casual', icon: 'work' },
    { key: 'casual', label: 'Casual', description: 'Dia a dia, paseo, compras', icon: 'weekend' },
];
