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

  // Steps
  const stepUpload = document.getElementById('stilaro-step-upload');
  const stepResult = document.getElementById('stilaro-step-result');
  const stepLoading = document.getElementById('stilaro-step-loading');

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

    // Upload
    uploadArea?.addEventListener('click', (e) => {
      if (e.target !== photoInput) photoInput?.click();
    });
    uploadArea?.addEventListener('dragover', handleDragOver);
    uploadArea?.addEventListener('drop', handleDrop);
    photoInput?.addEventListener('change', handleFileSelect);

    // Acciones
    tryOnBtn?.addEventListener('click', generateTryOn);
    retryBtn?.addEventListener('click', resetToUpload);
    downloadBtn?.addEventListener('click', downloadResult);
    addCartBtn?.addEventListener('click', addToCart);

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal?.style.display !== 'none') {
        closeModal();
      }
    });
  }

  async function openModal(e) {
    const btn = e.currentTarget;
    currentProduct = {
      id: btn.dataset.productId,
      title: btn.dataset.productTitle,
      image: btn.dataset.productImage,
      price: btn.dataset.productPrice
    };

    // Mostrar info del producto
    if (productImage) productImage.src = currentProduct.image;
    if (productTitle) productTitle.textContent = currentProduct.title;

    // Reset estado visual
    resetToUpload();

    // Mostrar modal
    if (modal) modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

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
