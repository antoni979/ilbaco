/**
 * Stilaro Virtual Try-On Modal
 * Conecta con Supabase Edge Function para generar pruebas virtuales
 * Incluye sistema de control de uso por visitante
 */

(function () {
  'use strict';

  // Evitar doble ejecución si el script se carga múltiples veces
  if (window.__STILARO_VTON_LOADED__) return;
  window.__STILARO_VTON_LOADED__ = true;

  // Configuracion
  const CONFIG = {
    supabaseUrl: 'https://cbreesdbmbqctwbeswrt.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicmVlc2RibWJxY3R3YmVzd3J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjM0MzYsImV4cCI6MjA4MDgzOTQzNn0.alua1JB1IpMHg2iLLcVQ9qIYLmibA-8WmNTqlbrXOf4',
    edgeFunctionUrl: 'https://cbreesdbmbqctwbeswrt.supabase.co/functions/v1/vton'
  };

  // Estado
  let currentProduct = null;
  let userPhotoBase64 = null;
  let visitorId = null;
  let shopDomain = null;
  let shopStatus = null; // Estado de la tienda (activo/inactivo)

  // FOTO GLOBAL - Compartida entre todas las pestañas
  let globalUserPhotoBase64 = null;

  // Estado para outfit (Tab 2)
  let currentTab = 'single'; // 'single', 'sizing' o 'outfit'
  let outfitUserPhotoBase64 = null;
  let selectedOutfitItems = []; // Prendas seleccionadas para el outfit
  let availableProducts = []; // Cache de productos de la tienda

  // Estado para sizing (Tab 3)
  let sizingUserPhotoBase64 = null;
  let sizingData = {
    height: null,
    fit_preference: 'regular',
    reference_brand: 'grandes_almacenes',
    reference_size: 'M',
    analysis: null
  };

  // Banderas para evitar doble apertura del diálogo de archivos
  let isFileDialogOpen = false;

  // ========================================
  // FASHION TIPS - Consejos de moda animados
  // ========================================
  const FASHION_TIPS = [
    { icon: '✨', text: 'El negro estiliza y combina con todo. Es tu mejor aliado para cualquier ocasión.' },
    { icon: '🎨', text: 'La regla del 3: no uses más de tres colores en un mismo look para mantener el equilibrio.' },
    { icon: '👗', text: 'Invierte en básicos de calidad: una buena camiseta blanca y unos jeans oscuros nunca fallan.' },
    { icon: '💡', text: 'El fit lo es todo. Una prenda de tu talla siempre lucirá mejor que una de marca que no te queda.' },
    { icon: '🔥', text: 'Los accesorios transforman cualquier outfit. Un buen cinturón o bolso marca la diferencia.' },
    { icon: '👠', text: 'Los zapatos dicen mucho de ti. Mantenlos siempre limpios y en buen estado.' },
    { icon: '🌟', text: 'Menos es más. Un look sencillo pero bien ejecutado siempre impresiona.' },
    { icon: '💎', text: 'Los colores neutros son la base perfecta. Añade un toque de color con un accesorio.' },
    { icon: '🧥', text: 'Un buen abrigo eleva cualquier look. Es la primera impresión que das.' },
    { icon: '👔', text: 'Conoce tu paleta de colores. Los tonos que complementan tu piel te harán brillar.' },
    { icon: '✂️', text: 'La ropa bien planchada transmite profesionalidad y cuidado personal.' },
    { icon: '🎯', text: 'Viste para la ocasión, pero siempre añade un toque personal que te represente.' },
    { icon: '💫', text: 'El denim es atemporal. Unos buenos jeans son una inversión para años.' },
    { icon: '🌈', text: 'Los estampados pequeños estilizan, los grandes llaman la atención. Úsalos estratégicamente.' },
    { icon: '👜', text: 'Un bolso de calidad puede hacer que un outfit económico parezca de lujo.' },
    { icon: '🪞', text: 'Revisa tu look completo en el espejo antes de salir. Los detalles importan.' },
    { icon: '🎭', text: 'La confianza es tu mejor accesorio. Viste lo que te haga sentir bien.' },
    { icon: '📐', text: 'Juega con las proporciones: si arriba es holgado, abajo ajustado y viceversa.' },
    { icon: '🌺', text: 'En primavera-verano, los tonos pastel y florales son siempre una apuesta segura.' },
    { icon: '❄️', text: 'En otoño-invierno, las capas son tu mejor amigo. Combinan estilo y funcionalidad.' },
    { icon: '💪', text: 'Conoce tu cuerpo y destaca tus mejores atributos con el corte adecuado.' },
    { icon: '🎀', text: 'Un toque de color inesperado puede convertir un look aburrido en memorable.' },
    { icon: '⌚', text: 'Los clásicos nunca pasan de moda: blazer, camisa blanca, little black dress...' },
    { icon: '🧵', text: 'Revisa las costuras y acabados antes de comprar. La calidad se nota en los detalles.' },
    { icon: '🛍️', text: 'Antes de comprar, piensa con qué otras prendas de tu armario lo combinarías.' }
  ];

  let fashionTipInterval = null;
  let currentTipIndex = 0;

  function startFashionTips(elementId = 'stilaro-tip-text', iconId = null) {
    const textElement = document.getElementById(elementId);
    const iconElement = iconId ? document.getElementById(iconId) : textElement?.previousElementSibling;

    if (!textElement) return;

    // Randomizar el orden de los tips
    const shuffledTips = [...FASHION_TIPS].sort(() => Math.random() - 0.5);
    currentTipIndex = 0;

    // Mostrar primer tip
    showTip(textElement, iconElement, shuffledTips[currentTipIndex]);

    // Rotar tips cada 4 segundos
    fashionTipInterval = setInterval(() => {
      currentTipIndex = (currentTipIndex + 1) % shuffledTips.length;

      // Animación de salida
      textElement.classList.add('fade-out');

      setTimeout(() => {
        showTip(textElement, iconElement, shuffledTips[currentTipIndex]);
        textElement.classList.remove('fade-out');
      }, 300);
    }, 4000);
  }

  function showTip(textElement, iconElement, tip) {
    if (textElement) {
      textElement.textContent = tip.text;
    }
    if (iconElement) {
      iconElement.textContent = tip.icon;
    }
  }

  function stopFashionTips() {
    if (fashionTipInterval) {
      clearInterval(fashionTipInterval);
      fashionTipInterval = null;
    }
  }

  // ========================================
  // MOTOR DE RECOMENDACIONES DE MODA
  // ========================================
  const FashionEngine = {
    // Palabras clave multilíngue para detectar tipo de prenda
    // Formato: array de keywords que mapean a cada tipo
    CATEGORY_KEYWORDS: {
      'OUTERWEAR': [
        // Español
        'abrigo', 'abrigos', 'chaqueta', 'chaquetas', 'cazadora', 'parka', 'gabardina', 'blazer', 'americana',
        // English
        'coat', 'coats', 'jacket', 'jackets', 'outerwear', 'parka', 'blazer', 'cardigan', 'overcoat',
        // Français
        'manteau', 'veste', 'blouson', 'pardessus',
        // Deutsch
        'mantel', 'jacke', 'jacken', 'blazer',
        // Italiano
        'cappotto', 'giacca', 'giubbotto',
        // Português
        'casaco', 'jaqueta', 'blazer'
      ],
      'TOP': [
        // Español
        'jersey', 'jerseys', 'suéter', 'blusa', 'blusas', 'camiseta', 'camisetas', 'camisa', 'camisas',
        'sudadera', 'top', 'tops', 'polo', 'pullover', 'body',
        // English
        'sweater', 'sweaters', 'jumper', 'blouse', 'shirt', 'shirts', 't-shirt', 'tshirt', 'tee',
        'sweatshirt', 'hoodie', 'top', 'tops', 'polo', 'pullover', 'bodysuit', 'tank',
        // Français
        'pull', 'chemise', 'chemisier', 'haut', 'sweat',
        // Deutsch
        'pullover', 'hemd', 'bluse', 'oberteil', 'shirt',
        // Italiano
        'maglione', 'camicia', 'maglia', 'felpa',
        // Português
        'camisola', 'camisa', 'blusa', 'moletom'
      ],
      'BOTTOM': [
        // Español
        'pantalón', 'pantalones', 'pantalon', 'vaquero', 'vaqueros', 'jeans', 'falda', 'faldas',
        'shorts', 'bermuda', 'leggins', 'leggings', 'jogger', 'chino', 'chinos',
        // English
        'pants', 'trousers', 'jeans', 'skirt', 'skirts', 'shorts', 'leggings', 'joggers', 'chinos', 'slacks',
        // Français
        'pantalon', 'jean', 'jupe', 'short',
        // Deutsch
        'hose', 'hosen', 'jeans', 'rock', 'shorts',
        // Italiano
        'pantaloni', 'jeans', 'gonna', 'shorts',
        // Português
        'calça', 'calças', 'jeans', 'saia', 'shorts'
      ],
      'DRESS': [
        // Español
        'vestido', 'vestidos', 'mono', 'jumpsuit',
        // English
        'dress', 'dresses', 'gown', 'jumpsuit', 'romper',
        // Français
        'robe', 'robes', 'combinaison',
        // Deutsch
        'kleid', 'kleider',
        // Italiano
        'vestito', 'abito',
        // Português
        'vestido', 'vestidos'
      ],
      'SHOES': [
        // Español
        'zapato', 'zapatos', 'calzado', 'zapatilla', 'zapatillas', 'bota', 'botas', 'sandalia', 'tacón', 'tacones',
        // English
        'shoe', 'shoes', 'footwear', 'sneaker', 'sneakers', 'boot', 'boots', 'sandal', 'sandals', 'heel', 'heels', 'loafer',
        // Français
        'chaussure', 'chaussures', 'basket', 'botte', 'sandale', 'talon',
        // Deutsch
        'schuh', 'schuhe', 'stiefel', 'sandale', 'sneaker',
        // Italiano
        'scarpa', 'scarpe', 'stivale', 'sandalo', 'sneaker',
        // Português
        'sapato', 'sapatos', 'tênis', 'bota', 'sandália'
      ],
      'ACCESSORY': [
        // Español
        'accesorio', 'accesorios', 'bolso', 'cinturón', 'bufanda', 'gorro', 'sombrero', 'gafas', 'joyería', 'collar', 'pulsera',
        // English
        'accessory', 'accessories', 'bag', 'belt', 'scarf', 'hat', 'sunglasses', 'jewelry', 'necklace', 'bracelet', 'watch',
        // Français
        'accessoire', 'sac', 'ceinture', 'écharpe', 'chapeau', 'bijou',
        // Deutsch
        'accessoire', 'tasche', 'gürtel', 'schal', 'hut', 'schmuck',
        // Italiano
        'accessorio', 'borsa', 'cintura', 'sciarpa', 'cappello', 'gioiello',
        // Português
        'acessório', 'bolsa', 'cinto', 'cachecol', 'chapéu', 'jóia'
      ]
    },

    // Función para detectar tipo de prenda (busca en product_type, title y tags)
    detectCategory(product) {
      const searchTexts = [
        (product.product_type || '').toLowerCase(),
        (product.title || '').toLowerCase(),
        Array.isArray(product.tags) ? product.tags.join(' ').toLowerCase() : (product.tags || '').toLowerCase()
      ].join(' ');

      // Buscar coincidencias en las keywords
      for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
        for (const keyword of keywords) {
          // Buscar palabra completa o al inicio/fin de compuestos
          const regex = new RegExp(`(^|\\s|-)${keyword}(s|es)?($|\\s|-)`, 'i');
          if (regex.test(searchTexts)) {
            return category;
          }
        }
      }

      return null; // No se pudo detectar
    },

    // Qué categorías complementan a cuál
    CATEGORY_COMPLEMENTS: {
      'OUTERWEAR': ['BOTTOM', 'TOP', 'SHOES'],
      'TOP': ['BOTTOM', 'OUTERWEAR', 'SHOES'],
      'BOTTOM': ['TOP', 'OUTERWEAR', 'SHOES'],
      'SHOES': ['BOTTOM', 'TOP'],
      'DRESS': ['OUTERWEAR', 'SHOES'],
      'ACCESSORY': []
    },

    // Colores neutros (combinan con casi todo)
    NEUTRAL_COLORS: [
      'negro', 'blanco', 'gris', 'beige', 'crema',
      'camel', 'marron', 'marrón', 'piedra', 'natural', 'nude'
    ],

    // Combinaciones que funcionan bien (basadas en teoría del color)
    COLOR_HARMONIES: {
      'negro': ['blanco', 'gris', 'rojo', 'beige', 'crema', 'camel', 'rosa', 'amarillo'],
      'blanco': ['negro', 'azul', 'azul marino', 'beige', 'rosa', 'rojo', 'verde', 'naranja'],
      'azul marino': ['blanco', 'beige', 'crema', 'rojo', 'camel', 'rosa'],
      'azul': ['blanco', 'beige', 'naranja', 'camel', 'marron'],
      'gris': ['rosa', 'negro', 'blanco', 'azul', 'rojo', 'burdeos', 'amarillo'],
      'beige': ['blanco', 'azul marino', 'marron', 'verde', 'azul'],
      'rojo': ['negro', 'blanco', 'azul marino', 'gris'],
      'verde': ['beige', 'marron', 'crema', 'blanco'],
      'rosa': ['gris', 'blanco', 'negro', 'azul marino', 'beige'],
      'marron': ['beige', 'crema', 'verde', 'blanco', 'naranja', 'rosa'],
      'camel': ['negro', 'blanco', 'azul marino', 'beige', 'burdeos'],
      'burdeos': ['beige', 'camel', 'gris', 'crema'],
      'vino': ['beige', 'gris', 'crema', 'camel'],
      'naranja': ['azul', 'blanco', 'beige', 'marron'],
      'amarillo': ['gris', 'azul marino', 'negro', 'blanco']
    },

    // Combinaciones a EVITAR (chocan visualmente)
    COLOR_CLASHES: [
      ['rojo', 'naranja'],
      ['rojo', 'rosa'],
      ['rojo', 'verde'],
      ['verde', 'rosa'],
      ['verde', 'azul'],
      ['naranja', 'rosa'],
      ['naranja', 'amarillo'],
      ['negro', 'marron'],
      ['negro', 'azul marino'],
      ['gris', 'marron']
    ],

    // Tips por color (basados en reglas de estilismo)
    COLOR_TIPS: {
      'azul marino': {
        good: 'tonos tierra o blanco',
        bad: 'negro',
        tip: 'El azul marino pide tonos tierra o blanco. El negro lo apaga, no hay contraste.'
      },
      'negro': {
        good: 'contraste con blanco, gris o colores vivos',
        bad: 'marrón o azul marino',
        tip: 'El negro pide contraste. Con marrón o azul marino se pierde todo.'
      },
      'blanco': {
        good: 'casi todo',
        bad: 'crema o beige muy claro',
        tip: 'El blanco es comodín. Evita tonos muy similares que parezcan manchas.'
      },
      'gris': {
        good: 'rosa, azul o burdeos',
        bad: 'marrón',
        tip: 'El gris combina con casi todo menos marrón. Rosa o burdeos le dan vida.'
      },
      'beige': {
        good: 'azul marino, blanco o verde',
        bad: 'amarillo o naranja',
        tip: 'Los tonos tierra se llevan bien entre sí. Azul marino es su mejor aliado.'
      },
      'camel': {
        good: 'azul marino, blanco o burdeos',
        bad: 'amarillo o naranja',
        tip: 'El camel es elegante con azul marino o burdeos. Evita tonos cálidos similares.'
      },
      'rojo': {
        good: 'negro, blanco o gris',
        bad: 'naranja, rosa o verde',
        tip: 'El rojo es protagonista. Solo con neutros. Naranja y rosa compiten, verde es Navidad.'
      },
      'verde': {
        good: 'beige, marrón o blanco',
        bad: 'rojo, rosa o azul',
        tip: 'El verde es difícil. Apuesta por tonos tierra y neutros claros.'
      },
      'rosa': {
        good: 'gris, blanco o azul marino',
        bad: 'rojo, verde o naranja',
        tip: 'El rosa se suaviza con grises y neutros. Lejos del verde y el rojo.'
      },
      'marron': {
        good: 'beige, blanco o verde',
        bad: 'negro o gris',
        tip: 'El marrón pide tonos claros. Negro y gris lo ensombrecen.'
      },
      'naranja': {
        good: 'azul, blanco o beige',
        bad: 'rojo, rosa o amarillo',
        tip: 'Naranja + azul es combo ganador. Evita tonos cálidos similares.'
      },
      'burdeos': {
        good: 'beige, camel o gris',
        bad: 'rojo o marrón oscuro',
        tip: 'El burdeos es elegante con camel o gris. Evita rojos, compiten.'
      },
      'amarillo': {
        good: 'gris, azul marino o blanco',
        bad: 'naranja o rojo',
        tip: 'El amarillo alegra con grises o azul marino. Nada de naranjas.'
      }
    },

    extractColor(product) {
      // tags puede ser string o array dependiendo de la API
      let tagsArray = [];
      if (Array.isArray(product.tags)) {
        tagsArray = product.tags.map(t => t.toLowerCase().trim());
      } else if (typeof product.tags === 'string') {
        tagsArray = product.tags.toLowerCase().split(',').map(t => t.trim());
      }
      const title = (product.title || '').toLowerCase();

      const allColors = [...this.NEUTRAL_COLORS, ...Object.keys(this.COLOR_HARMONIES)];

      // Buscar en tags
      for (const tag of tagsArray) {
        for (const color of allColors) {
          if (tag === color || tag.includes(color)) {
            return color;
          }
        }
      }

      // Buscar en título
      for (const color of allColors) {
        if (title.includes(color)) {
          return color;
        }
      }

      return 'neutro';
    },

    calculateColorScore(color1, color2) {
      const c1 = color1.toLowerCase();
      const c2 = color2.toLowerCase();

      if (c1 === c2) return 70;
      if (c1 === 'neutro' || c2 === 'neutro') return 60;
      if (this.NEUTRAL_COLORS.includes(c1) || this.NEUTRAL_COLORS.includes(c2)) return 85;

      const harmonies = this.COLOR_HARMONIES[c1] || [];
      if (harmonies.includes(c2)) return 100;

      for (const clash of this.COLOR_CLASHES) {
        if (clash.includes(c1) && clash.includes(c2)) return 0;
      }

      return 40;
    },

    getRecommendations(currentProd, allProducts, maxPerCategory = 3) {
      const currentOutfitType = this.detectCategory(currentProd);
      const currentColor = this.extractColor(currentProd);

      if (!currentOutfitType) {
        console.log('[Fashion] Tipo no reconocido para:', currentProd.title, '- product_type:', currentProd.product_type);
        return {};
      }

      console.log('[Fashion] Producto actual detectado como:', currentOutfitType);

      const complementTypes = this.CATEGORY_COMPLEMENTS[currentOutfitType] || [];

      const candidates = allProducts
        .filter(p => p.id !== currentProd.id)
        .map(p => {
          const pType = this.detectCategory(p);
          const pColor = this.extractColor(p);
          return {
            ...p,
            outfitType: pType,
            color: pColor,
            colorScore: this.calculateColorScore(currentColor, pColor),
            isComplement: complementTypes.includes(pType)
          };
        })
        .filter(p => p.outfitType && p.isComplement && p.colorScore > 0)
        .sort((a, b) => b.colorScore - a.colorScore);

      const result = {};
      for (const type of complementTypes) {
        const items = candidates
          .filter(p => p.outfitType === type)
          .slice(0, maxPerCategory);

        if (items.length > 0) {
          // Labels multilíngue (detectamos idioma por el navegador)
          const lang = (navigator.language || 'es').substring(0, 2);
          const labels = {
            'OUTERWEAR': { es: 'Abrigos y chaquetas', en: 'Coats & Jackets', fr: 'Manteaux', de: 'Mäntel & Jacken', it: 'Cappotti', pt: 'Casacos' },
            'TOP': { es: 'Parte de arriba', en: 'Tops', fr: 'Hauts', de: 'Oberteile', it: 'Top', pt: 'Blusas' },
            'BOTTOM': { es: 'Pantalones y faldas', en: 'Bottoms', fr: 'Bas', de: 'Hosen & Röcke', it: 'Pantaloni', pt: 'Calças' },
            'SHOES': { es: 'Calzado', en: 'Shoes', fr: 'Chaussures', de: 'Schuhe', it: 'Scarpe', pt: 'Sapatos' },
            'DRESS': { es: 'Vestidos', en: 'Dresses', fr: 'Robes', de: 'Kleider', it: 'Vestiti', pt: 'Vestidos' }
          };
          const label = labels[type]?.[lang] || labels[type]?.['en'] || type;
          result[label] = items;
        }
      }

      return result;
    }
  };

  // Elementos DOM
  const modal = document.getElementById('stilaro-vton-modal');
  const closeBtn = modal?.querySelector('.stilaro-vton-close');

  // FOTO GLOBAL - Elementos
  const globalPhotoSection = document.getElementById('stilaro-global-photo-section');
  const globalUploadArea = document.getElementById('stilaro-global-upload-area');
  const globalPhotoInput = document.getElementById('stilaro-global-photo-input');
  const globalPhotoPreview = document.getElementById('stilaro-global-photo-preview');
  const globalPhotoImg = document.getElementById('stilaro-global-photo-img');
  const globalPhotoChange = document.getElementById('stilaro-global-photo-change');

  const uploadArea = document.getElementById('stilaro-upload-area');
  const photoInput = document.getElementById('stilaro-photo-input');
  const userPreview = document.getElementById('stilaro-user-preview');
  const tryOnBtn = document.getElementById('stilaro-try-on-btn');
  const retryBtn = document.getElementById('stilaro-retry-btn');
  const addCartBtn = document.getElementById('stilaro-add-cart-btn');
  const downloadBtn = document.getElementById('stilaro-download-btn');
  const progressFill = document.getElementById('stilaro-progress-fill');
  const progressText = document.getElementById('stilaro-progress-text');
  const productImage = document.getElementById('stilaro-product-image');
  const productTitle = document.getElementById('stilaro-product-title');
  const resultImage = document.getElementById('stilaro-result-image');

  // Steps (Tab 1 - Single)
  const stepUpload = document.getElementById('stilaro-step-upload');
  const stepResult = document.getElementById('stilaro-step-result');
  const stepLoading = document.getElementById('stilaro-step-loading');

  // Elements (Tab 2 - Outfit)
  const outfitUpload = document.getElementById('stilaro-outfit-upload');
  const outfitUploadArea = document.getElementById('stilaro-outfit-upload-area');
  const outfitPhotoInput = document.getElementById('stilaro-outfit-photo-input');
  const outfitUserPreview = document.getElementById('stilaro-outfit-user-preview');
  const outfitContinueBtn = document.getElementById('stilaro-outfit-continue-btn');
  const outfitProductImage = document.getElementById('stilaro-outfit-product-image');
  const outfitProductTitle = document.getElementById('stilaro-outfit-product-title');
  const outfitRecommendations = document.getElementById('stilaro-outfit-recommendations');
  const recommendationsGrid = document.getElementById('stilaro-recommendations-grid');
  const outfitSummary = document.getElementById('stilaro-outfit-summary');
  const outfitPreview = document.getElementById('stilaro-outfit-preview');
  const skipBtn = document.getElementById('stilaro-skip-btn');
  const outfitTryOnBtn = document.getElementById('stilaro-outfit-tryon-btn');
  const outfitLoading = document.getElementById('stilaro-outfit-loading');
  const outfitProgressFill = document.getElementById('stilaro-outfit-progress-fill');
  const outfitProgressText = document.getElementById('stilaro-outfit-progress-text');
  const outfitResult = document.getElementById('stilaro-outfit-result');
  const outfitResultImage = document.getElementById('stilaro-outfit-result-image');
  const outfitItemsList = document.getElementById('stilaro-outfit-items-list');
  const outfitDownloadBtn = document.getElementById('stilaro-outfit-download-btn');
  const outfitRetryBtn = document.getElementById('stilaro-outfit-retry-btn');
  const outfitAddAllBtn = document.getElementById('stilaro-outfit-addall-btn');

  // Elements (Tab 3 - Sizing)
  const sizingUpload = document.getElementById('stilaro-sizing-upload');
  const sizingUploadArea = document.getElementById('stilaro-sizing-upload-area');
  const sizingPhotoInput = document.getElementById('stilaro-sizing-photo-input');
  const sizingUserPreview = document.getElementById('stilaro-sizing-user-preview');
  const sizingContinueBtn = document.getElementById('stilaro-sizing-continue-btn');
  const sizingProductImage = document.getElementById('stilaro-sizing-product-image');
  const sizingProductTitle = document.getElementById('stilaro-sizing-product-title');
  const sizingForm = document.getElementById('stilaro-sizing-form');
  const sizingAnalyzeBtn = document.getElementById('stilaro-sizing-analyze-btn');
  const sizingLoading = document.getElementById('stilaro-sizing-loading');
  const sizingProgressFill = document.getElementById('stilaro-sizing-progress-fill');
  const sizingProgressText = document.getElementById('stilaro-sizing-progress-text');
  const sizingResult = document.getElementById('stilaro-sizing-result');
  const sizingRetryBtn = document.getElementById('stilaro-sizing-retry-btn');
  const sizingTryOnBtn = document.getElementById('stilaro-sizing-tryon-btn');
  const recommendedSizeEl = document.getElementById('stilaro-recommended-size');
  const altSizeEl = document.getElementById('stilaro-alt-size');
  const confidenceFill = document.getElementById('stilaro-confidence-fill');
  const confidenceText = document.getElementById('stilaro-confidence-text');
  const sizingDetails = document.getElementById('stilaro-sizing-details');
  const sizingTip = document.getElementById('stilaro-sizing-tip');

  // Tabs
  const tabs = document.querySelectorAll('.stilaro-tab');

  // ========================================
  // VISITOR ID - Identificador unico por visitante
  // ========================================
  function generateVisitorId() {
    // Intentar obtener de localStorage
    const stored = localStorage.getItem('stilaro_visitor_id');
    if (stored) {
      return stored;
    }

    // Generar nuevo ID basado en fingerprint simple
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Stilaro VTON', 2, 2);
    const canvasData = canvas.toDataURL();

    const navigatorData = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset()
    ].join('|');

    // Simple hash
    const str = canvasData + navigatorData + Math.random().toString(36);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    const newId = 'v_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
    localStorage.setItem('stilaro_visitor_id', newId);
    return newId;
  }

  function getShopDomain() {
    // Obtener el dominio de la tienda Shopify
    return window.Shopify?.shop || window.location.hostname;
  }

  // ========================================
  // VERIFICAR ESTADO DE LA TIENDA
  // ========================================
  async function checkShopStatus() {
    try {
      const response = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/check_shop_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.supabaseKey,
          'Authorization': `Bearer ${CONFIG.supabaseKey}`
        },
        body: JSON.stringify({
          p_shop_domain: shopDomain,
          p_visitor_id: visitorId
        })
      });

      if (!response.ok) {
        console.error('[VTON] Error verificando estado:', response.status);
        return { active: true }; // En caso de error, permitir (fail open)
      }

      const data = await response.json();
      console.log('[VTON] Estado de tienda:', data);
      return data;

    } catch (error) {
      console.error('[VTON] Error verificando estado:', error);
      return { active: true }; // En caso de error, permitir
    }
  }

  // ========================================
  // UI: Mostrar estado deshabilitado
  // ========================================
  function showDisabledState(message, reason) {
    // Crear mensaje de estado
    let statusMsg = document.getElementById('stilaro-status-message');
    if (!statusMsg) {
      statusMsg = document.createElement('div');
      statusMsg.id = 'stilaro-status-message';
      // Insertar antes del upload area
      uploadArea?.parentNode?.insertBefore(statusMsg, uploadArea);
    }

    // Estilos segun el tipo de error
    let bgColor = '#fff3cd';
    let borderColor = '#ffc107';
    let textColor = '#856404';
    let icon = '⚠️';

    if (reason === 'daily_limit_reached') {
      bgColor = '#f8d7da';
      borderColor = '#f5c6cb';
      textColor = '#721c24';
      icon = '🚫';
    } else if (reason === 'shop_not_found') {
      bgColor = '#e2e3e5';
      borderColor = '#d6d8db';
      textColor = '#383d41';
      icon = '🔒';
    }

    statusMsg.style.cssText = `
      background: ${bgColor};
      border: 1px solid ${borderColor};
      border-radius: 8px;
      padding: 20px;
      margin: 0 0 16px 0;
      text-align: center;
    `;

    statusMsg.innerHTML = `
      <p style="margin: 0 0 8px 0; font-size: 24px;">${icon}</p>
      <p style="margin: 0; color: ${textColor}; font-weight: 500;">
        ${message}
      </p>
    `;

    statusMsg.style.display = 'block';

    // Ocultar/deshabilitar area de upload
    if (uploadArea) {
      uploadArea.style.display = 'none';
    }

    // Ocultar boton de probar
    if (tryOnBtn) {
      tryOnBtn.style.display = 'none';
    }
  }

  function showEnabledState(statusData) {
    // Ocultar mensaje de estado si existe
    const statusMsg = document.getElementById('stilaro-status-message');
    if (statusMsg) {
      statusMsg.style.display = 'none';
    }

    // Mostrar area de upload
    if (uploadArea) {
      uploadArea.style.display = 'block';
    }

    // Mostrar info de usos restantes (opcional)
    if (statusData.remaining_today !== undefined) {
      let usageInfo = document.getElementById('stilaro-usage-info');
      if (!usageInfo) {
        usageInfo = document.createElement('div');
        usageInfo.id = 'stilaro-usage-info';
        usageInfo.style.cssText = `
          text-align: center;
          font-size: 12px;
          color: #666;
          margin-top: 8px;
        `;
        uploadArea?.parentNode?.insertBefore(usageInfo, uploadArea.nextSibling);
      }
      usageInfo.textContent = `${statusData.remaining_today} pruebas restantes hoy`;
      usageInfo.style.display = 'block';
    }
  }

  function hideUsageInfo() {
    const usageInfo = document.getElementById('stilaro-usage-info');
    if (usageInfo) {
      usageInfo.style.display = 'none';
    }
  }

  // ========================================
  // THEME COLOR DETECTION - Adaptive styling
  // ========================================
  function detectThemeColors() {
    const modal = document.getElementById('stilaro-vton-modal');
    if (!modal) return;

    // Get computed styles from body and main elements
    const body = document.body;
    const bodyStyles = window.getComputedStyle(body);

    // Try to detect background color
    let bgColor = bodyStyles.backgroundColor;
    if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
      // Try html element
      bgColor = window.getComputedStyle(document.documentElement).backgroundColor;
    }

    // Try to detect text color
    let textColor = bodyStyles.color;

    // Check if we got valid colors
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
      modal.style.setProperty('--stilaro-bg', bgColor);
    }

    if (textColor) {
      modal.style.setProperty('--stilaro-text', textColor);
    }

    // Detect if theme is dark by analyzing luminance
    const rgb = bgColor.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      const luminance = (0.299 * parseInt(rgb[0]) + 0.587 * parseInt(rgb[1]) + 0.114 * parseInt(rgb[2])) / 255;
      if (luminance < 0.5) {
        modal.classList.add('stilaro-dark-theme');
      }
    }

    console.log('[VTON] Theme detected - BG:', bgColor, 'Text:', textColor);
  }

  // ========================================
  // MODAL CENTRADO (CSS flexbox lo maneja)
  // ========================================
  function positionModalOverButton() {
    console.log('[VTON] Modal abierto - aplicando estilos de respaldo');

    // CRÍTICO: Mover el modal directamente al BODY si no está ahí
    if (modal && modal.parentElement !== document.body) {
      console.warn('[VTON] ⚠️ Modal NO está en body - MOVIENDOLO...');
      console.log('[VTON] Padre actual:', modal.parentElement?.tagName, modal.parentElement?.className);
      document.body.appendChild(modal);
      console.log('[VTON] ✅ Modal movido a body');
    }

    // Forzar estilos inline como respaldo por si CSS falla
    if (modal) {
      // Estilos críticos del modal con !important via cssText
      modal.style.cssText = `
        display: flex !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 2147483647 !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        padding: 0 !important;
        transform: none !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      `;

      const overlay = modal.querySelector('.stilaro-vton-modal-overlay');
      if (overlay) {
        overlay.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: rgba(0, 0, 0, 0.5) !important;
          z-index: 2147483646 !important;
          pointer-events: auto !important;
        `;
      }

      const content = modal.querySelector('.stilaro-vton-modal-content');
      if (content) {
        // Usar setProperty para máxima prioridad
        content.style.setProperty('position', 'relative', 'important');
        content.style.setProperty('background', '#ffffff', 'important');
        content.style.setProperty('color', '#000000', 'important');
        content.style.setProperty('z-index', '2', 'important');
        content.style.setProperty('width', '450px', 'important');
        content.style.setProperty('height', 'auto', 'important');
        content.style.setProperty('min-height', '500px', 'important');
        content.style.setProperty('border-radius', '16px', 'important');
        content.style.setProperty('padding', '24px', 'important');
        content.style.setProperty('max-height', 'calc(100vh - 40px)', 'important');
        content.style.setProperty('overflow-y', 'auto', 'important');
        content.style.setProperty('opacity', '1', 'important');
        content.style.setProperty('visibility', 'visible', 'important');
        content.style.setProperty('pointer-events', 'auto', 'important');
        content.style.setProperty('display', 'block', 'important');
        content.style.setProperty('box-sizing', 'border-box', 'important');

        // Forzar visibilidad y dimensiones de elementos hijos
        const header = content.querySelector('.stilaro-vton-header');
        const tabs = content.querySelector('.stilaro-vton-tabs');
        const body = content.querySelector('.stilaro-vton-body');
        const closeBtn = content.querySelector('.stilaro-vton-close');

        if (header) {
          header.style.setProperty('display', 'block', 'important');
          header.style.setProperty('visibility', 'visible', 'important');
          header.style.setProperty('min-height', '50px', 'important');
          header.style.setProperty('color', '#000000', 'important');
        }
        if (tabs) {
          tabs.style.setProperty('display', 'flex', 'important');
          tabs.style.setProperty('visibility', 'visible', 'important');
          tabs.style.setProperty('min-height', '40px', 'important');
        }
        if (body) {
          body.style.setProperty('display', 'block', 'important');
          body.style.setProperty('visibility', 'visible', 'important');
          body.style.setProperty('min-height', '300px', 'important');
        }
        if (closeBtn) {
          closeBtn.style.setProperty('display', 'flex', 'important');
          closeBtn.style.setProperty('visibility', 'visible', 'important');
          closeBtn.style.setProperty('width', '36px', 'important');
          closeBtn.style.setProperty('height', '36px', 'important');
        }
      }

      // Diagnóstico completo del modal
      const modalStyle = getComputedStyle(modal);
      const contentStyle = content ? getComputedStyle(content) : null;

      console.log('[VTON] ===== ESTADO DEL MODAL =====');
      console.log('[VTON] Modal existe:', !!modal);
      console.log('[VTON] Modal dimensiones:', modal.offsetWidth, 'x', modal.offsetHeight);
      console.log('[VTON] Modal display:', modalStyle.display);
      console.log('[VTON] Modal position:', modalStyle.position);
      console.log('[VTON] Modal z-index:', modalStyle.zIndex);
      console.log('[VTON] Modal opacity:', modalStyle.opacity);
      console.log('[VTON] Modal visibility:', modalStyle.visibility);
      console.log('[VTON] Modal transform:', modalStyle.transform);
      console.log('[VTON] Modal top/left:', modalStyle.top, '/', modalStyle.left);
      console.log('[VTON] Content dimensiones:', content ? (content.offsetWidth + 'x' + content.offsetHeight) : 'no content');
      console.log('[VTON] Content opacity:', contentStyle ? contentStyle.opacity : 'N/A');
      console.log('[VTON] Content visibility:', contentStyle ? contentStyle.visibility : 'N/A');
      console.log('[VTON] Content width (computado):', contentStyle ? contentStyle.width : 'N/A');
      console.log('[VTON] Content height (computado):', contentStyle ? contentStyle.height : 'N/A');
      console.log('[VTON] Content min-height (computado):', contentStyle ? contentStyle.minHeight : 'N/A');
      console.log('[VTON] Content display (computado):', contentStyle ? contentStyle.display : 'N/A');

      // Diagnóstico específico si display es none - SOLUCIÓN NUCLEAR
      if (content && contentStyle && contentStyle.display === 'none') {
        console.log('[VTON] ⚠️ PROBLEMA CRÍTICO: display:none persiste con !important inline');
        console.log('[VTON] Clase original:', content.className);

        // SOLUCIÓN NUCLEAR: Eliminar clase conflictiva
        console.log('[VTON] 🚨 Aplicando solución nuclear - removiendo clases...');
        content.className = '';

        // Reaplicar TODOS los estilos con setAttribute - CENTRADO ABSOLUTO
        content.setAttribute('style', `
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: fixed !important;
          background: rgb(255, 255, 255) !important;
          color: rgb(0, 0, 0) !important;
          z-index: 2147483647 !important;
          width: 450px !important;
          max-width: calc(100vw - 32px) !important;
          min-height: 500px !important;
          border-radius: 16px !important;
          padding: 24px !important;
          max-height: calc(100vh - 40px) !important;
          overflow-y: auto !important;
          box-sizing: border-box !important;
          left: 50% !important;
          top: 50% !important;
          transform: translate(-50%, -50%) !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
        `);

        // Forzar hijos también
        const header = content.querySelector('.stilaro-vton-header');
        const tabs = content.querySelector('.stilaro-vton-tabs');
        const body = content.querySelector('.stilaro-vton-body');

        if (header) header.setAttribute('style', 'display: block !important; visibility: visible !important;');
        if (tabs) tabs.setAttribute('style', 'display: flex !important; visibility: visible !important;');
        if (body) body.setAttribute('style', 'display: block !important; visibility: visible !important; min-height: 300px !important;');

        // Verificar después de 100ms
        setTimeout(() => {
          const final = getComputedStyle(content);
          console.log('[VTON] ✅ Display FINAL:', final.display);
          console.log('[VTON] ✅ Dimensiones:', content.offsetWidth + 'x' + content.offsetHeight);
          console.log('[VTON] ✅ Z-index content:', final.zIndex);
          console.log('[VTON] ✅ Position content:', final.position);

          // Verificar si hay elementos tapando el modal
          const modalRect = content.getBoundingClientRect();
          const centerX = modalRect.left + modalRect.width / 2;
          const centerY = modalRect.top + modalRect.height / 2;
          const elementAtCenter = document.elementFromPoint(centerX, centerY);

          if (elementAtCenter && !content.contains(elementAtCenter) && elementAtCenter !== content) {
            console.warn('[VTON] ⚠️ HAY UN ELEMENTO TAPANDO EL MODAL:');
            console.warn('[VTON]   Tag:', elementAtCenter.tagName);
            console.warn('[VTON]   ID:', elementAtCenter.id);
            console.warn('[VTON]   Classes:', elementAtCenter.className);
            console.warn('[VTON]   Z-index:', getComputedStyle(elementAtCenter).zIndex);

            // Intentar bajar el z-index del elemento que tapa
            const blockingZIndex = parseInt(getComputedStyle(elementAtCenter).zIndex);
            if (!isNaN(blockingZIndex) && blockingZIndex >= 2147483647) {
              elementAtCenter.style.setProperty('z-index', '999998', 'important');
              console.log('[VTON] 🛡️ Z-index del elemento bloqueante reducido a 999998');
            }
          } else {
            console.log('[VTON] ✅ No hay elementos tapando el modal');
          }

          // Si aún no funciona, usar MutationObserver
          if (final.display === 'none') {
            console.error('[VTON] 💀 JS externo está manipulando estilos - activando MutationObserver');
            const observer = new MutationObserver(() => {
              if (getComputedStyle(content).display === 'none') {
                content.style.setProperty('display', 'block', 'important');
              }
            });
            observer.observe(content, { attributes: true, attributeFilter: ['style', 'class'] });
          }
        }, 100);
      }

      // Buscar elementos que puedan estar encima del modal
      console.log('[VTON] ===== OTROS ELEMENTOS CON Z-INDEX ALTO =====');
      const allElements = document.querySelectorAll('*');
      const highZElements = Array.from(allElements)
        .filter(el => {
          const z = parseInt(getComputedStyle(el).zIndex);
          return !isNaN(z) && z > 1000000;
        })
        .map(el => ({
          tag: el.tagName,
          id: el.id,
          classes: el.className,
          zIndex: getComputedStyle(el).zIndex,
          position: getComputedStyle(el).position
        }));

      if (highZElements.length > 0) {
        console.log('[VTON] 🔍 Elementos con z-index > 1000000:');
        highZElements.forEach((el, i) => {
          const classStr = el.classes ? ` classes="${el.classes.split(' ').slice(0, 3).join(' ')}"` : '';
          console.log(`  ${i + 1}. ${el.tag}${el.id ? '#' + el.id : ''}${classStr} - z-index: ${el.zIndex}, position: ${el.position}`);
        });

        // Si hay elementos externos, BAJARLOS inmediatamente
        const nonModalElements = highZElements.filter(el => el.id !== 'stilaro-vton-modal');
        if (nonModalElements.length > 0) {
          console.warn('[VTON] ⚠️ Encontrados', nonModalElements.length, 'elementos externos - BAJANDO z-index AGRESIVAMENTE...');
        }

        // ESTRATEGIA MEGA-NUCLEAR: Iterar sobre TODOS los elementos y bajar CUALQUIERA con z-index >= 1
        let reducedCount = 0;
        allElements.forEach(el => {
          const z = parseInt(getComputedStyle(el).zIndex);
          // Reducir ABSOLUTAMENTE CUALQUIER elemento con z-index positivo (excepto el modal y sus hijos)
          if (!isNaN(z) && z >= 1 && el.id !== 'stilaro-vton-modal' && !modal.contains(el)) {
            // Resetear a auto para que no interfiera
            el.style.setProperty('z-index', 'auto', 'important');
            reducedCount++;
            if (reducedCount <= 10) { // Logear primeros 10 para diagnóstico
              console.log('[VTON] 🛡️ Z-index reseteado a auto:', el.tagName, el.id || el.className || '(sin id/clase)', 'de', z);
            }
          }
        });

        if (reducedCount > 0) {
          console.log('[VTON] ✅', reducedCount, 'elementos externos neutralizados ULTRA-AGRESIVAMENTE');
        }
      } else {
        console.log('[VTON] No hay otros elementos con z-index mayor a 1000000');
      }

      // BAJAR z-index de TODOS los padres del modal (no elevarlos)
      // Esto evita que un padre con z-index alto cree un stacking context compartido con la foto
      let parent = modal.parentElement;
      while (parent && parent !== document.body) {
        const parentZ = parseInt(getComputedStyle(parent).zIndex);
        if (!isNaN(parentZ) && parentZ !== 0) {
          parent.style.setProperty('z-index', 'auto', 'important');
          console.log('[VTON] ⚠️ Z-index del padre', parent.tagName, 'reseteado a auto (era', parentZ + ')');
        }
        parent = parent.parentElement;
      }

      // Verificar si el modal está en el DOM
      console.log('[VTON] Modal en DOM:', document.body.contains(modal));
      console.log('[VTON] Parent del modal:', modal.parentElement?.tagName);

      // Verificar contenido interno y dimensiones de cada hijo
      if (content) {
        const header = content.querySelector('.stilaro-vton-header');
        const tabsContainer = content.querySelector('.stilaro-vton-tabs');
        const tabs = content.querySelectorAll('.stilaro-tab');
        const body = content.querySelector('.stilaro-vton-body');
        const closeBtn = content.querySelector('.stilaro-vton-close');

        console.log('[VTON] ===== ELEMENTOS HIJOS =====');
        console.log('[VTON] Header existe:', !!header, header ? `(${header.offsetWidth}x${header.offsetHeight})` : '');
        console.log('[VTON] Header display:', header ? getComputedStyle(header).display : 'N/A');
        console.log('[VTON] Tabs container:', !!tabsContainer, tabsContainer ? `(${tabsContainer.offsetWidth}x${tabsContainer.offsetHeight})` : '');
        console.log('[VTON] Tabs encontradas:', tabs.length);
        console.log('[VTON] Body existe:', !!body, body ? `(${body.offsetWidth}x${body.offsetHeight})` : '');
        console.log('[VTON] Body display:', body ? getComputedStyle(body).display : 'N/A');
        console.log('[VTON] Close button:', !!closeBtn, closeBtn ? `(${closeBtn.offsetWidth}x${closeBtn.offsetHeight})` : '');
        console.log('[VTON] Primer hijo:', content.firstElementChild?.tagName);
        console.log('[VTON] Total hijos:', content.children.length);
      }

      // Verificar si hay scroll en body que pueda ocultar el modal
      const bodyStyle = getComputedStyle(document.body);
      console.log('[VTON] Body overflow:', bodyStyle.overflow);
      console.log('[VTON] HTML overflow:', getComputedStyle(document.documentElement).overflow);
    }
  }

  // Inicializar
  function init() {
    // CRÍTICO: Mover el modal al body INMEDIATAMENTE
    if (modal && modal.parentElement !== document.body) {
      console.warn('[VTON] 🚀 INIT: Modal NO está en body - MOVIENDOLO...');
      console.log('[VTON] Padre actual:', modal.parentElement?.tagName);
      document.body.appendChild(modal);
      console.log('[VTON] ✅ INIT: Modal movido a body');
    }

    // Generar/obtener IDs
    visitorId = generateVisitorId();
    shopDomain = getShopDomain();

    console.log('[VTON] Inicializado - Shop:', shopDomain, 'Visitor:', visitorId);

    // Detect theme colors for adaptive styling
    detectThemeColors();

    // DEFENSA CONTINUA: Verificar cada segundo que el modal esté en body
    setInterval(() => {
      if (modal && modal.parentElement !== document.body) {
        console.warn('[VTON] ⚠️ DEFENSA: Modal fuera de body - reubicando...');
        document.body.appendChild(modal);
        console.log('[VTON] ✅ DEFENSA: Modal reubicado en body');
      }
    }, 1000);

    // ==================== FOTO GLOBAL ====================
    globalUploadArea?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isFileDialogOpen && e.target !== globalPhotoInput) {
        isFileDialogOpen = true;
        globalPhotoInput?.click();
      }
    });
    globalUploadArea?.addEventListener('dragover', handleDragOver);
    globalUploadArea?.addEventListener('drop', handleGlobalDrop);
    globalPhotoInput?.addEventListener('change', (e) => {
      isFileDialogOpen = false;
      handleGlobalPhotoSelect(e);
    });
    globalPhotoInput?.addEventListener('cancel', () => {
      isFileDialogOpen = false;
    });
    globalPhotoChange?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isFileDialogOpen) {
        isFileDialogOpen = true;
        globalPhotoInput?.click();
      }
    });

    // Botones de apertura del modal
    document.querySelectorAll('.stilaro-vton-button').forEach(btn => {
      btn.addEventListener('click', openModal);
    });

    // Cerrar modal con botón X
    closeBtn?.addEventListener('click', closeModal);

    // Cerrar modal al hacer clic en el overlay (fondo oscuro)
    const overlay = document.querySelector('.stilaro-vton-modal-overlay');
    overlay?.addEventListener('click', closeModal);

    // Upload (Tab 1)
    uploadArea?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isFileDialogOpen && e.target !== photoInput) {
        isFileDialogOpen = true;
        photoInput?.click();
      }
    });
    uploadArea?.addEventListener('dragover', handleDragOver);
    uploadArea?.addEventListener('drop', handleDrop);
    photoInput?.addEventListener('change', (e) => {
      isFileDialogOpen = false;
      handleFileSelect(e);
    });
    photoInput?.addEventListener('cancel', () => {
      isFileDialogOpen = false;
    });

    // Acciones (Tab 1)
    tryOnBtn?.addEventListener('click', generateTryOn);
    retryBtn?.addEventListener('click', resetToUpload);
    downloadBtn?.addEventListener('click', downloadResult);
    addCartBtn?.addEventListener('click', addToCart);

    // ==================== TAB HANDLING ====================
    tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // ==================== TAB 3: SIZING ====================
    // Upload (Tab 3)
    sizingUploadArea?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isFileDialogOpen && e.target !== sizingPhotoInput) {
        isFileDialogOpen = true;
        sizingPhotoInput?.click();
      }
    });
    sizingUploadArea?.addEventListener('dragover', handleDragOver);
    sizingUploadArea?.addEventListener('drop', handleSizingDrop);
    sizingPhotoInput?.addEventListener('change', (e) => {
      isFileDialogOpen = false;
      handleSizingFileSelect(e);
    });
    sizingPhotoInput?.addEventListener('cancel', () => {
      isFileDialogOpen = false;
    });

    // Acciones (Tab 3)
    sizingContinueBtn?.addEventListener('click', showSizingForm);
    sizingAnalyzeBtn?.addEventListener('click', analyzeSizing);
    sizingRetryBtn?.addEventListener('click', () => switchTab('sizing'));
    sizingTryOnBtn?.addEventListener('click', goToTryOnWithSize);

    // Opciones de fit y talla
    initSizingOptions();

    // ==================== TAB 2: OUTFIT ====================
    // Upload (Tab 2)
    outfitUploadArea?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isFileDialogOpen && e.target !== outfitPhotoInput) {
        isFileDialogOpen = true;
        outfitPhotoInput?.click();
      }
    });
    outfitUploadArea?.addEventListener('dragover', handleDragOver);
    outfitUploadArea?.addEventListener('drop', handleOutfitDrop);
    outfitPhotoInput?.addEventListener('change', (e) => {
      isFileDialogOpen = false;
      handleOutfitFileSelect(e);
    });
    outfitPhotoInput?.addEventListener('cancel', () => {
      isFileDialogOpen = false;
    });

    // Acciones (Tab 2)
    // Ahora el flujo es: Recomendaciones → Foto → VTON
    outfitContinueBtn?.addEventListener('click', () => generateOutfitTryOn(false)); // Después de foto, generar
    skipBtn?.addEventListener('click', showOutfitPhotoUpload); // Solo esta prenda → pedir foto
    outfitTryOnBtn?.addEventListener('click', showOutfitPhotoUpload); // Probar outfit → pedir foto
    outfitRetryBtn?.addEventListener('click', () => switchTab('outfit')); // Volver a recomendaciones
    outfitDownloadBtn?.addEventListener('click', downloadOutfitResult);
    outfitAddAllBtn?.addEventListener('click', addOutfitToCart);

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal?.classList.contains('stilaro-active')) {
        closeModal();
      }
    });
  }

  // ========================================
  // TAB SWITCHING
  // ========================================
  function switchTab(tab) {
    currentTab = tab;

    // Actualizar visual de tabs
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    // Cambiar tamaño del modal según el tab
    if (modal) {
      modal.classList.remove('outfit-mode', 'sizing-mode');
      if (tab === 'outfit') modal.classList.add('outfit-mode');
      if (tab === 'sizing') modal.classList.add('sizing-mode');
    }

    // Ocultar todos los steps
    [stepUpload, stepResult, stepLoading,
     sizingUpload, sizingForm, sizingLoading, sizingResult,
     outfitUpload, outfitRecommendations, outfitLoading, outfitResult]
      .forEach(s => { if (s) s.style.display = 'none'; });

    // Mostrar step inicial del tab seleccionado
    if (tab === 'single') {
      if (stepUpload) stepUpload.style.display = 'block';
    } else if (tab === 'sizing') {
      // Tab sizing: mostrar upload de foto
      showSizingUpload();
    } else {
      // Tab outfit: mostrar RECOMENDACIONES primero (sin pedir foto)
      showOutfitRecommendations();
    }
  }

  // ========================================
  // FETCH PRODUCTS FROM SHOPIFY
  // ========================================
  async function fetchShopProducts() {
    const cacheKey = 'stilaro_products_cache';
    const cacheTime = 'stilaro_products_time';
    const TTL = 5 * 60 * 1000; // 5 minutos

    const cached = sessionStorage.getItem(cacheKey);
    const cachedTime = sessionStorage.getItem(cacheTime);

    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < TTL) {
      console.log('[VTON] Usando productos cacheados');
      return JSON.parse(cached);
    }

    try {
      console.log('[VTON] Obteniendo productos de la tienda...');
      const response = await fetch('/products.json?limit=250');
      const data = await response.json();

      // Filtrar solo productos con stock disponible
      const productsInStock = data.products.filter(product => {
        // Un producto tiene stock si alguna de sus variantes está disponible
        return product.variants && product.variants.some(variant => variant.available === true);
      });

      console.log(`[VTON] Productos con stock: ${productsInStock.length} de ${data.products.length}`);

      sessionStorage.setItem(cacheKey, JSON.stringify(productsInStock));
      sessionStorage.setItem(cacheTime, Date.now().toString());

      return productsInStock;
    } catch (error) {
      console.error('[VTON] Error obteniendo productos:', error);
      return [];
    }
  }

  // ========================================
  // TAB 2: OUTFIT FUNCTIONS
  // ========================================
  function handleOutfitDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    outfitUploadArea.style.borderColor = '#ccc';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processOutfitFile(files[0]);
    }
  }

  function handleOutfitFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      processOutfitFile(files[0]);
    }
  }

  function processOutfitFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona una imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Máximo 5MB');
      return;
    }

    // Mostrar loading INMEDIATAMENTE para evitar doble-click
    showOutfitStep(outfitLoading);
    startOutfitProgressAnimation();

    const reader = new FileReader();
    reader.onload = (e) => {
      outfitUserPhotoBase64 = e.target.result;

      // Generar VTON automáticamente
      generateOutfitTryOn(false);
    };
    reader.onerror = () => {
      stopOutfitProgressAnimation();
      showOutfitStep(outfitUpload);
      alert('Error al leer la imagen. Por favor, inténtalo de nuevo.');
    };
    reader.readAsDataURL(file);
  }

  // Mostrar paso de confirmación de outfit (después de seleccionar prendas)
  function showOutfitPhotoUpload() {
    // Si hay foto global, generar directamente
    if (globalUserPhotoBase64) {
      outfitUserPhotoBase64 = globalUserPhotoBase64;
      console.log('[VTON] Usando foto global para outfit, generando automáticamente...');
      generateOutfitTryOn(selectedOutfitItems.length === 0);
      return;
    }

    // No hay foto global, mostrar mensaje de que necesita subir foto
    showOutfitStep(outfitUpload);

    // Mostrar preview de las prendas seleccionadas
    const uploadPreview = document.getElementById('stilaro-outfit-upload-preview');
    if (uploadPreview && currentProduct) {
      let html = `<img src="${currentProduct.image}" alt="${currentProduct.title}" title="${currentProduct.title}">`;
      selectedOutfitItems.forEach(item => {
        html += `<img src="${item.image}" alt="${item.title}" title="${item.title}">`;
      });
      uploadPreview.innerHTML = html;
    }

    // Mostrar mensaje de necesita foto, ocultar botón
    const outfitNeedPhotoMsg = document.getElementById('stilaro-outfit-need-photo-msg');
    if (outfitNeedPhotoMsg) outfitNeedPhotoMsg.style.display = 'block';
    if (outfitContinueBtn) outfitContinueBtn.style.display = 'none';

    if (outfitPhotoInput) outfitPhotoInput.value = '';
    isFileDialogOpen = false;
  }

  async function showOutfitRecommendations() {
    // Mostrar step de recomendaciones DIRECTAMENTE (sin pedir foto primero)
    showOutfitStep(outfitRecommendations);

    // Reset selección
    selectedOutfitItems = [];
    updateOutfitPreview();

    // Mostrar loading
    if (recommendationsGrid) {
      recommendationsGrid.innerHTML = '<p class="stilaro-loading-text">Buscando prendas que combinen...</p>';
    }

    // Obtener productos
    if (availableProducts.length === 0) {
      availableProducts = await fetchShopProducts();
    }

    // Generar recomendaciones
    const recommendations = FashionEngine.getRecommendations(currentProduct, availableProducts);
    console.log('[VTON] Recomendaciones:', recommendations);

    renderRecommendations(recommendations);
  }

  function getRecommendationText(product, currentColor) {
    const productColor = product.color || FashionEngine.extractColor(product);
    const score = product.colorScore || 0;

    if (score >= 90) {
      return `Combinación perfecta`;
    } else if (score >= 80) {
      return `Muy buen match`;
    } else if (FashionEngine.NEUTRAL_COLORS.includes(productColor)) {
      return `Color neutro, versátil`;
    } else if (FashionEngine.NEUTRAL_COLORS.includes(currentColor)) {
      return `Añade un toque de color`;
    } else {
      return `Combina bien`;
    }
  }

  function getStyleAnalysis(product) {
    const color = FashionEngine.extractColor(product);

    // Buscar tip específico para este color
    const colorTip = FashionEngine.COLOR_TIPS[color];

    if (colorTip) {
      return colorTip.tip;
    }

    // Si no hay tip específico, usar uno genérico basado en si es neutro o no
    const isNeutral = FashionEngine.NEUTRAL_COLORS.includes(color);

    if (isNeutral) {
      return `El ${color} es un color neutro muy versátil. Combínalo con colores vivos para dar vida al look.`;
    }

    // Buscar colores que combinan bien
    const harmonies = FashionEngine.COLOR_HARMONIES[color];
    if (harmonies && harmonies.length > 0) {
      const suggestions = harmonies.slice(0, 3).join(', ');
      return `El ${color} combina especialmente bien con ${suggestions}.`;
    }

    return `Combina esta prenda con tonos neutros para un look equilibrado.`;
  }

  function renderRecommendations(recommendations) {
    const currentColor = FashionEngine.extractColor(currentProduct);
    const analysis = getStyleAnalysis(currentProduct);

    let html = `<div class="stilaro-style-analysis">${analysis}</div>`;

    Object.entries(recommendations).forEach(([category, products]) => {
      if (products.length === 0) return;

      html += `
        <div class="stilaro-recommendation-category">
          <h4>${category}</h4>
          <div class="stilaro-recommendation-items">
            ${products.map(p => {
              // Obtener el variant_id de la primera variante disponible
              const availableVariant = p.variants?.find(v => v.available) || p.variants?.[0];
              const variantId = availableVariant?.id || '';
              return `
              <div class="stilaro-recommendation-item"
                   data-product-id="${p.id}"
                   data-variant-id="${variantId}"
                   data-product-image="${p.images[0]?.src || ''}"
                   data-product-title="${p.title}"
                   data-product-type="${p.product_type}"
                   data-outfit-type="${p.outfitType}"
                   data-color-score="${p.colorScore}"
                   onclick="window.toggleOutfitItem(this)">
                <img src="${p.images[0]?.src || ''}" alt="${p.title}">
                <span class="item-title">${p.title.substring(0, 20)}${p.title.length > 20 ? '...' : ''}</span>
                <span class="item-reason">${getRecommendationText(p, currentColor)}</span>
                ${p.colorScore >= 80 ? `<span class="item-score">${p.colorScore}%</span>` : ''}
                <span class="item-check">✓</span>
              </div>
            `}).join('')}
          </div>
        </div>
      `;
    });

    if (html === '') {
      html = '<p class="stilaro-loading-text">No hay prendas complementarias disponibles</p>';
    }

    if (recommendationsGrid) {
      recommendationsGrid.innerHTML = html;
    }
  }

  // Exponer función globalmente para onclick
  window.toggleOutfitItem = function(element) {
    const productId = element.dataset.productId;
    const outfitType = element.dataset.outfitType; // Ya viene calculado

    const index = selectedOutfitItems.findIndex(p => p.id === productId);

    if (index > -1) {
      // Deseleccionar
      selectedOutfitItems.splice(index, 1);
      element.classList.remove('selected');
    } else {
      // Verificar si ya hay una prenda del mismo tipo
      const existingIndex = selectedOutfitItems.findIndex(p => p.outfitType === outfitType);

      if (existingIndex > -1) {
        // Deseleccionar la anterior del mismo tipo
        const oldId = selectedOutfitItems[existingIndex].id;
        const oldElement = document.querySelector(`.stilaro-recommendation-item[data-product-id="${oldId}"]`);
        if (oldElement) oldElement.classList.remove('selected');
        selectedOutfitItems.splice(existingIndex, 1);
      }

      // Seleccionar nueva
      selectedOutfitItems.push({
        id: productId,
        variantId: element.dataset.variantId,
        image: element.dataset.productImage,
        title: element.dataset.productTitle,
        outfitType: outfitType
      });
      element.classList.add('selected');
    }

    updateOutfitPreview();
  };

  function updateOutfitPreview() {
    if (!outfitPreview) return;

    let html = `<img src="${currentProduct.image}" alt="${currentProduct.title}" title="${currentProduct.title}">`;

    selectedOutfitItems.forEach(item => {
      html += `<img src="${item.image}" alt="${item.title}" title="${item.title}">`;
    });

    outfitPreview.innerHTML = html;

    // Actualizar texto del botón
    const total = selectedOutfitItems.length + 1;
    if (outfitTryOnBtn) {
      outfitTryOnBtn.textContent = `Probar outfit (${total} ${total === 1 ? 'prenda' : 'prendas'})`;
    }
  }

  async function generateOutfitTryOn(skipRecommendations) {
    if (!outfitUserPhotoBase64 || !currentProduct) {
      // Si no hay foto, volver al upload
      stopOutfitProgressAnimation();
      showOutfitStep(outfitUpload);
      return;
    }

    // Mostrar loading (si no está ya visible)
    if (outfitRecommendations) outfitRecommendations.style.display = 'none';
    if (outfitUpload) outfitUpload.style.display = 'none';
    if (outfitLoading) outfitLoading.style.display = 'block';

    // Solo iniciar animación si no está ya en progreso
    if (!outfitProgressInterval) {
      startOutfitProgressAnimation();
    }

    try {
      // Construir array de imágenes
      const productImages = [currentProduct.image];
      if (!skipRecommendations) {
        selectedOutfitItems.forEach(item => {
          if (item.image) productImages.push(item.image);
        });
      }

      console.log('[VTON Outfit] Generando con', productImages.length, 'prendas');

      const payload = {
        userPhoto: outfitUserPhotoBase64,
        productId: currentProduct.id,
        productImage: currentProduct.image,
        productImages: productImages,
        outfitMode: productImages.length > 1,
        shopDomain: shopDomain,
        visitorId: visitorId
      };

      const response = await fetch(CONFIG.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.supabaseKey}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.status === 429) {
        stopOutfitProgressAnimation();
        showOutfitStep(outfitUpload);
        alert(data.error || 'Has alcanzado el límite de pruebas');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar');
      }

      if (data.resultImage) {
        if (outfitResultImage) outfitResultImage.src = data.resultImage;

        // Mostrar lista de prendas del outfit
        renderOutfitItemsList(skipRecommendations);

        stopOutfitProgressAnimation();
        showOutfitStep(outfitResult);
      } else {
        throw new Error('No se recibió imagen');
      }

    } catch (error) {
      console.error('[VTON Outfit] Error:', error);
      stopOutfitProgressAnimation();
      alert('Error al generar. Por favor, inténtalo de nuevo.');
      resetToOutfitUpload();
    }
  }

  function renderOutfitItemsList(skipRecommendations) {
    if (!outfitItemsList) return;

    let html = `
      <div class="outfit-item">
        <img src="${currentProduct.image}" alt="${currentProduct.title}">
        <span>${currentProduct.title.substring(0, 15)}...</span>
      </div>
    `;

    if (!skipRecommendations) {
      selectedOutfitItems.forEach(item => {
        html += `
          <div class="outfit-item">
            <img src="${item.image}" alt="${item.title}">
            <span>${item.title.substring(0, 15)}...</span>
          </div>
        `;
      });
    }

    outfitItemsList.innerHTML = html;
  }

  function showOutfitStep(step) {
    [outfitUpload, outfitRecommendations, outfitLoading, outfitResult]
      .forEach(s => { if (s) s.style.display = 'none'; });
    if (step) step.style.display = 'block';
  }

  function resetToOutfitUpload() {
    selectedOutfitItems = [];

    const outfitNeedPhotoMsg = document.getElementById('stilaro-outfit-need-photo-msg');

    // Si hay foto global, usarla
    if (globalUserPhotoBase64) {
      outfitUserPhotoBase64 = globalUserPhotoBase64;
      if (outfitNeedPhotoMsg) outfitNeedPhotoMsg.style.display = 'none';
      if (outfitContinueBtn) outfitContinueBtn.style.display = 'block';
    } else {
      outfitUserPhotoBase64 = null;
      if (outfitNeedPhotoMsg) outfitNeedPhotoMsg.style.display = 'block';
      if (outfitContinueBtn) outfitContinueBtn.style.display = 'none';
    }

    if (outfitPhotoInput) outfitPhotoInput.value = '';
    showOutfitStep(outfitUpload);
  }

  // Progress animation para outfit
  let outfitProgressInterval = null;
  let outfitCurrentProgress = 0;

  function startOutfitProgressAnimation() {
    outfitCurrentProgress = 0;
    if (outfitProgressFill) outfitProgressFill.style.width = '0%';
    if (outfitProgressText) outfitProgressText.textContent = '0%';

    // Iniciar tips de moda
    startFashionTips('stilaro-tip-text');

    // Incremento constante: 95% en ~25 segundos (125 intervalos de 200ms)
    // 95 / 125 = 0.76% por intervalo
    outfitProgressInterval = setInterval(() => {
      if (outfitCurrentProgress < 95) {
        outfitCurrentProgress += 0.76;
      }

      outfitCurrentProgress = Math.min(outfitCurrentProgress, 95);

      if (outfitProgressFill) outfitProgressFill.style.width = outfitCurrentProgress + '%';
      if (outfitProgressText) outfitProgressText.textContent = Math.floor(outfitCurrentProgress) + '%';
    }, 200);
  }

  function stopOutfitProgressAnimation() {
    if (outfitProgressInterval) {
      clearInterval(outfitProgressInterval);
      outfitProgressInterval = null;
    }
    // Detener tips de moda
    stopFashionTips();

    outfitCurrentProgress = 100;
    if (outfitProgressFill) outfitProgressFill.style.width = '100%';
    if (outfitProgressText) outfitProgressText.textContent = '100%';
  }

  function downloadOutfitResult() {
    if (!outfitResultImage || !outfitResultImage.src) return;

    const link = document.createElement('a');
    link.href = outfitResultImage.src;
    link.download = `stilaro-outfit-${currentProduct?.id || 'resultado'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function addOutfitToCart() {
    if (!currentProduct || !currentProduct.variantId) {
      console.error('[VTON] No hay producto o variantId');
      alert('Error: No se pudo añadir al carrito');
      return;
    }

    // Añadir todas las prendas del outfit usando variantId
    const items = [{ id: parseInt(currentProduct.variantId), quantity: 1 }];

    selectedOutfitItems.forEach(item => {
      if (item.variantId) {
        items.push({ id: parseInt(item.variantId), quantity: 1 });
      }
    });

    console.log('[VTON] Añadiendo al carrito:', items);

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Error en la respuesta del servidor');
        }
        return response.json();
      })
      .then(data => {
        console.log('[VTON] Añadido al carrito:', data);
        closeModal();
        window.location.href = '/cart';
      })
      .catch(error => {
        console.error('[VTON] Error adding outfit to cart:', error);
        alert('Error al añadir al carrito. Por favor, inténtalo de nuevo.');
      });
  }

  // ========================================
  // TAB 3: SIZING FUNCTIONS
  // ========================================

  // Offsets de tipo de tienda (positivo = talla pequeña, pedir más grande)
  const BRAND_OFFSETS = {
    'grandes_almacenes': 0,
    'moda_economica': -0.3,
    'moda_estandar': 0,
    'moda_joven': 0,
    'moda_premium': 0.5,
    'moda_asiatica': -0.5,
    'deportivo': -0.3,
    'other': 0
  };

  const SIZE_SCALE = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

  function initSizingOptions() {
    // Opciones de fit
    const fitOptions = document.querySelectorAll('#stilaro-sizing-fit .stilaro-sizing-option');
    fitOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        fitOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        sizingData.fit_preference = opt.dataset.value;
      });
    });

    // Opciones de talla de referencia
    const sizeOptions = document.querySelectorAll('#stilaro-sizing-reference .stilaro-sizing-option');
    sizeOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        sizeOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        sizingData.reference_size = opt.dataset.value;
      });
    });

    // Select de marca
    const brandSelect = document.getElementById('stilaro-sizing-brand');
    brandSelect?.addEventListener('change', (e) => {
      sizingData.reference_brand = e.target.value;
    });

    // Input de altura
    const heightInput = document.getElementById('stilaro-sizing-height');
    heightInput?.addEventListener('change', (e) => {
      sizingData.height = e.target.value ? parseInt(e.target.value) : null;
    });
  }

  function handleSizingDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    sizingUploadArea.style.borderColor = '#ccc';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processSizingFile(files[0]);
    }
  }

  function handleSizingFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      processSizingFile(files[0]);
    }
  }

  function processSizingFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona una imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Máximo 5MB');
      return;
    }

    // Ocultar area de upload INMEDIATAMENTE para evitar doble-click
    if (sizingUploadArea) sizingUploadArea.style.display = 'none';

    const reader = new FileReader();
    reader.onload = (e) => {
      sizingUserPhotoBase64 = e.target.result;

      if (sizingUserPreview) {
        sizingUserPreview.src = sizingUserPhotoBase64;
        sizingUserPreview.style.display = 'block';
      }

      if (sizingContinueBtn) sizingContinueBtn.style.display = 'block';
    };
    reader.onerror = () => {
      // Restaurar area de upload en caso de error
      if (sizingUploadArea) sizingUploadArea.style.display = 'block';
      alert('Error al leer la imagen. Por favor, inténtalo de nuevo.');
    };
    reader.readAsDataURL(file);
  }

  function showSizingUpload() {
    // Reset analysis pero mantener foto si hay global
    sizingData.analysis = null;

    const sizingNeedPhotoMsg = document.getElementById('stilaro-sizing-need-photo-msg');

    // Si hay foto global, usarla
    if (globalUserPhotoBase64) {
      sizingUserPhotoBase64 = globalUserPhotoBase64;
      if (sizingNeedPhotoMsg) sizingNeedPhotoMsg.style.display = 'none';
      if (sizingContinueBtn) sizingContinueBtn.style.display = 'block';
    } else {
      sizingUserPhotoBase64 = null;
      if (sizingNeedPhotoMsg) sizingNeedPhotoMsg.style.display = 'block';
      if (sizingContinueBtn) sizingContinueBtn.style.display = 'none';
    }

    if (sizingPhotoInput) sizingPhotoInput.value = '';

    // Mostrar info del producto
    if (sizingProductImage && currentProduct) sizingProductImage.src = currentProduct.image;
    if (sizingProductTitle && currentProduct) sizingProductTitle.textContent = currentProduct.title;

    showSizingStep(sizingUpload);
  }

  function showSizingForm() {
    showSizingStep(sizingForm);
  }

  function showSizingStep(step) {
    [sizingUpload, sizingForm, sizingLoading, sizingResult]
      .forEach(s => { if (s) s.style.display = 'none'; });
    if (step) step.style.display = 'block';
  }

  // Progress animation para sizing
  let sizingProgressInterval = null;
  let sizingCurrentProgress = 0;

  function startSizingProgressAnimation() {
    sizingCurrentProgress = 0;
    if (sizingProgressFill) sizingProgressFill.style.width = '0%';
    if (sizingProgressText) sizingProgressText.textContent = '0%';

    sizingProgressInterval = setInterval(() => {
      if (sizingCurrentProgress < 70) {
        sizingCurrentProgress += Math.random() * 8 + 3;
      } else if (sizingCurrentProgress < 90) {
        sizingCurrentProgress += Math.random() * 3 + 1;
      } else if (sizingCurrentProgress < 95) {
        sizingCurrentProgress += Math.random() * 1;
      }

      sizingCurrentProgress = Math.min(sizingCurrentProgress, 95);

      if (sizingProgressFill) sizingProgressFill.style.width = sizingCurrentProgress + '%';
      if (sizingProgressText) sizingProgressText.textContent = Math.floor(sizingCurrentProgress) + '%';
    }, 150);
  }

  function stopSizingProgressAnimation() {
    if (sizingProgressInterval) {
      clearInterval(sizingProgressInterval);
      sizingProgressInterval = null;
    }
    sizingCurrentProgress = 100;
    if (sizingProgressFill) sizingProgressFill.style.width = '100%';
    if (sizingProgressText) sizingProgressText.textContent = '100%';
  }

  async function analyzeSizing() {
    if (!sizingUserPhotoBase64) {
      alert('Por favor, sube una foto primero');
      return;
    }

    showSizingStep(sizingLoading);
    startSizingProgressAnimation();

    try {
      // Llamar al endpoint de análisis de tallas
      const payload = {
        userPhoto: sizingUserPhotoBase64,
        height: sizingData.height,
        fit_preference: sizingData.fit_preference,
        reference_brand: sizingData.reference_brand,
        reference_size: sizingData.reference_size,
        productType: currentProduct?.product_type || '',
        shopDomain: shopDomain,
        visitorId: visitorId,
        action: 'analyze_sizing'
      };

      const response = await fetch(CONFIG.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.supabaseKey}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al analizar');
      }

      sizingData.analysis = data.analysis;
      stopSizingProgressAnimation();
      showSizingResult(data);

    } catch (error) {
      console.error('[Sizing] Error:', error);
      stopSizingProgressAnimation();

      // Fallback: calcular talla sin IA
      const fallbackResult = calculateSizingFallback();
      sizingData.analysis = fallbackResult.analysis;
      showSizingResult(fallbackResult);
    }
  }

  function calculateSizingFallback() {
    // Cálculo sin IA basado en los datos del formulario
    const brandOffset = BRAND_OFFSETS[sizingData.reference_brand] || 0;
    const fitOffset = sizingData.fit_preference === 'ajustado' ? -0.5 :
                      sizingData.fit_preference === 'holgado' ? 0.5 : 0;

    // Ajuste por altura si está disponible
    let heightOffset = 0;
    if (sizingData.height) {
      if (sizingData.height < 165) heightOffset = -0.5;
      else if (sizingData.height > 185) heightOffset = 0.5;
    }

    const totalOffset = brandOffset + fitOffset + heightOffset;
    const currentIndex = SIZE_SCALE.indexOf(sizingData.reference_size);
    let recommendedIndex = Math.round(currentIndex + totalOffset);
    recommendedIndex = Math.max(0, Math.min(SIZE_SCALE.length - 1, recommendedIndex));

    const recommendedSize = SIZE_SCALE[recommendedIndex];

    // Calcular talla alternativa
    let altIndex = totalOffset > 0 ? recommendedIndex + 1 : recommendedIndex - 1;
    altIndex = Math.max(0, Math.min(SIZE_SCALE.length - 1, altIndex));
    const altSize = SIZE_SCALE[altIndex];

    return {
      analysis: {
        body_type: 'medio',
        shoulder_width: 'medio',
        torso_length: 'medio',
        fit_adjustment: totalOffset,
        confidence: 0.6
      },
      recommendedSize,
      altSize,
      confidence: 0.6,
      brandOffset,
      fitOffset,
      heightOffset
    };
  }

  function showSizingResult(data) {
    // Calcular talla recomendada
    let recommendedSize, altSize, confidence;

    if (data.recommendedSize) {
      // Si viene del servidor
      recommendedSize = data.recommendedSize;
      altSize = data.altSize;
      confidence = data.confidence || 0.7;
    } else {
      // Calcular desde analysis
      const analysis = data.analysis || sizingData.analysis;
      const brandOffset = BRAND_OFFSETS[sizingData.reference_brand] || 0;
      const fitOffset = sizingData.fit_preference === 'ajustado' ? -0.5 :
                        sizingData.fit_preference === 'holgado' ? 0.5 : 0;
      const aiOffset = analysis?.fit_adjustment || 0;

      let heightOffset = 0;
      if (sizingData.height) {
        if (sizingData.height < 165) heightOffset = -0.5;
        else if (sizingData.height > 185) heightOffset = 0.5;
      }

      const totalOffset = brandOffset + fitOffset + aiOffset + heightOffset;
      const currentIndex = SIZE_SCALE.indexOf(sizingData.reference_size);
      let recommendedIndex = Math.round(currentIndex + totalOffset);
      recommendedIndex = Math.max(0, Math.min(SIZE_SCALE.length - 1, recommendedIndex));

      recommendedSize = SIZE_SCALE[recommendedIndex];

      // Talla alternativa
      let altIndex = totalOffset > 0 ? recommendedIndex + 1 : recommendedIndex - 1;
      altIndex = Math.max(0, Math.min(SIZE_SCALE.length - 1, altIndex));
      altSize = SIZE_SCALE[altIndex];

      confidence = analysis?.confidence || 0.6;
    }

    // Mostrar talla recomendada
    if (recommendedSizeEl) recommendedSizeEl.textContent = recommendedSize;

    // Mostrar talla alternativa
    if (altSizeEl) {
      if (altSize !== recommendedSize) {
        altSizeEl.textContent = `También podrías usar ${altSize}`;
        altSizeEl.style.display = 'block';
      } else {
        altSizeEl.style.display = 'none';
      }
    }

    // Mostrar confianza
    const confPercent = Math.round(confidence * 100);
    let confLevel = 'high';
    let confText = 'Alta';
    if (confidence < 0.5) {
      confLevel = 'low';
      confText = 'Baja';
    } else if (confidence < 0.75) {
      confLevel = 'medium';
      confText = 'Media';
    }

    if (confidenceFill) {
      confidenceFill.style.width = confPercent + '%';
      confidenceFill.className = 'confidence-fill' + (confLevel !== 'high' ? ' ' + confLevel : '');
    }
    if (confidenceText) {
      confidenceText.textContent = confText;
      confidenceText.className = 'confidence-text' + (confLevel !== 'high' ? ' ' + confLevel : '');
    }

    // Mostrar detalles del análisis
    if (sizingDetails && data.analysis) {
      const analysis = data.analysis;
      sizingDetails.innerHTML = `
        <p><span>Complexión:</span> <strong>${translateBodyType(analysis.body_type)}</strong></p>
        <p><span>Hombros:</span> <strong>${translateWidth(analysis.shoulder_width)}</strong></p>
        <p><span>Tu preferencia:</span> <strong>${sizingData.fit_preference}</strong></p>
        <p><span>Marca referencia:</span> <strong>${sizingData.reference_brand.replace('_', ' ')}</strong></p>
      `;
    }

    // Mostrar tip
    if (sizingTip) {
      const tips = getSizingTip(recommendedSize, sizingData, data.analysis);
      sizingTip.textContent = tips;
    }

    showSizingStep(sizingResult);
  }

  function translateBodyType(type) {
    const translations = {
      'delgado': 'Delgado',
      'atletico': 'Atlético',
      'medio': 'Medio',
      'robusto': 'Robusto',
      'corpulento': 'Corpulento'
    };
    return translations[type] || type || 'Medio';
  }

  function translateWidth(width) {
    const translations = {
      'estrecho': 'Estrecho',
      'medio': 'Medio',
      'ancho': 'Ancho'
    };
    return translations[width] || width || 'Medio';
  }

  function getSizingTip(size, userData, analysis) {
    const brand = userData.reference_brand;
    const fit = userData.fit_preference;

    // Tips específicos según marca
    if (brand === 'uniqlo' || brand === 'nike' || brand === 'adidas') {
      return `${brand.charAt(0).toUpperCase() + brand.slice(1)} tiende a tallar grande. Si entre dos tallas dudas, quédate con la más pequeña.`;
    }

    if (brand === 'massimo_dutti') {
      return `Massimo Dutti suele tallar más ajustado. Si prefieres comodidad, esta talla ${size} te irá bien.`;
    }

    // Tips según preferencia de fit
    if (fit === 'ajustado') {
      return `Para un ajuste ceñido, la talla ${size} debería quedarte perfecta. Revisa las medidas si la prenda es muy entallada.`;
    }

    if (fit === 'holgado') {
      return `Con la talla ${size} conseguirás ese look más relajado que buscas sin que te quede excesivamente grande.`;
    }

    // Tip genérico
    return `Basándonos en tu complexión y preferencias, la talla ${size} debería sentarte bien. ¡Pruébatela virtualmente!`;
  }

  function goToTryOnWithSize() {
    // Guardar la foto de sizing para usarla en el probador
    if (sizingUserPhotoBase64) {
      userPhotoBase64 = sizingUserPhotoBase64;

      // Mostrar preview
      if (userPreview) {
        userPreview.src = userPhotoBase64;
        userPreview.style.display = 'block';
      }
      if (uploadArea) uploadArea.style.display = 'none';
      if (tryOnBtn) tryOnBtn.style.display = 'block';
    }

    // Cambiar a tab de probador
    switchTab('single');
  }

  function resetSizingState() {
    sizingData = {
      height: null,
      fit_preference: 'regular',
      reference_brand: 'grandes_almacenes',
      reference_size: 'M',
      analysis: null
    };

    const sizingNeedPhotoMsg = document.getElementById('stilaro-sizing-need-photo-msg');

    // Si hay foto global, usarla
    if (globalUserPhotoBase64) {
      sizingUserPhotoBase64 = globalUserPhotoBase64;
      if (sizingNeedPhotoMsg) sizingNeedPhotoMsg.style.display = 'none';
      if (sizingContinueBtn) sizingContinueBtn.style.display = 'block';
    } else {
      sizingUserPhotoBase64 = null;
      if (sizingNeedPhotoMsg) sizingNeedPhotoMsg.style.display = 'block';
      if (sizingContinueBtn) sizingContinueBtn.style.display = 'none';
    }

    if (sizingPhotoInput) sizingPhotoInput.value = '';

    // Reset form values
    const heightInput = document.getElementById('stilaro-sizing-height');
    if (heightInput) heightInput.value = '';

    const brandSelect = document.getElementById('stilaro-sizing-brand');
    if (brandSelect) brandSelect.value = 'grandes_almacenes';

    // Reset fit options
    const fitOptions = document.querySelectorAll('#stilaro-sizing-fit .stilaro-sizing-option');
    fitOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.value === 'regular');
    });

    // Reset size options
    const sizeOptions = document.querySelectorAll('#stilaro-sizing-reference .stilaro-sizing-option');
    sizeOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.value === 'M');
    });
  }

  async function openModal(e) {
    const btn = e.currentTarget;
    currentProduct = {
      id: btn.dataset.productId,
      variantId: btn.dataset.variantId,
      title: btn.dataset.productTitle,
      image: btn.dataset.productImage,
      price: btn.dataset.productPrice,
      product_type: btn.dataset.productType || ''
    };

    // Mostrar info del producto (Tab 1)
    if (productImage) productImage.src = currentProduct.image;
    if (productTitle) productTitle.textContent = currentProduct.title;

    // Mostrar info del producto (Tab 2)
    if (outfitProductImage) outfitProductImage.src = currentProduct.image;
    if (outfitProductTitle) outfitProductTitle.textContent = currentProduct.title;

    // Mostrar info del producto (Tab 3 - Sizing)
    if (sizingProductImage) sizingProductImage.src = currentProduct.image;
    if (sizingProductTitle) sizingProductTitle.textContent = currentProduct.title;

    // Reset estado visual de todas las pestañas
    resetToUpload();
    resetSizingState();
    resetToOutfitUpload();

    // Reset a tab 1
    currentTab = 'single';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'single'));

    // Mostrar modal centrado (sin bloquear scroll de la página)
    if (modal) {
      modal.classList.add('stilaro-active');

      // Posicionar modal sobre el botón
      positionModalOverButton(btn);
    }

    // Re-detect theme colors in case styles loaded dynamically
    detectThemeColors();

    // Ocultar todos los steps excepto el de upload tab 1
    [stepResult, stepLoading,
     sizingUpload, sizingForm, sizingLoading, sizingResult,
     outfitUpload, outfitRecommendations, outfitLoading, outfitResult]
      .forEach(s => { if (s) s.style.display = 'none'; });
    if (stepUpload) stepUpload.style.display = 'block';

    // Verificar estado de la tienda
    shopStatus = await checkShopStatus();

    if (!shopStatus.active) {
      // Tienda no activa o limite alcanzado
      showDisabledState(shopStatus.message, shopStatus.reason);
    } else {
      // Tienda activa, mostrar estado habilitado
      showEnabledState(shopStatus);
    }

    // DEFENSA CONTINUA: MutationObserver para proteger z-index del modal
    const zIndexObserver = new MutationObserver(() => {
      // Proteger z-index del modal
      const modalZ = parseInt(getComputedStyle(modal).zIndex);
      if (isNaN(modalZ) || modalZ < 2147483647) {
        modal.style.setProperty('z-index', '2147483647', 'important');
        console.log('[VTON] 🛡️ Z-index del modal restaurado a máximo');
      }

      // Reducir z-index de elementos externos que intenten subir (MEGA-AGRESIVO)
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        if (el.id !== 'stilaro-vton-modal' && !modal.contains(el)) {
          const z = parseInt(getComputedStyle(el).zIndex);
          // Resetear CUALQUIER z-index >= 1
          if (!isNaN(z) && z >= 1) {
            el.style.setProperty('z-index', 'auto', 'important');
            console.log('[VTON] 🛡️ Z-index externo reseteado a auto:', el.tagName);
          }
        }
      });
    });

    // Observar cambios en todo el documento
    zIndexObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      subtree: true,
      childList: true
    });

    // Guardar observer para poder desconectarlo al cerrar
    if (!window.stilaroZIndexObserver) {
      window.stilaroZIndexObserver = zIndexObserver;
    }
  }

  function closeModal() {
    if (modal) {
      modal.classList.remove('stilaro-active');
      // Limpiar estilos inline de respaldo
      modal.style.display = '';
    }

    // Desconectar observer de z-index
    if (window.stilaroZIndexObserver) {
      window.stilaroZIndexObserver.disconnect();
      window.stilaroZIndexObserver = null;
      console.log('[VTON] 🛡️ Z-index observer desconectado');
    }

    // Resetear foto global y todas las individuales
    resetGlobalPhoto();
    shopStatus = null;
    isFileDialogOpen = false;
  }

  // ========================================
  // FOTO GLOBAL - Funciones
  // ========================================
  function handleGlobalDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (globalUploadArea) globalUploadArea.style.borderStyle = 'solid';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processGlobalPhoto(files[0]);
    }
  }

  function handleGlobalPhotoSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      processGlobalPhoto(files[0]);
    }
  }

  function processGlobalPhoto(file) {
    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona una imagen');
      return;
    }

    // Validar tamano (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Máximo 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      globalUserPhotoBase64 = e.target.result;

      // Sincronizar con las 3 pestañas
      userPhotoBase64 = globalUserPhotoBase64;
      outfitUserPhotoBase64 = globalUserPhotoBase64;
      sizingUserPhotoBase64 = globalUserPhotoBase64;

      // Mostrar preview global
      if (globalPhotoImg) {
        globalPhotoImg.src = globalUserPhotoBase64;
      }
      if (globalUploadArea) globalUploadArea.style.display = 'none';
      if (globalPhotoPreview) globalPhotoPreview.style.display = 'flex';

      // Ocultar zonas de upload individuales y mostrar previews
      updateTabsWithGlobalPhoto();

      console.log('[VTON] Foto global cargada y sincronizada con todas las pestañas');
    };
    reader.onerror = () => {
      alert('Error al leer la imagen. Por favor, inténtalo de nuevo.');
    };
    reader.readAsDataURL(file);
  }

  function updateTabsWithGlobalPhoto() {
    // Mensajes de "necesita foto"
    const needPhotoMsg = document.getElementById('stilaro-need-photo-msg');
    const sizingNeedPhotoMsg = document.getElementById('stilaro-sizing-need-photo-msg');
    const outfitNeedPhotoMsg = document.getElementById('stilaro-outfit-need-photo-msg');

    // Tab 1: Single - Ocultar mensaje, mostrar botón
    if (needPhotoMsg) needPhotoMsg.style.display = 'none';
    if (tryOnBtn) tryOnBtn.style.display = 'block';
    hideUsageInfo();

    // Tab 2: Outfit - Ocultar mensaje, mostrar botón
    if (outfitNeedPhotoMsg) outfitNeedPhotoMsg.style.display = 'none';
    if (outfitContinueBtn) outfitContinueBtn.style.display = 'block';

    // Tab 3: Sizing - Ocultar mensaje, mostrar botón
    if (sizingNeedPhotoMsg) sizingNeedPhotoMsg.style.display = 'none';
    if (sizingContinueBtn) sizingContinueBtn.style.display = 'block';

    console.log('[VTON] Foto global aplicada a todas las pestañas');
  }

  function resetGlobalPhoto() {
    globalUserPhotoBase64 = null;
    userPhotoBase64 = null;
    outfitUserPhotoBase64 = null;
    sizingUserPhotoBase64 = null;

    // Mostrar upload global, ocultar preview
    if (globalUploadArea) globalUploadArea.style.display = 'block';
    if (globalPhotoPreview) globalPhotoPreview.style.display = 'none';

    // Mensajes de "necesita foto"
    const needPhotoMsg = document.getElementById('stilaro-need-photo-msg');
    const sizingNeedPhotoMsg = document.getElementById('stilaro-sizing-need-photo-msg');
    const outfitNeedPhotoMsg = document.getElementById('stilaro-outfit-need-photo-msg');

    // Tab 1: Mostrar mensaje, ocultar botón
    if (needPhotoMsg) needPhotoMsg.style.display = 'block';
    if (tryOnBtn) tryOnBtn.style.display = 'none';

    // Tab 2: Mostrar mensaje, ocultar botón
    if (outfitNeedPhotoMsg) outfitNeedPhotoMsg.style.display = 'block';
    if (outfitContinueBtn) outfitContinueBtn.style.display = 'none';

    // Tab 3: Mostrar mensaje, ocultar botón
    if (sizingNeedPhotoMsg) sizingNeedPhotoMsg.style.display = 'block';
    if (sizingContinueBtn) sizingContinueBtn.style.display = 'none';
  }

  // ========================================
  // DRAG & DROP - Tab 1 Single
  // ========================================
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.style.borderColor = '#000';
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.style.borderColor = '#ccc';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }

  function processFile(file) {
    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona una imagen');
      return;
    }

    // Validar tamano (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Maximo 5MB');
      return;
    }

    // Ocultar area de upload INMEDIATAMENTE para evitar doble-click
    if (uploadArea) uploadArea.style.display = 'none';

    const reader = new FileReader();
    reader.onload = (e) => {
      userPhotoBase64 = e.target.result;

      // Mostrar preview
      if (userPreview) {
        userPreview.src = userPhotoBase64;
        userPreview.style.display = 'block';
      }

      hideUsageInfo();
      if (tryOnBtn) tryOnBtn.style.display = 'block';
    };
    reader.onerror = () => {
      // Restaurar area de upload en caso de error
      if (uploadArea) uploadArea.style.display = 'block';
      alert('Error al leer la imagen. Por favor, inténtalo de nuevo.');
    };
    reader.readAsDataURL(file);
  }

  function showStep(step) {
    [stepUpload, stepResult, stepLoading].forEach(s => {
      if (s) s.style.display = 'none';
    });
    if (step) step.style.display = 'block';
  }

  async function generateTryOn() {
    if (!userPhotoBase64 || !currentProduct) return;

    showStep(stepLoading);
    startProgressAnimation();

    try {
      const payload = {
        userPhoto: userPhotoBase64,
        productId: currentProduct.id,
        productImage: currentProduct.image,
        shopDomain: shopDomain,
        visitorId: visitorId
      };

      console.log('[VTON] Enviando request...');
      console.log('[VTON] Shop:', shopDomain);
      console.log('[VTON] Visitor:', visitorId);
      console.log('[VTON] Product:', currentProduct.id);

      const response = await fetch(CONFIG.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.supabaseKey}`
        },
        body: JSON.stringify(payload)
      });

      console.log('[VTON] Response status:', response.status);

      const data = await response.json();

      // Manejar limites alcanzados (status 429)
      if (response.status === 429) {
        console.log('[VTON] Limite alcanzado:', data);
        stopProgressAnimation();
        showStep(stepUpload);
        showDisabledState(data.error, data.code);
        return;
      }

      if (!response.ok) {
        console.error('[VTON] Error response:', data);
        throw new Error(data.error || 'Error al generar la prueba virtual');
      }

      console.log('[VTON] Exito! Uso:', data.usage);

      if (data.resultImage) {
        if (resultImage) resultImage.src = data.resultImage;
        stopProgressAnimation();
        showStep(stepResult);

        // Mostrar info de uso si quieres (opcional)
        if (data.usage) {
          console.log(`[VTON] Usos hoy: ${data.usage.visitor_uses_today}`);
          console.log(`[VTON] Usos ciclo: ${data.usage.uses_this_cycle}/${data.usage.included_uses}`);
        }
      } else {
        throw new Error('No se recibio la imagen resultado');
      }

    } catch (error) {
      console.error('VTON Error:', error);
      stopProgressAnimation();
      alert('Hubo un error al generar la prueba virtual. Por favor, intentalo de nuevo.');
      resetToUpload();
    }
  }

  function resetToUpload() {
    // Ocultar mensaje de estado
    const statusMsg = document.getElementById('stilaro-status-message');
    if (statusMsg) {
      statusMsg.style.display = 'none';
    }

    const needPhotoMsg = document.getElementById('stilaro-need-photo-msg');

    // Si hay foto global, usarla
    if (globalUserPhotoBase64) {
      userPhotoBase64 = globalUserPhotoBase64;
      if (needPhotoMsg) needPhotoMsg.style.display = 'none';
      if (tryOnBtn) tryOnBtn.style.display = 'block';
    } else {
      userPhotoBase64 = null;
      if (needPhotoMsg) needPhotoMsg.style.display = 'block';
      if (tryOnBtn) tryOnBtn.style.display = 'none';
    }

    if (photoInput) photoInput.value = '';
    hideUsageInfo();
    showStep(stepUpload);
  }

  function addToCart() {
    if (!currentProduct || !currentProduct.variantId) {
      console.error('[VTON] No hay producto o variantId');
      alert('Error: No se pudo añadir al carrito');
      return;
    }

    // Usar la API de Shopify para anadir al carrito con variantId
    const formData = {
      items: [{
        id: parseInt(currentProduct.variantId),
        quantity: 1
      }]
    };

    console.log('[VTON] Añadiendo al carrito:', formData);

    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Error en la respuesta del servidor');
        }
        return response.json();
      })
      .then(data => {
        console.log('[VTON] Añadido al carrito:', data);
        closeModal();
        window.location.href = '/cart';
      })
      .catch(error => {
        console.error('[VTON] Error adding to cart:', error);
        alert('Error al añadir al carrito. Por favor, inténtalo de nuevo.');
      });
  }

  // Animacion de progreso
  let progressInterval = null;
  let currentProgress = 0;

  function startProgressAnimation() {
    currentProgress = 0;
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';

    // Iniciar tips de moda
    startFashionTips('stilaro-tip-text-single');

    // Incremento constante: 95% en ~25 segundos (125 intervalos de 200ms)
    // 95 / 125 = 0.76% por intervalo
    progressInterval = setInterval(() => {
      if (currentProgress < 95) {
        currentProgress += 0.76;
      }

      currentProgress = Math.min(currentProgress, 95);

      if (progressFill) progressFill.style.width = currentProgress + '%';
      if (progressText) progressText.textContent = Math.floor(currentProgress) + '%';
    }, 200);
  }

  function stopProgressAnimation() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    // Detener tips de moda
    stopFashionTips();

    // Completar la barra
    currentProgress = 100;
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = '100%';
  }

  // Descargar imagen resultado
  function downloadResult() {
    if (!resultImage || !resultImage.src) return;

    const link = document.createElement('a');
    link.href = resultImage.src;
    link.download = `stilaro-vton-${currentProduct?.id || 'resultado'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Iniciar cuando el DOM este listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
