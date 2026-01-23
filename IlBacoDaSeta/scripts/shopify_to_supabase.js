/**
 * Script para convertir productos de Shopify al formato de Supabase para Il Baco Da Seta
 *
 * USO:
 * 1. Ejecuta: node scripts/shopify_to_supabase.js
 * 2. Se generará el archivo: scripts/items_para_supabase.csv
 * 3. Importa el CSV en Supabase: Table Editor > items > Import data from CSV
 */

const fs = require('fs');
const path = require('path');

// Mapeo de tags de Shopify a categorías de la app
const CATEGORY_MAP = {
  'pantalones y vaqueros de mujer': 'Pantalón',
  'chaquetas y americanas de mujer': 'Chaqueta',
  'abrigos y gabardinas de mujer': 'Abrigo',
  'plumíferos de mujer': 'Abrigo',
  'punto y jersey de mujer': 'Jersey',
  'camisetas y tops de mujer': 'Top',
  'vestidos de mujer': 'Vestido',
  'faldas de mujer': 'Falda',
  'blusas y camisas de mujer': 'Blusa',
  'bolsos y accesorios': 'Accesorios',
  'calzado': 'Calzado',
  'bolso': 'Accesorios',
};

// Mapeo de temporadas
const SEASON_MAP = {
  'otoño/invierno': 'Invierno/Otoño',
  'primavera/verano': 'Verano/Primavera',
};

