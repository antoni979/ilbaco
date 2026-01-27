/**
 * Stilaro Virtual Try-On Modal
 * Conecta con Supabase Edge Function para generar pruebas virtuales
 * Incluye sistema de control de uso por visitante
 */

(function () {
  'use strict';

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

  // Estado para outfit (Tab 2)
  let currentTab = 'single'; // 'single' o 'outfit'
  let outfitUserPhotoBase64 = null;
  let selectedOutfitItems = []; // Prendas seleccionadas para el outfit
  let availableProducts = []; // Cache de productos de la tienda

  // ========================================
  // MOTOR DE RECOMENDACIONES DE MODA
  // ========================================
  const FashionEngine = {
    // Mapeo de categorías a tipo de outfit
    CATEGORY_MAP: {
      'Abrigo': 'OUTERWEAR',
      'Abrigos': 'OUTERWEAR',
      'Chaqueta': 'OUTERWEAR',
      'Chaquetas': 'OUTERWEAR',
      'Jersey': 'TOP',
      'Jerseys': 'TOP',
      'Blusa': 'TOP',
      'Blusas y Tops': 'TOP',
      'Camiseta': 'TOP',
      'Camisa': 'TOP',
      'Sudadera': 'TOP',
      'Top': 'TOP',
      'Pantalón': 'BOTTOM',
      'Pantalones': 'BOTTOM',
      'Falda': 'BOTTOM',
      'Shorts': 'BOTTOM',
      'Calzado': 'SHOES',
      'Vestido': 'DRESS',
      'Vestidos': 'DRESS',
      'Accesorios': 'ACCESSORY'
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

    // Colores neutros
    NEUTRAL_COLORS: [
      'negro', 'blanco', 'gris', 'beige', 'crema', 'azul marino',
      'camel', 'marron', 'marrón', 'piedra', 'natural', 'nude'
    ],

    // Combinaciones clásicas
    COLOR_HARMONIES: {
      'negro': ['blanco', 'gris', 'rojo', 'beige', 'crema', 'dorado', 'azul'],
      'blanco': ['negro', 'azul', 'azul marino', 'beige', 'rosa', 'rojo'],
      'azul marino': ['blanco', 'beige', 'crema', 'rojo', 'rosa'],
      'azul': ['blanco', 'beige', 'gris', 'marron', 'camel'],
      'gris': ['rosa', 'negro', 'blanco', 'azul', 'rojo', 'amarillo'],
      'beige': ['blanco', 'azul marino', 'marron', 'negro', 'verde', 'azul'],
      'rojo': ['negro', 'blanco', 'azul marino', 'gris', 'beige'],
      'verde': ['beige', 'marron', 'crema', 'blanco', 'negro'],
      'rosa': ['gris', 'blanco', 'negro', 'azul marino'],
      'marron': ['beige', 'crema', 'verde', 'azul', 'blanco'],
      'camel': ['negro', 'blanco', 'azul marino', 'beige', 'burdeos'],
      'burdeos': ['beige', 'negro', 'gris', 'crema', 'camel'],
      'vino': ['beige', 'negro', 'gris', 'crema']
    },

    // Colores que chocan
    COLOR_CLASHES: [
      ['rojo', 'naranja'],
      ['rojo', 'rosa'],
      ['verde', 'rojo'],
      ['naranja', 'rosa']
    ],

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
      const currentType = currentProd.product_type;
      const currentOutfitType = this.CATEGORY_MAP[currentType];
      const currentColor = this.extractColor(currentProd);

      if (!currentOutfitType) {
        console.log('[Fashion] Tipo no reconocido:', currentType);
        return {};
      }

      const complementTypes = this.CATEGORY_COMPLEMENTS[currentOutfitType] || [];

      const candidates = allProducts
        .filter(p => p.id !== currentProd.id)
        .map(p => {
          const pType = this.CATEGORY_MAP[p.product_type];
          const pColor = this.extractColor(p);
          return {
            ...p,
            outfitType: pType,
            color: pColor,
            colorScore: this.calculateColorScore(currentColor, pColor),
            isComplement: complementTypes.includes(pType)
          };
        })
        .filter(p => p.isComplement && p.colorScore > 0)
        .sort((a, b) => b.colorScore - a.colorScore);

      const result = {};
      for (const type of complementTypes) {
        const shopifyTypes = Object.keys(this.CATEGORY_MAP)
          .filter(key => this.CATEGORY_MAP[key] === type);

        const items = candidates
          .filter(p => shopifyTypes.includes(p.product_type))
          .slice(0, maxPerCategory);

        if (items.length > 0) {
          const label = type === 'OUTERWEAR' ? 'Abrigos y chaquetas' :
                       type === 'TOP' ? 'Parte de arriba' :
                       type === 'BOTTOM' ? 'Pantalones' :
                       type === 'SHOES' ? 'Calzado' : type;
          result[label] = items;
        }
      }

      return result;
    }
  };

  // Elementos DOM
  const modal = document.getElementById('stilaro-vton-modal');
  const overlay = modal?.querySelector('.stilaro-vton-modal-overlay');
  const closeBtn = modal?.querySelector('.stilaro-vton-close');
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

  // Inicializar
  function init() {
    // Generar/obtener IDs
    visitorId = generateVisitorId();
    shopDomain = getShopDomain();

    console.log('[VTON] Inicializado - Shop:', shopDomain, 'Visitor:', visitorId);

    // Botones de apertura del modal
    document.querySelectorAll('.stilaro-vton-button').forEach(btn => {
      btn.addEventListener('click', openModal);
    });

    // Cerrar modal
    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    // Upload (Tab 1)
    uploadArea?.addEventListener('click', (e) => {
      if (e.target !== photoInput) photoInput?.click();
    });
    uploadArea?.addEventListener('dragover', handleDragOver);
    uploadArea?.addEventListener('drop', handleDrop);
    photoInput?.addEventListener('change', handleFileSelect);

    // Acciones (Tab 1)
    tryOnBtn?.addEventListener('click', generateTryOn);
    retryBtn?.addEventListener('click', resetToUpload);
    downloadBtn?.addEventListener('click', downloadResult);
    addCartBtn?.addEventListener('click', addToCart);

    // ==================== TAB HANDLING ====================
    tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // ==================== TAB 2: OUTFIT ====================
    // Upload (Tab 2)
    outfitUploadArea?.addEventListener('click', (e) => {
      if (e.target !== outfitPhotoInput) outfitPhotoInput?.click();
    });
    outfitUploadArea?.addEventListener('dragover', handleDragOver);
    outfitUploadArea?.addEventListener('drop', handleOutfitDrop);
    outfitPhotoInput?.addEventListener('change', handleOutfitFileSelect);

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
      if (e.key === 'Escape' && modal?.style.display !== 'none') {
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
      modal.classList.toggle('outfit-mode', tab === 'outfit');
    }

    // Ocultar todos los steps
    [stepUpload, stepResult, stepLoading,
     outfitUpload, outfitRecommendations, outfitLoading, outfitResult]
      .forEach(s => { if (s) s.style.display = 'none'; });

    // Mostrar step inicial del tab seleccionado
    if (tab === 'single') {
      if (stepUpload) stepUpload.style.display = 'block';
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

      sessionStorage.setItem(cacheKey, JSON.stringify(data.products));
      sessionStorage.setItem(cacheTime, Date.now().toString());

      console.log('[VTON] Productos obtenidos:', data.products.length);
      return data.products;
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

    const reader = new FileReader();
    reader.onload = (e) => {
      outfitUserPhotoBase64 = e.target.result;

      // Mostrar preview brevemente y luego generar VTON automáticamente
      if (outfitUserPreview) {
        outfitUserPreview.src = outfitUserPhotoBase64;
        outfitUserPreview.style.display = 'block';
      }

      if (outfitUploadArea) outfitUploadArea.style.display = 'none';

      // Generar VTON automáticamente después de subir foto
      setTimeout(() => {
        generateOutfitTryOn(false);
      }, 500);
    };
    reader.readAsDataURL(file);
  }

  // Mostrar paso de subir foto (después de seleccionar outfit)
  function showOutfitPhotoUpload() {
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

    // Reset el área de upload
    if (outfitUploadArea) outfitUploadArea.style.display = 'block';
    if (outfitUserPreview) outfitUserPreview.style.display = 'none';
    if (outfitPhotoInput) outfitPhotoInput.value = '';
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
    const type = product.product_type || '';
    const outfitType = FashionEngine.CATEGORY_MAP[type];

    const colorCapitalized = color.charAt(0).toUpperCase() + color.slice(1);
    const isNeutral = FashionEngine.NEUTRAL_COLORS.includes(color);
    const harmonies = FashionEngine.COLOR_HARMONIES[color] || [];

    let analysis = '';

    // Análisis según tipo de prenda
    if (outfitType === 'TOP') {
      if (isNeutral) {
        analysis = `Este ${type.toLowerCase()} en ${color} es muy versátil. Combina con prácticamente cualquier pantalón y puedes añadir un abrigo para completar el look.`;
      } else {
        const suggestedColors = harmonies.slice(0, 2).join(' o ');
        analysis = `El ${color} de esta prenda destaca mejor con tonos ${suggestedColors}. Te recomendamos pantalones neutros para equilibrar el look.`;
      }
    } else if (outfitType === 'OUTERWEAR') {
      if (isNeutral) {
        analysis = `Un abrigo ${color} es un básico que combina con todo. Ideal para dar un toque elegante a cualquier conjunto.`;
      } else {
        analysis = `Este abrigo en ${color} será el protagonista del look. Combínalo con prendas en tonos neutros para un resultado sofisticado.`;
      }
    } else if (outfitType === 'BOTTOM') {
      if (isNeutral) {
        analysis = `Pantalón ${color}, una base perfecta. Puedes combinarlo con tops de cualquier color y añadir capas según la ocasión.`;
      } else {
        analysis = `Un pantalón en ${color} aporta personalidad. Equilibra con partes de arriba en tonos más suaves.`;
      }
    } else if (outfitType === 'DRESS') {
      analysis = `Este vestido en ${color} es una pieza statement. Solo necesitas un buen abrigo y calzado para completar el look.`;
    } else if (outfitType === 'SHOES') {
      if (isNeutral) {
        analysis = `Calzado ${color}, siempre acertado. Combina con cualquier outfit sin competir con el resto de prendas.`;
      } else {
        analysis = `Zapatos en ${color} para dar un toque de color. Mejor con ropa en tonos neutros.`;
      }
    } else {
      analysis = `Prenda en ${color}. Te mostramos opciones que combinan bien con este tono.`;
    }

    return analysis;
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
            ${products.map(p => `
              <div class="stilaro-recommendation-item"
                   data-product-id="${p.id}"
                   data-product-image="${p.images[0]?.src || ''}"
                   data-product-title="${p.title}"
                   data-product-type="${p.product_type}"
                   data-color-score="${p.colorScore}"
                   onclick="window.toggleOutfitItem(this)">
                <img src="${p.images[0]?.src || ''}" alt="${p.title}">
                <span class="item-title">${p.title.substring(0, 20)}${p.title.length > 20 ? '...' : ''}</span>
                <span class="item-reason">${getRecommendationText(p, currentColor)}</span>
                ${p.colorScore >= 80 ? `<span class="item-score">${p.colorScore}%</span>` : ''}
                <span class="item-check">✓</span>
              </div>
            `).join('')}
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
    const productType = element.dataset.productType;
    const outfitType = FashionEngine.CATEGORY_MAP[productType];

    const index = selectedOutfitItems.findIndex(p => p.id === productId);

    if (index > -1) {
      // Deseleccionar
      selectedOutfitItems.splice(index, 1);
      element.classList.remove('selected');
    } else {
      // Verificar si ya hay una prenda del mismo tipo
      const existingIndex = selectedOutfitItems.findIndex(p =>
        FashionEngine.CATEGORY_MAP[p.type] === outfitType
      );

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
        image: element.dataset.productImage,
        title: element.dataset.productTitle,
        type: productType
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
    if (!outfitUserPhotoBase64 || !currentProduct) return;

    // Mostrar loading
    if (outfitRecommendations) outfitRecommendations.style.display = 'none';
    if (outfitUpload) outfitUpload.style.display = 'none';
    if (outfitLoading) outfitLoading.style.display = 'block';

    startOutfitProgressAnimation();

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
    outfitUserPhotoBase64 = null;
    selectedOutfitItems = [];

    if (outfitUserPreview) {
      outfitUserPreview.src = '';
      outfitUserPreview.style.display = 'none';
    }
    if (outfitUploadArea) outfitUploadArea.style.display = 'block';
    if (outfitContinueBtn) outfitContinueBtn.style.display = 'none';
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

    outfitProgressInterval = setInterval(() => {
      if (outfitCurrentProgress < 70) {
        outfitCurrentProgress += Math.random() * 5 + 2;
      } else if (outfitCurrentProgress < 90) {
        outfitCurrentProgress += Math.random() * 2 + 0.5;
      } else if (outfitCurrentProgress < 95) {
        outfitCurrentProgress += Math.random() * 0.5;
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
    if (!currentProduct) return;

    // Añadir todas las prendas del outfit
    const items = [{ id: currentProduct.id, quantity: 1 }];

    selectedOutfitItems.forEach(item => {
      items.push({ id: item.id, quantity: 1 });
    });

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
      .then(response => response.json())
      .then(data => {
        closeModal();
        window.location.href = '/cart';
      })
      .catch(error => {
        console.error('Error adding outfit to cart:', error);
        alert('Error al añadir al carrito');
      });
  }

  async function openModal(e) {
    const btn = e.currentTarget;
    currentProduct = {
      id: btn.dataset.productId,
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

    // Reset estado visual de ambas pestañas
    resetToUpload();
    resetToOutfitUpload();

    // Reset a tab 1
    currentTab = 'single';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'single'));

    // Mostrar modal
    if (modal) modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Ocultar todos los steps excepto el de upload tab 1
    [stepResult, stepLoading, outfitUpload, outfitRecommendations, outfitLoading, outfitResult]
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
  }

  function closeModal() {
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    userPhotoBase64 = null;
    shopStatus = null;
  }

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

    const reader = new FileReader();
    reader.onload = (e) => {
      userPhotoBase64 = e.target.result;

      // Mostrar preview
      if (userPreview) {
        userPreview.src = userPhotoBase64;
        userPreview.style.display = 'block';
      }

      // Ocultar area de upload y uso info, mostrar boton
      if (uploadArea) uploadArea.style.display = 'none';
      hideUsageInfo();
      if (tryOnBtn) tryOnBtn.style.display = 'block';
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
    userPhotoBase64 = null;

    // Ocultar mensaje de estado
    const statusMsg = document.getElementById('stilaro-status-message');
    if (statusMsg) {
      statusMsg.style.display = 'none';
    }

    if (userPreview) {
      userPreview.src = '';
      userPreview.style.display = 'none';
    }
    if (uploadArea) uploadArea.style.display = 'block';
    if (tryOnBtn) tryOnBtn.style.display = 'none';
    if (photoInput) photoInput.value = '';

    hideUsageInfo();
    showStep(stepUpload);
  }

  function addToCart() {
    if (!currentProduct) return;

    // Usar la API de Shopify para anadir al carrito
    const formData = {
      items: [{
        id: currentProduct.id,
        quantity: 1
      }]
    };

    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
      .then(response => response.json())
      .then(data => {
        closeModal();
        // Opcional: Redirigir al carrito o mostrar notificacion
        window.location.href = '/cart';
      })
      .catch(error => {
        console.error('Error adding to cart:', error);
        alert('Error al anadir al carrito');
      });
  }

  // Animacion de progreso
  let progressInterval = null;
  let currentProgress = 0;

  function startProgressAnimation() {
    currentProgress = 0;
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';

    progressInterval = setInterval(() => {
      // Incremento no lineal: rapido al principio, lento cerca del 95%
      if (currentProgress < 70) {
        currentProgress += Math.random() * 5 + 2;
      } else if (currentProgress < 90) {
        currentProgress += Math.random() * 2 + 0.5;
      } else if (currentProgress < 95) {
        currentProgress += Math.random() * 0.5;
      }

      currentProgress = Math.min(currentProgress, 95); // Nunca llegar a 100% hasta que termine

      if (progressFill) progressFill.style.width = currentProgress + '%';
      if (progressText) progressText.textContent = Math.floor(currentProgress) + '%';
    }, 200);
  }

  function stopProgressAnimation() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
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
