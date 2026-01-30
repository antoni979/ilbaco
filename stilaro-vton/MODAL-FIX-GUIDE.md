# Guía de Solución: Modal Virtual Try-On

## Problema Original
El modal del probador virtual no se mostraba correctamente por encima de la foto del producto.

**Síntomas:**
- Modal visible pero la foto del producto aparecía por encima
- Modal centrado correctamente pero en capa inferior
- Z-index del modal era máximo (2147483647) pero aún así quedaba debajo

## Causa Raíz

### Problema de Stacking Context
El modal estaba **dentro de un contenedor DIV** del producto en el DOM. Aunque tuviera:
- `position: fixed`
- `z-index: 2147483647` (máximo)

Seguía atrapado en el **stacking context del padre**, compartiendo capa con la foto del producto.

```
DOM antes (INCORRECTO):
<div class="product-container">
  <img class="product-photo" />  ← z-index alto
  <div id="stilaro-vton-modal">  ← Mismo stacking context
    ...
  </div>
</div>
```

## Solución Final

### 1. Mover Modal al Body (CRÍTICO)
**Archivo:** `stilaro-vton/extensions/vton-block/assets/vton-modal.js`

```javascript
// En init() - línea ~1070
if (modal && modal.parentElement !== document.body) {
  document.body.appendChild(modal);
}

// En positionModalOverButton() - línea ~771
if (modal && modal.parentElement !== document.body) {
  document.body.appendChild(modal);
}

// Defensa continua - línea ~1089
setInterval(() => {
  if (modal && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
}, 1000);
```

**Resultado:**
```
DOM después (CORRECTO):
<body>
  <div class="product-container">
    <img class="product-photo" />
  </div>
  ...
  <div id="stilaro-vton-modal">  ← Root stacking context
    ...
  </div>
</body>
```

### 2. Reducción Agresiva de Z-Index
**Archivo:** `stilaro-vton/extensions/vton-block/assets/vton-modal.js`

```javascript
// Línea ~1004
allElements.forEach(el => {
  const z = parseInt(getComputedStyle(el).zIndex);
  if (!isNaN(z) && z >= 1 && el.id !== 'stilaro-vton-modal' && !modal.contains(el)) {
    el.style.setProperty('z-index', 'auto', 'important');
  }
});
```

Resetea TODOS los z-index >= 1 a `auto`, excepto el modal.

### 3. Reseteo de Z-Index de Padres
**Archivo:** `stilaro-vton/extensions/vton-block/assets/vton-modal.js`

```javascript
// Línea ~1018
let parent = modal.parentElement;
while (parent && parent !== document.body) {
  const parentZ = parseInt(getComputedStyle(parent).zIndex);
  if (!isNaN(parentZ) && parentZ !== 0) {
    parent.style.setProperty('z-index', 'auto', 'important');
  }
  parent = parent.parentElement;
}
```

Evita que los padres creen stacking contexts compartidos.

### 4. MutationObserver Defensivo
**Archivo:** `stilaro-vton/extensions/vton-block/assets/vton-modal.js`

```javascript
// Línea ~2292
const zIndexObserver = new MutationObserver(() => {
  // Proteger modal
  const modalZ = parseInt(getComputedStyle(modal).zIndex);
  if (isNaN(modalZ) || modalZ < 2147483647) {
    modal.style.setProperty('z-index', '2147483647', 'important');
  }

  // Resetear externos
  allElements.forEach(el => {
    if (el.id !== 'stilaro-vton-modal' && !modal.contains(el)) {
      const z = parseInt(getComputedStyle(el).zIndex);
      if (!isNaN(z) && z >= 1) {
        el.style.setProperty('z-index', 'auto', 'important');
      }
    }
  });
});

zIndexObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['style', 'class'],
  subtree: true,
  childList: true
});
```

Vigila continuamente cambios en el DOM y corrige z-indexes.

## Archivos Modificados

1. **vton-modal.js** (líneas ~771, ~1004, ~1018, ~1070, ~1089, ~2292)
   - Movimiento del modal al body
   - Reducción agresiva de z-index
   - MutationObserver defensivo

## Diagnóstico Rápido

Si el modal vuelve a quedar debajo de elementos:

### 1. Verificar posición en DOM
```javascript
console.log('Modal parent:', modal.parentElement.tagName);
// Debe mostrar: BODY
```

### 2. Verificar z-indexes
```javascript
const allElements = document.querySelectorAll('*');
allElements.forEach(el => {
  const z = parseInt(getComputedStyle(el).zIndex);
  if (!isNaN(z) && z > 100) {
    console.log(el.tagName, el.id || el.className, 'z-index:', z);
  }
});
// Solo el modal debe tener z-index alto
```

### 3. Logs de consola
Buscar estos mensajes:
```
[VTON] 🚀 INIT: Modal movido a body  ← Debe aparecer
[VTON] ⚠️ DEFENSA: Modal fuera de body  ← NO debe aparecer
[VTON] ✅ Z-index reseteado a auto  ← Debe aparecer varias veces
```

## Soluciones Anteriores Intentadas (NO FUNCIONARON)

❌ **Elevar z-index del modal** - No resolvía el stacking context compartido
❌ **Reducir z-index a 999** - Demasiado conservador, elementos con z:100-999 seguían compitiendo
❌ **Elevar z-index de padres** - Empeoraba el problema al crear stacking context compartido
❌ **Overlay con z-index bajo** - No afectaba la raíz del problema

## Lecciones Clave

1. **Stacking Context es jerárquico:** Un elemento con `position: fixed` y z-index máximo SIGUE atrapado en el stacking context de su padre si el padre tiene z-index.

2. **La solución es DOM, no CSS:** Mover el elemento al body es más efectivo que jugar con z-index.

3. **Shopify themes son agresivos:** Temas Shopify aplican z-index a muchos elementos, necesitamos ser ULTRA-agresivos en resetearlos.

4. **Defensa continua necesaria:** Un solo ajuste al abrir no basta, necesitamos MutationObserver y setInterval.

## Resumen de Una Línea
**Mover modal a body + resetear todos los z-index externos a auto = modal SIEMPRE por encima.**
