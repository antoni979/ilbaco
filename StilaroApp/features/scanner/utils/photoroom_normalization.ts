// Replicate Background Removal Service
// Normalizes clothing photos by removing background using Replicate API
// Price: Very cheap (~$0.001-0.002 per image)

/**
 * Removes background from clothing image using Replicate API
 * Uses 851-labs/background-remover model with WHITE background output
 * Replaces background with pure white for professional product photo look
 *
 * @param imageBase64 - Base64 encoded image (without data URI prefix)
 * @returns Base64 string of image with white background, or null if failed
 */
export const removeBackgroundPhotoRoom = async (
    imageBase64: string
): Promise<string | null> => {
    const apiToken = process.env.EXPO_PUBLIC_REPLICATE_API_TOKEN;

    if (!apiToken) {
        console.error("[Replicate] Missing EXPO_PUBLIC_REPLICATE_API_TOKEN");
        return null;
    }

    try {
        console.log("[Replicate] Starting background removal...");

        // Clean base64 if it has data URI prefix
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        // Create data URI for Replicate
        const dataUri = `data:image/jpeg;base64,${cleanBase64}`;

        // Call Replicate API
        // Using 851-labs/background-remover model with WHITE background
        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait', // Wait for result instead of polling
            },
            body: JSON.stringify({
                version: 'a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc',
                input: {
                    image: dataUri,
                    background_type: 'white', // ← FONDO BLANCO!
                    format: 'png',
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Replicate] API error (${response.status}):`, errorText);
            return null;
        }

        const prediction = await response.json();

        // Check if prediction succeeded
        if (prediction.status === 'failed') {
            console.error('[Replicate] Prediction failed:', prediction.error);
            return null;
        }

        // Get output image URL
        const outputUrl = prediction.output;

        if (!outputUrl) {
            console.error('[Replicate] No output URL received');
            return null;
        }

        // Download the result image with white background
        console.log('[Replicate] Downloading processed image...');
        const imageResponse = await fetch(outputUrl);
        const blob = await imageResponse.blob();

        // Convert blob to base64
        const base64Result = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        console.log('[Replicate] ✓ Background removed with WHITE background!');
        return base64Result;

    } catch (error: any) {
        console.error('[Replicate] Error:', error.message);
        return null;
    }
};