// Productos obtenidos de Shopify (nueva colección + all)
const SHOPIFY_PRODUCTS = [
  {
    id: 15382969024837,
    title: "Jeans Cambio Tess Jogg",
    vendor: "Pantalones Cambio",
    tags: ["Otoño/Invierno 25", "Pantalones y vaqueros de mujer"],
    variants: [{ price: "136.50", option1: "Azul" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/D26ACA34-FAD9-4287-80A7-619F7AFF376A.jpg" }]
  },
  {
    id: 15386520748357,
    title: "Chaqueta VLab Punto y Pluma",
    vendor: "VLAB",
    tags: ["Chaquetas y americanas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "227.50", option1: "Rojo" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/BA925F62-8B2D-4662-98A5-7958167DC34E.jpg" }]
  },
  {
    id: 15253653750085,
    title: "Chaqueton Harris Wharf London Forro Escoses Azul Noche",
    vendor: "Abrigos Harris Wharf London",
    tags: ["Abrigos y gabardinas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "675.00", option1: "Azul Noche" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/1168ADE7-D289-490C-9493-2A651853DA48.jpg" }]
  },
  {
    id: 15257820430661,
    title: "Jersey Floor Rombos",
    vendor: "FLOOR",
    tags: ["Otoño/Invierno 25", "Punto y jersey de mujer"],
    variants: [{ price: "105.00", option1: "Verde" }, { price: "105.00", option1: "Rojo" }],
    images: [
      { src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/198E6F0F-6B8E-46F7-9D91-583597EC5007.jpg" },
      { src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/C1D78C8A-9DF8-4348-9E30-93EA6EC48E9B.jpg" }
    ]
  },
  {
    id: 15386514719045,
    title: "Abrigo VLab Cuadros Largo",
    vendor: "VLAB",
    tags: ["Abrigos y gabardinas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "250.00", option1: "Verde" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/F27BD893-3D1D-4FED-93A0-E9D9EF1A0350.jpg" }]
  },
  {
    id: 15386518257989,
    title: "Chaqueta VLab Cuadros",
    vendor: "VLAB",
    tags: ["Chaquetas y americanas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "215.00", option1: "Verde" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/CA1CDABE-936B-4E38-BAF2-42F38736DA0E.jpg" }]
  },
  {
    id: 15176527085893,
    title: "Jeans Cigala's Baggy Fatigue Azul Oscuro",
    vendor: "CIGALA'S",
    tags: ["Otoño/Invierno 25", "Pantalones y vaqueros de mujer"],
    variants: [{ price: "124.20", option1: "Azul Oscuro" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_27_10.jpg" }]
  },
  {
    id: 15253613281605,
    title: "Abrigo Capa Harris Wharf London Recto Rojo",
    vendor: "Abrigos Harris Wharf London",
    tags: ["Abrigos y gabardinas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "445.50", option1: "Rojo" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/E428FEC7-5CFA-4C2D-A435-142CD0C01A00.jpg" }]
  },
  {
    id: 15272708964677,
    title: "Camiseta Whyci Milano Cuadrito Punto Y Seda",
    vendor: "whyci milano",
    tags: ["Camisetas y tops de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "144.00", option1: "Rojo" }, { price: "144.00", option1: "Azul marino" }],
    images: [
      { src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/82969D49-48BB-4985-AC3C-68FBE0F552C0.jpg" },
      { src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/188D153E-A178-49FF-B442-2998DC699877.jpg" }
    ]
  },
  {
    id: 15321653870917,
    title: "Pantalon Majestic Filatures Terciopelo",
    vendor: "Camisetas Majestic Filatures",
    tags: ["Otoño/Invierno 25", "Pantalones y vaqueros de mujer"],
    variants: [{ price: "105.00", option1: "VINO" }, { price: "105.00", option1: "Beige" }],
    images: [
      { src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/65B2F761-CDFC-468E-A119-4B59A628CEBA.jpg" },
      { src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/59D9CB90-36D2-493A-8AD7-5446D72715F2.jpg" }
    ]
  },
  {
    id: 15321693716805,
    title: "Blazer Majestic Filatures Terciopelo",
    vendor: "Camisetas Majestic Filatures",
    tags: ["Chaquetas y americanas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "119.00", option1: "VINO" }, { price: "119.00", option1: "Beige" }],
    images: [
      { src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/C1A8266C-4F3D-4326-B97A-4BA07400AABB.jpg" },
      { src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/140ADD19-DC7B-45EC-80EE-484AAC642069.jpg" }
    ]
  },
  {
    id: 15209870164293,
    title: "Jersey Shirt C-Zero De Rayas",
    vendor: "Shirt C-Zero",
    tags: ["Otoño/Invierno 25", "Punto y jersey de mujer"],
    variants: [{ price: "164.50", option1: "BURDEOS" }, { price: "164.50", option1: "Negro" }],
    images: [
      { src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/46EB951F-0E40-4A6E-B909-3317B0728F0A.jpg" },
      { src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/F83F84B1-293B-4EC8-885C-9DE308F10332.jpg" }
    ]
  },
  {
    id: 15176388346181,
    title: "Jeans Cigala's Bell Bottom Negro",
    vendor: "CIGALA'S",
    tags: ["Otoño/Invierno 25", "Pantalones y vaqueros de mujer"],
    variants: [{ price: "131.40", option1: "Negro" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_14_17.jpg" }]
  },
  {
    id: 15253196931397,
    title: "Abrigo Harris Wharf London Pressed Verde",
    vendor: "Abrigos Harris Wharf London",
    tags: ["Abrigos y gabardinas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "502.20", option1: "Verde" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/77D8AE6A-4123-4C19-81CC-3363BEDFF766.jpg" }]
  },
  {
    id: 15209736307013,
    title: "Jersey Shirt C-Zero Con Cuello Seda Campana",
    vendor: "Shirt C-Zero",
    tags: ["Otoño/Invierno 25", "Punto y jersey de mujer"],
    variants: [{ price: "199.50", option1: "Marrón" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/35C9DCCB-F50A-4F20-9DD4-4F2AB85C7938.jpg" }]
  },
  // Productos adicionales de /collections/all
  {
    id: 15174951764293,
    title: "Abanico The Viana Fan Pezenas",
    vendor: "the viana fan",
    tags: ["Bolsos y accesorios"],
    variants: [{ price: "69.00", option1: "Natural" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_1_69.jpg" }]
  },
  {
    id: 15174906675525,
    title: "Abanico The Viana Fan Portofino",
    vendor: "the viana fan",
    tags: ["Bolsos y accesorios"],
    variants: [{ price: "69.00", option1: "Azul" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_3_60.jpg" }]
  },
  {
    id: 15174935019845,
    title: "Abanico The Viana Fan Positano",
    vendor: "the viana fan",
    tags: ["Bolsos y accesorios"],
    variants: [{ price: "69.00", option1: "Rosa" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_1_65.jpg" }]
  },
  {
    id: 14977321697605,
    title: "Abanico The Viana Fan Samana",
    vendor: "the viana fan",
    tags: ["Bolsos y accesorios"],
    variants: [{ price: "69.00", option1: "Verde Lima" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/image_9.png" }]
  },
  {
    id: 15255350739269,
    title: "Abrigo Diega Terciopelo",
    vendor: "DIEGA",
    tags: ["Abrigos y gabardinas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "295.00", option1: "Azul" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/9DF66DD3-3E00-4DCE-B99E-D58CA745571F.jpg" }]
  },
  {
    id: 15197706060101,
    title: "Abrigo Ecoalf Marins Piedra",
    vendor: "ECOALF",
    tags: ["Otoño/Invierno 25", "Plumíferos de mujer"],
    variants: [{ price: "199.92", option1: "Piedra" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/86BC356C-0FFD-4C93-AAA0-9821F93411BE.jpg" }]
  },
  {
    id: 15297656127813,
    title: "Abrigo Goodmatch Cuadros Beige",
    vendor: "GOODMATCH",
    tags: ["Abrigos y gabardinas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "223.50", option1: "Beige" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/1A74E9FD-7324-40A8-9819-32C7EAE16CC0.jpg" }]
  },
  {
    id: 8805259379013,
    title: "Abrigo Harris Largo Abertura",
    vendor: "Abrigos Harris Wharf London",
    tags: ["Abrigos y gabardinas de mujer"],
    variants: [{ price: "421.20", option1: "Beige" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/ABRIGO_HARRIS_2.jpg" }]
  },
  {
    id: 8722309939525,
    title: "Abrigo Harris Wharf London Dos Botones Crema",
    vendor: "Abrigos Harris Wharf London",
    tags: ["Abrigos y gabardinas de mujer"],
    variants: [{ price: "594.00", option1: "Crema" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/Abrigo_Harris_Wharf_London_Dos_Botones_crema_8105119e-0b8a-48ae-92e6-2fdd42ba4767.jpg" }]
  },
  {
    id: 9664049217861,
    title: "Abrigo Harris Wharf London Over Boiled Wool Beige",
    vendor: "Abrigos Harris Wharf London",
    tags: ["Chaquetas y americanas de mujer"],
    variants: [{ price: "544.50", option1: "Beige" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/IMG_2441_1_f85cefe2-3982-452d-b339-9d150dcac867.jpg" }]
  },
  {
    id: 15253195096389,
    title: "Abrigo Harris Wharf London Pressed Rojo",
    vendor: "Abrigos Harris Wharf London",
    tags: ["Abrigos y gabardinas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "502.20", option1: "Rojo" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/E808A3EE-A45A-460C-BED4-51379FF0324D.jpg" }]
  },
  {
    id: 15288752701765,
    title: "Abrigo Sunny Studio Largo",
    vendor: "SUNNY STUDIO.",
    tags: ["Abrigos y gabardinas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "177.50", option1: "CAMEL" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/60B87011-2224-4EAE-B34D-9D1098E74755.jpg" }]
  },
  {
    id: 15029634564421,
    title: "Bailarina Le Capresi Pulsera Piedras Oro",
    vendor: "LE CAPRESI",
    tags: ["Calzado"],
    variants: [{ price: "215.00", option1: "Dorado" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_4_23.jpg" }]
  },
  {
    id: 15321652691269,
    title: "Bandolera Anna Kaszer Doble Bolsillo Azul",
    vendor: "Anna Kaszer",
    tags: ["bolso", "Bolsos y accesorios", "Otoño/Invierno 25"],
    variants: [{ price: "92.00", option1: "Azul" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/IMAGENWEB_fb34de91-4d8d-42ea-84e4-1b006aeefae0.jpg" }]
  },
  {
    id: 15324225962309,
    title: "Billetero Anna Kaszer Granate",
    vendor: "Anna Kaszer",
    tags: ["bolso", "Bolsos y accesorios", "Otoño/Invierno 25"],
    variants: [{ price: "24.00", option1: "Granate" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/61001328-479C-4080-B93D-1CFEA0DF551F.jpg" }]
  },
  {
    id: 15324229304645,
    title: "Billetero Anna Kaszer Marron",
    vendor: "Anna Kaszer",
    tags: ["bolso", "Bolsos y accesorios", "Otoño/Invierno 25"],
    variants: [{ price: "24.00", option1: "Marrón" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/A73EAAA3-53BB-4AA0-B043-B9176B3ABC75.jpg" }]
  },
  {
    id: 15287194648901,
    title: "Blazer Adele Entallada Espiga",
    vendor: "ADELE",
    tags: ["Chaquetas y americanas de mujer", "Otoño/Invierno 25"],
    variants: [{ price: "189.00", option1: "Beige" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/0654/2937/3183/files/blazer-adele.jpg" }]
  },
];

// Función para detectar categoría basada en tags
function detectCategory(tags) {
  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    for (const [key, value] of Object.entries(CATEGORY_MAP)) {
      if (tagLower.includes(key)) {
        return value;
      }
    }
  }
  // Si no encuentra, intentar detectar por el nombre del tag
  return 'Accesorios'; // Default
}

// Función para detectar temporada
function detectSeason(tags) {
  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    if (tagLower.includes('otoño') || tagLower.includes('invierno')) {
      return 'Invierno/Otoño';
    }
    if (tagLower.includes('primavera') || tagLower.includes('verano')) {
      return 'Verano/Primavera';
    }
  }
  return 'Invierno/Otoño'; // Default para la colección actual
}

// Función para detectar estilo
function detectStyle(title, category) {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('blazer') || titleLower.includes('elegante')) return 'Elegante';
  if (titleLower.includes('sport') || titleLower.includes('deportiv')) return 'Deportivo';
  if (titleLower.includes('fiesta') || titleLower.includes('noche')) return 'Fiesta';
  if (category === 'Abrigo' || category === 'Chaqueta') return 'Elegante';
  return 'Casual';
}

// Función para detectar patrón
function detectPattern(title) {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('cuadro') || titleLower.includes('espiga')) return 'Plaid';
  if (titleLower.includes('raya') || titleLower.includes('rayas')) return 'Striped';
  if (titleLower.includes('flor') || titleLower.includes('flora')) return 'Floral';
  if (titleLower.includes('punto') || titleLower.includes('rombo')) return 'Other';
  return 'Solid';
}

// Función para limpiar el vendor/marca
function cleanBrand(vendor) {
  return vendor
    .replace(/^(Pantalones|Abrigos|Camisetas)\s+/i, '')
    .trim();
}

// Función para escapar CSV
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Convertir productos a formato de Supabase
function convertToSupabaseFormat(products) {
  const items = [];
  const seenIds = new Set();

  for (const product of products) {
    // Evitar duplicados
    if (seenIds.has(product.id)) continue;
    seenIds.add(product.id);

    const category = detectCategory(product.tags);
    const season = detectSeason(product.tags);
    const style = detectStyle(product.title, category);
    const pattern = detectPattern(product.title);
    const brand = cleanBrand(product.vendor);

    // Crear un item por cada variante de color
    const colorVariants = new Map();
    for (const variant of product.variants) {
      const color = variant.option1 || 'Default';
      if (!colorVariants.has(color)) {
        colorVariants.set(color, variant);
      }
    }

    let imageIndex = 0;
    for (const [color, variant] of colorVariants) {
      const imageUrl = product.images[imageIndex]?.src || product.images[0]?.src;
      imageIndex++;

      const characteristics = {
        color: color,
        secondary_color: null,
        category: category,
        sub_category: category,
        style: style,
        season: season,
        pattern: pattern,
        brand_guess: brand,
        material_guess: null
      };

      items.push({
        name: colorVariants.size > 1 ? `${product.title} - ${color}` : product.title,
        brand: brand,
        category: category,
        image_url: imageUrl,
        characteristics: JSON.stringify(characteristics)
      });
    }
  }

  return items;
}

// Generar CSV
function generateCSV(items) {
  const headers = ['name', 'brand', 'category', 'image_url', 'characteristics'];
  const rows = [headers.join(',')];

  for (const item of items) {
    const row = [
      escapeCSV(item.name),
      escapeCSV(item.brand),
      escapeCSV(item.category),
      escapeCSV(item.image_url),
      escapeCSV(item.characteristics)
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

// Ejecutar
const items = convertToSupabaseFormat(SHOPIFY_PRODUCTS);
const csv = generateCSV(items);

// Guardar archivo
const outputPath = path.join(__dirname, 'items_para_supabase.csv');
fs.writeFileSync(outputPath, csv, 'utf8');

console.log(`✅ CSV generado exitosamente: ${outputPath}`);
console.log(`📊 Total de items: ${items.length}`);
console.log('\n📋 Categorías encontradas:');
const categories = {};
items.forEach(item => {
  categories[item.category] = (categories[item.category] || 0) + 1;
});
Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`   - ${cat}: ${count}`);
});

console.log('\n🔄 Para importar a Supabase:');
console.log('   1. Ve a Supabase Dashboard > Table Editor > items');
console.log('   2. Click en "Insert" > "Import data from CSV"');
console.log('   3. Selecciona el archivo: scripts/items_para_supabase.csv');
console.log('   4. Asegúrate de que user_id esté configurado o sea null');
