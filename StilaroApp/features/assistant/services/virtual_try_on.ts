// Virtual Try-On Service using Google Gemini 2.5 Flash Image
// Optimizado para mantener la identidad del usuario y aplicar outfit completo

// Helper: limpiar base64 de prefijos data URI
function cleanBase64(base64String: string): string {
    return base64String.replace(/^data:image\/\w+;base64,/, '');
}

export const generateVirtualTryOn = async (
    userPhotoBase64: string,
    topBase64: string,
    bottomBase64: string,
    shoesBase64?: string,
    outerwearBase64?: string
): Promise<string | null> => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
        console.error("Missing EXPO_PUBLIC_GEMINI_API_KEY");
        alert("Falta configurar la API KEY de Google Gemini.");
        return null;
    }

    // Gemini 3 Pro Image - Único que funciona PERFECTO para virtual try-on
    const modelsToTry = [
        'gemini-3-pro-image-preview',   // Nano Banana Pro - PERFECTO ($0.134 por imagen)
        'gemini-2.0-flash-exp'          // Fallback de emergencia
    ];

    try {
        console.log("[Gemini VTON] Iniciando generación de probador virtual...");

        // Construir prompt OPTIMIZADO para EDITAR la foto (no generar nueva)
        let promptParts = [
            `EDITA la primera imagen (la foto de la persona) para que lleve puesta la ropa mostrada en las siguientes imágenes.`,
            ``,
            `CRITICAL: This is a PHOTO EDITING task, NOT image generation. You must KEEP the exact same person from image 1.`,
            ``,
            `Image 1: THE PERSON - Use this EXACT person, face, and body. DO NOT change the person's identity.`,
            `Image 2: Top garment - Replace the person's current top with this garment`,
            `Image 3: Bottom garment - Replace the person's current bottom with this garment`
        ];

        let imageCount = 3;
        if (shoesBase64) {
            imageCount++;
            promptParts.push(`La imagen ${imageCount} es el calzado que debe llevar puesto.`);
        }
        if (outerwearBase64) {
            imageCount++;
            promptParts.push(`La imagen ${imageCount} es el abrigo/chaqueta que debe llevar puesto sobre las demás prendas.`);
        }

        promptParts.push(`
PHOTO EDITING INSTRUCTIONS (NOT generation):
1. SOURCE: Use the EXACT person from Image 1
   - SAME face (every facial feature must match exactly)
   - SAME body type and proportions
   - SAME skin tone
   - SAME pose and position
   - SAME background
   - Keep everything about Image 1's person IDENTICAL

2. ONLY CHANGE: Replace the clothing with the garments shown
   - Image 2 (top): Place this garment on the person's upper body
   - Image 3 (bottom): Place this garment on the person's lower body
   ${shoesBase64 ? '- Image ' + (3 + (shoesBase64 ? 1 : 0)) + ' (shoes): Place these shoes on the person\'s feet' : ''}
   ${outerwearBase64 ? '- Image ' + (3 + (shoesBase64 ? 1 : 0) + (outerwearBase64 ? 1 : 0)) + ' (outerwear): Layer this over the top garment' : ''}

3. CRITICAL RULES:
   - You are EDITING the photo, not creating a new person
   - The person's identity MUST remain 100% identical to Image 1
   - Only the clothes should change, nothing else
   - Full body must be visible (head to feet)
   - Maintain realistic fit and draping of garments
   - Keep original lighting and background

AGAIN: Take the person from Image 1 and ONLY change their clothes. Do NOT generate a different person.`);

        const prompt = promptParts.join('\n');

        // Construir partes de la request con imágenes
        const parts: any[] = [
            { text: prompt },
            {
                inline_data: {
                    mime_type: "image/jpeg",
                    data: cleanBase64(userPhotoBase64)
                }
            },
            {
                inline_data: {
                    mime_type: "image/jpeg",
                    data: cleanBase64(topBase64)
                }
            },
            {
                inline_data: {
                    mime_type: "image/jpeg",
                    data: cleanBase64(bottomBase64)
                }
            }
        ];

        // Añadir shoes si están disponibles
        if (shoesBase64) {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: cleanBase64(shoesBase64)
                }
            });
        }

        // Añadir outerwear si está disponible
        if (outerwearBase64) {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: cleanBase64(outerwearBase64)
                }
            });
        }

        console.log(`[Gemini VTON] Procesando outfit: Top ✓, Bottom ✓${shoesBase64 ? ', Shoes ✓' : ''}${outerwearBase64 ? ', Outerwear ✓' : ''}`);

        // VERIFICAR que las imágenes se están enviando
        console.log(`[Gemini VTON] 📸 Verificando imágenes:`);
        console.log(`[Gemini VTON]   - Foto usuario: ${userPhotoBase64 ? '✓ ' + userPhotoBase64.substring(0, 50) + '...' : '❌ FALTA'}`);
        console.log(`[Gemini VTON]   - Top: ${topBase64 ? '✓' : '❌'}`);
        console.log(`[Gemini VTON]   - Bottom: ${bottomBase64 ? '✓' : '❌'}`);
        console.log(`[Gemini VTON]   - Shoes: ${shoesBase64 ? '✓' : '⏭️ No incluido'}`);
        console.log(`[Gemini VTON]   - Outerwear: ${outerwearBase64 ? '✓' : '⏭️ No incluido'}`);
        console.log(`[Gemini VTON]   - Total imágenes a enviar: ${parts.length - 1}`); // -1 porque la primera parte es el prompt

        // Construir request body según documentación de Gemini API
        const requestBody = {
            contents: [{
                parts
            }],
            generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],  // Permite texto e imagen
                temperature: 0.3,  // Baja temperatura para más precisión en mantener identidad
            }
        };

        // Intentar con cada modelo hasta que uno funcione
        for (const model of modelsToTry) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

                console.log(`[Gemini VTON] Intentando con modelo: ${model}`);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                const data = await response.json();

                if (!response.ok) {
                    console.warn(`[Gemini VTON] Modelo ${model} falló:`, data.error?.message);
                    continue; // Intentar siguiente modelo
                }

                console.log(`[Gemini VTON] ✓ Respuesta exitosa con ${model}, extrayendo imagen...`);

                // Extraer imagen generada de la respuesta
                // Probar ambas variantes: inline_data (snake_case) e inlineData (camelCase)
                const imagePart = data.candidates?.[0]?.content?.parts?.find(
                    (part: any) =>
                        part.inline_data?.mime_type?.startsWith('image/') ||
                        part.inlineData?.mimeType?.startsWith('image/')
                );

                if (!imagePart) {
                    console.warn(`[Gemini VTON] ${model} no generó imagen. Parts:`, data.candidates?.[0]?.content?.parts);
                    continue;
                }

                // Extraer data en ambos formatos posibles
                const base64Image = imagePart.inline_data?.data || imagePart.inlineData?.data;
                const mimeType = imagePart.inline_data?.mime_type || imagePart.inlineData?.mimeType;

                if (!base64Image) {
                    console.warn(`[Gemini VTON] ${model} no tiene data de imagen`);
                    continue;
                }

                console.log(`[Gemini VTON] ✓ Imagen generada exitosamente con ${model}!`);
                return `data:${mimeType};base64,${base64Image}`;

            } catch (modelError: any) {
                console.warn(`[Gemini VTON] Error con ${model}:`, modelError.message);
                continue; // Intentar siguiente modelo
            }
        }

        // Si ningún modelo funcionó
        throw new Error("Ningún modelo de Gemini pudo generar la imagen. Verifica tu API key o límites de uso.");

    } catch (error: any) {
        console.error("[Gemini VTON] Error global:", error);
        alert(`Error al generar probador virtual: ${error.message}`);
        return null;
    }
};
