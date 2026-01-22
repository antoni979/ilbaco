
export interface ClothingCharacteristics {
    color: string;
    secondary_color?: string;
    category: string;
    sub_category?: string;
    style: 'Casual' | 'Formal' | 'Deportivo' | 'Elegante' | 'Business' | 'Fiesta' | 'Vintage' | 'Streetwear';
    season: 'Verano/Primavera' | 'Invierno/Otoño';
    pattern: 'Solid' | 'Striped' | 'Polka Dot' | 'Floral' | 'Plaid' | 'Print' | 'Other';
    brand_guess?: string;
    material_guess?: string;
}

const SYSTEM_PROMPT = `
Analiza esta imagen de una prenda de ropa. Eres un experto en moda.
Devuelve un objeto JSON RAW (sin markdown, sin comillas invertidas) con estas claves exactas:

- category: Categoría principal. DEBE SER EXACTAMENTE UNA DE ESTAS (NO INVENTES, NO USES 'Hombre' NI 'Mujer'):
  ["Camiseta", "Polo", "Camisa", "Pantalón", "Pantalón corto", "Shorts", "Bañador", "Baño", "Chaqueta", "Abrigo", "Jersey", "Chaleco", "Sudadera", "Calzado", "Accesorios", "Vestido", "Mono", "Top", "Blusa", "Falda"]
  * IMPORTANTE: Si es un pantalón vaquero, usa "Pantalón". Si es una camiseta básica, usa "Camiseta". NUNCA devuelvas "Hombre" o "Mujer" como categoría.

- sub_category: Tipo específico (ej. Vaqueros, Jersey de Cuello Alto, Polo Manga Corta, Vestido Midi, Mono Largo, Top Crop, Blusa de Seda, Chaqueta Bomber, Sudadera con Capucha, Zapatillas Deportivas)

- color: Color dominante (Nombre en Español, ej. Negro, Azul Marino, Beige, Rojo Vino, Gris Oscuro)

- secondary_color: Color secundario si existe (Nombre en Español), o null si no hay

- pattern: Uno de [Solid, Striped, Polka Dot, Floral, Plaid, Print, Other] (valores en inglés)

- style: UNO de [Casual, Formal, Deportivo, Elegante, Business, Fiesta, Vintage, Streetwear]
  * Casual=uso diario relajado
  * Formal=eventos serios
  * Deportivo=ejercicio/sport
  * Elegante=salir/ocasiones especiales
  * Business=trabajo profesional
  * Fiesta=celebraciones
  * Vintage=retro/clásico
  * Streetwear=urbano moderno

- season: Una de [Verano/Primavera, Invierno/Otoño]
  * REGLAS ESTRICTAS DE OBLIGADO CUMPLIMIENTO:
  * Verano/Primavera: Asignar SIEMPRE si es: Camiseta manga corta, Polo manga corta, Camisa manga corta, Shorts, Pantalones cortos, Top, Tirantes.
  * Invierno/Otoño: Asignar SIEMPRE si es: Pantalón largo (Vaqueros, Chinos, Cargo, Sastre), Chaqueta, Abrigo, Sudadera, Jersey, Cardigan.
  * Regla General: Si cubre las piernas o es de abrigo -> Invierno/Otoño. Si muestra piel (brazos/piernas) -> Verano/Primavera.

- brand_guess: Nombre de la marca si el logo es visible, sino null

- material_guess: Material predicho (En Español: Algodón, Denim, Cuero, Lino, Poliéster, Lana, Seda, Mezcla, Nylon), o null si no estás seguro
`;

// ⚠️ MODELO BLOQUEADO: Solo Gemini 2.0 Flash para optimización de costes
// NO CAMBIAR - Este es el modelo más económico para análisis de imágenes
// Coste: ~$0.0011 por análisis
const LOCKED_MODEL = 'gemini-2.0-flash-exp' as const;

export const analyzeClothingItem = async (base64Image: string): Promise<ClothingCharacteristics> => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
        console.error("Missing EXPO_PUBLIC_GEMINI_API_KEY");
        return {
            category: 'Error',
            color: 'Error',
            style: 'Casual',
            season: 'Verano/Primavera',
            pattern: 'Solid',
            sub_category: 'API Key Missing'
        };
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${LOCKED_MODEL}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: SYSTEM_PROMPT },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 1024,
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error en la API:", data.error?.message);
            throw new Error(data.error?.message || "Error al analizar la imagen");
        }

        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textOutput) {
            throw new Error("No se recibió respuesta del modelo");
        }

        // Limpiar y parsear JSON (el modelo puede devolver con o sin markdown)
        let cleanJson = textOutput
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();

        // Si el texto tiene contenido antes/después del JSON, extraer solo el JSON
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanJson = jsonMatch[0];
        }

        const result = JSON.parse(cleanJson) as ClothingCharacteristics;
        console.log("✓ Análisis completado exitosamente");
        return result;

    } catch (error: any) {
        console.error("Error al analizar la imagen:", error.message);
        return {
            category: 'Desconocido',
            color: 'Desconocido',
            style: 'Casual',
            season: 'Verano/Primavera',
            pattern: 'Other',
        };
    }
};
