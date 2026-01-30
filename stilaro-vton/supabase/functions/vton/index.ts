import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase client para verificar uso
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ========================================
// SIZING ANALYSIS FUNCTION
// ========================================
async function handleSizingAnalysis(body: any): Promise<Response> {
  const { userPhoto, height, fit_preference, reference_brand, reference_size, productType, shopDomain, visitorId } = body;

  if (!userPhoto) {
    return new Response(
      JSON.stringify({ error: 'Se requiere una foto del usuario' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({ error: 'Configuración del servidor incompleta' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Limpiar base64
    const cleanBase64 = (str: string) => str.replace(/^data:image\/\w+;base64,/, '');
    const userPhotoBase64 = cleanBase64(userPhoto);

    // Prompt para análisis de tallas
    const prompt = `Analyze this full-body photo and provide sizing recommendations. Return ONLY a valid JSON object with no additional text or markdown.

Analyze the person's body type and proportions to help determine clothing size.

Return this exact JSON structure:
{
  "body_type": "delgado|atletico|medio|robusto|corpulento",
  "shoulder_width": "estrecho|medio|ancho",
  "torso_length": "corto|medio|largo",
  "build_notes": "Brief observation about build in Spanish (max 30 words)",
  "fit_adjustment": number between -1 and 1,
  "confidence": number between 0 and 1
}

Guidelines for fit_adjustment:
- -1 to -0.5: Person appears to need a smaller size than average
- -0.5 to 0: Slightly smaller or standard
- 0: Standard/average build
- 0 to 0.5: Slightly larger or standard
- 0.5 to 1: Person appears to need a larger size than average

Guidelines for confidence:
- 0.9-1.0: Clear full-body photo with good lighting
- 0.7-0.9: Good photo but some uncertainty
- 0.5-0.7: Partial view or unclear proportions
- 0.3-0.5: Limited visibility, low confidence estimate

${height ? `User's height: ${height}cm - factor this into your analysis.` : ''}
${productType ? `Product type: ${productType} - consider fit requirements for this garment type.` : ''}

IMPORTANT: Return ONLY the JSON object, no explanation or markdown formatting.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: userPhotoBase64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500
      }
    };

    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    console.log('[SIZING] Analyzing with Gemini...');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[SIZING] Gemini error:', JSON.stringify(data));
      throw new Error(`API error: ${data.error?.message || response.status}`);
    }

    // Extraer texto de respuesta
    const textPart = data.candidates?.[0]?.content?.parts?.find(
      (part: any) => part.text
    );

    if (!textPart?.text) {
      console.error('[SIZING] No text response from Gemini');
      throw new Error('No analysis received');
    }

    // Parsear JSON de la respuesta
    let analysis;
    try {
      // Limpiar posibles markdown code blocks
      let jsonStr = textPart.text.trim();
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[SIZING] Failed to parse response:', textPart.text);
      // Fallback con valores por defecto
      analysis = {
        body_type: 'medio',
        shoulder_width: 'medio',
        torso_length: 'medio',
        build_notes: 'No se pudo analizar la imagen con precisión',
        fit_adjustment: 0,
        confidence: 0.4
      };
    }

    console.log('[SIZING] Analysis result:', JSON.stringify(analysis));

    // Calcular talla recomendada
    const SIZE_SCALE = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
    const BRAND_OFFSETS: Record<string, number> = {
      'zara': 0,
      'hm': 0,
      'mango': 0,
      'pull_bear': 0,
      'bershka': 0,
      'massimo_dutti': 0.5,
      'uniqlo': -0.5,
      'nike': -0.5,
      'adidas': -0.5,
      'other': 0
    };

    const brandOffset = BRAND_OFFSETS[reference_brand] || 0;
    const fitOffset = fit_preference === 'ajustado' ? -0.5 :
                      fit_preference === 'holgado' ? 0.5 : 0;
    const aiOffset = analysis.fit_adjustment || 0;

    let heightOffset = 0;
    if (height) {
      if (height < 165) heightOffset = -0.5;
      else if (height > 185) heightOffset = 0.5;
    }

    const totalOffset = brandOffset + fitOffset + aiOffset + heightOffset;
    const currentIndex = SIZE_SCALE.indexOf(reference_size || 'M');
    let recommendedIndex = Math.round(currentIndex + totalOffset);
    recommendedIndex = Math.max(0, Math.min(SIZE_SCALE.length - 1, recommendedIndex));

    const recommendedSize = SIZE_SCALE[recommendedIndex];

    // Talla alternativa
    let altIndex = totalOffset > 0 ? recommendedIndex + 1 : recommendedIndex - 1;
    altIndex = Math.max(0, Math.min(SIZE_SCALE.length - 1, altIndex));
    const altSize = SIZE_SCALE[altIndex];

    return new Response(
      JSON.stringify({
        analysis,
        recommendedSize,
        altSize,
        confidence: analysis.confidence,
        offsets: {
          brand: brandOffset,
          fit: fitOffset,
          ai: aiOffset,
          height: heightOffset,
          total: totalOffset
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[SIZING] Error:', errorMessage);

    // Devolver resultado fallback
    return new Response(
      JSON.stringify({
        analysis: {
          body_type: 'medio',
          shoulder_width: 'medio',
          torso_length: 'medio',
          build_notes: 'Análisis con datos limitados',
          fit_adjustment: 0,
          confidence: 0.5
        },
        recommendedSize: reference_size || 'M',
        altSize: reference_size || 'M',
        confidence: 0.5,
        fallback: true
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, userPhoto, productId, productImage, productImages, outfitMode, shopDomain, visitorId } = body;

    // ========================================
    // ANALISIS DE TALLAS
    // ========================================
    if (action === 'analyze_sizing') {
      return await handleSizingAnalysis(body);
    }

    // productImages es un array de URLs para outfit mode
    // productImage es para compatibilidad con el modo single
    const garmentImages = productImages && productImages.length > 0 ? productImages : [productImage];

    if (!userPhoto || garmentImages.length === 0 || !garmentImages[0]) {
      throw new Error('Faltan imagenes (userPhoto o productImage/productImages)');
    }

    const isOutfitMode = outfitMode === true || garmentImages.length > 1;
    console.log(`[VTON] Modo: ${isOutfitMode ? 'OUTFIT (' + garmentImages.length + ' prendas)' : 'SINGLE'}`);

    if (!shopDomain) {
      throw new Error('Falta shopDomain');
    }

    if (!visitorId) {
      throw new Error('Falta visitorId');
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Falta configuracion del servidor (GEMINI_API_KEY)');
    }

    console.log(`[VTON] Procesando request - Shop: ${shopDomain}, Visitor: ${visitorId}, Product: ${productId}`);

    // ========================================
    // PASO 1: Verificar uso con Supabase
    // ========================================
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: usageResult, error: usageError } = await supabase.rpc('check_and_record_usage', {
      p_shop_domain: shopDomain,
      p_visitor_id: visitorId,
      p_product_id: productId || null,
      p_product_title: null
    });

    if (usageError) {
      console.error('[VTON] Error verificando uso:', usageError);
      throw new Error('Error al verificar el uso disponible');
    }

    console.log('[VTON] Resultado verificacion uso:', JSON.stringify(usageResult));

    // Verificar si esta permitido
    if (!usageResult.allowed) {
      const errorResponse = {
        error: usageResult.message,
        code: usageResult.reason,
        uses_today: usageResult.uses_today,
        max_daily: usageResult.max_daily
      };

      console.log('[VTON] Uso denegado:', errorResponse);

      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const usageLogId = usageResult.usage_log_id;
    console.log(`[VTON] Uso permitido. Log ID: ${usageLogId}, Extra charge: ${usageResult.is_extra_charge}`);

    // ========================================
    // PASO 2: Generar imagen con Imagen 3
    // ========================================

    // Helper para limpiar base64
    const cleanBase64 = (str: string) => str.replace(/^data:image\/\w+;base64,/, '');

    // Helper para descargar imagen desde URL y convertir a base64
    const urlToBase64 = async (url: string): Promise<string> => {
      let normalizedUrl = url;

      // Manejar diferentes formatos de URL
      if (url.startsWith('//')) {
        normalizedUrl = `https:${url}`;
      } else if (url.startsWith('/cdn/') || url.startsWith('/s/') || url.startsWith('/')) {
        // URL relativa de Shopify - construir URL completa
        normalizedUrl = `https://${shopDomain}${url}`;
      }

      console.log(`[VTON] Descargando imagen desde: ${normalizedUrl}`);

      const imageResponse = await fetch(normalizedUrl);
      if (!imageResponse.ok) {
        throw new Error(`No se pudo descargar la imagen del producto: ${imageResponse.status}`);
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      console.log(`[VTON] Imagen descargada: ${arrayBuffer.byteLength} bytes`);
      const base64 = base64Encode(new Uint8Array(arrayBuffer));
      return base64;
    };

    // Procesar todas las imágenes de prendas
    const processedGarments: string[] = [];
    for (let i = 0; i < garmentImages.length; i++) {
      const img = garmentImages[i];
      let base64: string;

      if (img.startsWith('http') || img.startsWith('//') || img.startsWith('/')) {
        base64 = await urlToBase64(img);
      } else {
        base64 = cleanBase64(img);
      }

      processedGarments.push(base64);
      console.log(`[VTON] Prenda ${i + 1} base64 length: ${base64.length}`);
    }

    // userPhoto siempre deberia ser base64
    const userPhotoBase64 = cleanBase64(userPhoto);

    console.log(`[VTON] userPhoto base64 length: ${userPhotoBase64.length}`);
    console.log(`[VTON] Total prendas procesadas: ${processedGarments.length}`);

    // ========================================
    // Usar Gemini 3 Pro Image (modelo de produccion)
    // ========================================
    const model = 'gemini-3-pro-image-preview';

    // Prompt diferente según si es una prenda o outfit completo
    let prompt: string;

    if (isOutfitMode && processedGarments.length > 1) {
      // Prompt para outfit completo (múltiples prendas)
      prompt = `Take the first reference photo as the EXACT BASE IMAGE. Your task is to dress the person with the ${processedGarments.length} clothing items shown in the following images.

ABSOLUTE REQUIREMENTS - DO NOT CHANGE:
- Keep the EXACT same photo: same pose, same angle, same background, same lighting, same shadows
- Keep the EXACT same person: same face, same expression, same body position, same hands position
- The output must look like the ORIGINAL PHOTO with different clothes - not a new photo

CLOTHING INSERTION:
- Overlay ALL ${processedGarments.length} garments onto the person in their current pose
- Layer appropriately: outerwear over tops, bottoms on legs, shoes on feet
- Adapt each garment's shape to match the person's exact body position and pose
- Realistic fabric draping that follows the existing pose and body angles

The final image must be indistinguishable from the original photo except for the clothing. Same background, same pose, same everything - only the clothes change.`;
    } else {
      // Prompt original para una sola prenda
      prompt = `Take the reference photo as the EXACT BASE IMAGE. Your task is to dress the person with the clothing item shown in the second image.

ABSOLUTE REQUIREMENTS - DO NOT CHANGE:
- Keep the EXACT same photo: same pose, same angle, same background, same lighting, same shadows
- Keep the EXACT same person: same face, same expression, same body position, same hands position
- The output must look like the ORIGINAL PHOTO with different clothes - not a new photo

CLOTHING INSERTION:
- Overlay the garment onto the person in their current pose
- Adapt the garment's shape to match the person's exact body position and pose
- Realistic fabric draping that follows the existing pose and body angles

The final image must be indistinguishable from the original photo except for the clothing. Same background, same pose, same everything - only the clothes change.`;
    }

    // Construir parts con todas las imágenes
    const parts: any[] = [
      { text: prompt },
      {
        inline_data: {
          mime_type: "image/jpeg",
          data: userPhotoBase64
        }
      }
    ];

    // Agregar cada prenda como imagen separada
    for (const garmentBase64 of processedGarments) {
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: garmentBase64
        }
      });
    }

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        temperature: 0.4,
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    console.log(`[VTON] Llamando a ${model}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log(`[VTON] Response status: ${response.status}`);

    const data = await response.json();

    if (!response.ok) {
      console.error(`[VTON] Modelo ${model} fallo con status ${response.status}`);
      console.error(`[VTON] Error completo:`, JSON.stringify(data, null, 2));

      // Marcar el uso como fallido
      await supabase
        .from('shop_usage_logs')
        .update({ generation_success: false, error_message: data.error?.message || 'API error' })
        .eq('id', usageLogId);

      throw new Error(`Error de API: ${data.error?.message || response.status}`);
    }

    console.log(`[VTON] Respuesta exitosa con ${model}`);
    console.log(`[VTON] Response data:`, JSON.stringify(data, null, 2));

    // Extraer imagen
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (part: any) =>
        part.inline_data?.mime_type?.startsWith('image/') ||
        part.inlineData?.mimeType?.startsWith('image/')
    );

    if (!imagePart) {
      console.warn(`[VTON] ${model} no genero imagen`);
      console.warn(`[VTON] Candidates:`, JSON.stringify(data.candidates, null, 2));

      // Marcar el uso como fallido
      await supabase
        .from('shop_usage_logs')
        .update({ generation_success: false, error_message: 'No image generated' })
        .eq('id', usageLogId);

      throw new Error('No se genero una imagen');
    }

    // Extraer data
    const base64Image = imagePart.inline_data?.data || imagePart.inlineData?.data;
    const mimeType = imagePart.inline_data?.mime_type || imagePart.inlineData?.mimeType;

    if (!base64Image) {
      console.warn(`[VTON] ${model} no tiene data de imagen`);
      throw new Error('No se pudo extraer la imagen generada');
    }

    // ========================================
    // PASO 3: Marcar uso como exitoso
    // ========================================
    await supabase
      .from('shop_usage_logs')
      .update({ generation_success: true })
      .eq('id', usageLogId);

    console.log(`[VTON] Imagen generada exitosamente!`);

    return new Response(
      JSON.stringify({
        resultImage: `data:${mimeType};base64,${base64Image}`,
        usage: {
          uses_this_cycle: usageResult.uses_this_cycle,
          included_uses: usageResult.included_uses,
          visitor_uses_today: usageResult.visitor_uses_today,
          is_extra_charge: usageResult.is_extra_charge
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error("[VTON ServerError]", errorMessage);
    if (error instanceof Error && error.stack) {
      console.error("[VTON Stack]", error.stack);
    }
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
