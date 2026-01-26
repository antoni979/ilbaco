/**
 * Script de sincronización Shopify → Supabase
 *
 * Uso: node scripts/sync_shopify.js
 *
 * Requiere variables de entorno:
 * - SHOPIFY_STORE_URL (ej: prueba-stilaro.myshopify.com)
 * - SHOPIFY_ACCESS_TOKEN (Admin API token)
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_KEY (service role key para bypass RLS)
 */

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL || 'prueba-stilaro.myshopify.com';
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SHOPIFY_TOKEN) {
  console.error('ERROR: SHOPIFY_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

async function fetchShopifyProducts() {
  console.log('📦 Obteniendo productos de Shopify...');

  const response = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250`,
    {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`   Encontrados ${data.products.length} productos`);
  return data.products;
}

function transformProduct(product) {
  // Obtener precio del primer variante
  const firstVariant = product.variants?.[0];
  const price = firstVariant?.price ? parseFloat(firstVariant.price) : null;
  const compareAtPrice = firstVariant?.compare_at_price ? parseFloat(firstVariant.compare_at_price) : null;

  // Obtener URLs de imágenes
  const imageUrl = product.image?.src || product.images?.[0]?.src || null;
  const images = product.images?.map(img => img.src) || [];

  // Parsear tags
  const tags = product.tags ? product.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    vendor: product.vendor,
    product_type: product.product_type || null,
    tags: tags,
    price: price,
    compare_at_price: compareAtPrice,
    image_url: imageUrl,
    images: images,
    status: product.status || 'active',
    body_html: product.body_html || null,
    synced_at: new Date().toISOString()
  };
}

async function upsertToSupabase(products) {
  console.log('💾 Sincronizando con Supabase...');

  const transformed = products.map(transformProduct);

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shopify_products`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'  // Upsert
      },
      body: JSON.stringify(transformed)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${error}`);
  }

  console.log(`   ✅ ${transformed.length} productos sincronizados`);
  return transformed;
}

async function main() {
  console.log('\n🔄 SINCRONIZACIÓN SHOPIFY → SUPABASE\n');
  console.log(`   Tienda: ${SHOPIFY_STORE}`);
  console.log(`   Supabase: ${SUPABASE_URL}\n`);

  try {
    const products = await fetchShopifyProducts();
    const synced = await upsertToSupabase(products);

    // Resumen
    console.log('\n📊 RESUMEN:');
    console.log(`   Total productos: ${synced.length}`);

    const byStatus = {};
    const byVendor = {};
    synced.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      if (p.vendor) byVendor[p.vendor] = (byVendor[p.vendor] || 0) + 1;
    });

    console.log('\n   Por estado:');
    Object.entries(byStatus).forEach(([k, v]) => console.log(`     - ${k}: ${v}`));

    console.log('\n   Por marca:');
    Object.entries(byVendor).slice(0, 5).forEach(([k, v]) => console.log(`     - ${k}: ${v}`));

    console.log('\n✅ Sincronización completada!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
