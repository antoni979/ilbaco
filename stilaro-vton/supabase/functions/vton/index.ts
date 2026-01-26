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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userPhoto, productId, productImage, shopDomain, visitorId } = await req.json();

    if (!userPhoto || !productImage) {
      throw new Error('Faltan imagenes (userPhoto o productImage)');
    }

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

    // Procesar productImage: si es URL, descargar; si es base64, limpiar
    let productImageBase64: string;
    if (productImage.startsWith('http') || productImage.startsWith('//') || productImage.startsWith('/')) {
      productImageBase64 = await urlToBase64(productImage);
    } else {
      productImageBase64 = cleanBase64(productImage);
    }

    // userPhoto siempre deberia ser base64
    const userPhotoBase64 = cleanBase64(userPhoto);

    console.log(`[VTON] userPhoto base64 length: ${userPhotoBase64.length}`);
    console.log(`[VTON] productImage base64 length: ${productImageBase64.length}`);

    // ========================================
    // Usar Gemini 2.5 Flash Image (modelo de produccion)
    // ========================================
    const model = 'gemini-3-pro-image-preview';

    // Prompt para el probador virtual
    const prompt = `Generate a photorealistic image of the EXACT same person from the reference photo wearing the clothing item shown.

CRITICAL REQUIREMENTS:
- Keep the EXACT same person: same face, same body type, same skin tone, same hair
- The person must be wearing the garment/clothing shown in the second reference
- Full body visible, natural pose
- Professional fashion photography style
- Realistic fabric draping and fit
- Clean background

The person in the output must be identical to the person in the reference - only their clothing changes.`;

    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: userPhotoBase64
            }
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: productImageBase64
            }
          }
        ]
      }],
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
