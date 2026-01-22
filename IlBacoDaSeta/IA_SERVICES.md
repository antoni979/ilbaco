# 🤖 Servicios de IA en Il Baco Da Seta

Este documento describe los servicios de IA utilizados en la aplicación Il Baco Da Seta.

---

## 📋 RESUMEN DE SERVICIOS

| Servicio | Proveedor | Modelo | Precio/imagen | Uso |
|----------|-----------|--------|---------------|-----|
| **Análisis de prendas** | Google Gemini | `gemini-2.0-flash-exp` | $0.0011 | Categorización automática |
| **Normalización de fondo** | Replicate | `851-labs/background-remover` | ~$0.001-0.002 | Fondo blanco profesional |

---

## 1️⃣ ANÁLISIS DE PRENDAS (Gemini 2.0 Flash)

### **Archivo**: `features/scanner/utils/ai_analysis.ts`

### **Funcionalidad**:
Analiza fotos de ropa y extrae:
- Color dominante y secundario
- Categoría y subcategoría
- Estilo (Casual, Formal, Deportivo, etc.)
- Temporada (Verano/Primavera, Invierno/Otoño)
- Patrón (Solid, Striped, Floral, etc.)
- Marca (si es visible)
- Material predicho

### **Configuración**:
```typescript
const LOCKED_MODEL = 'gemini-2.0-flash-exp' as const;
```

### **Precio**:
- **$0.0011 por análisis**
- Usuario medio: 15 prendas/mes = **$0.017/mes**

### **Variable de entorno**:
```
EXPO_PUBLIC_GEMINI_API_KEY=tu_api_key_aqui
```

---

## 2️⃣ NORMALIZACIÓN DE FONDO (Replicate)

### **Archivo**: `features/scanner/utils/photoroom_normalization.ts`

### **Funcionalidad**:
Elimina el fondo de las fotos de ropa y lo reemplaza con **fondo blanco puro** para aspecto profesional de e-commerce.

### **Modelo**: `851-labs/background-remover`
- **Version Hash**: `a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc`
- **Parámetros clave**:
  - `background_type: 'white'` → Fondo blanco
  - `format: 'png'` → Formato de salida

### **Precio**:
- **~$0.001-0.002 por imagen**
- Usuario medio: 10 normalizaciones/mes = **$0.01-0.02/mes**

### **Variable de entorno**:
```
EXPO_PUBLIC_REPLICATE_API_TOKEN=tu_token_aqui
```

### **Toggle en UI**:
La normalización es **opcional**. El usuario puede activar/desactivar con un switch en la pantalla de "Añadir prenda".

---

## 💰 COSTE TOTAL ESTIMADO

### **Por usuario/mes** (uso medio):
- 15 análisis: **$0.017**
- 10 normalizaciones: **$0.015**
- **TOTAL: ~$0.032/usuario/mes**

### **Para 1,000 usuarios activos/mes**:
- **$32/mes** 🎉

---

## 🔧 SETUP PARA DESARROLLO

### **1. Obtener API Keys**

**Google Gemini**:
1. Ve a https://ai.google.dev/
2. Crea un proyecto
3. Genera API key
4. Agrégala al `.env`

**Replicate**:
1. Ve a https://replicate.com/
2. Sign up (te dan $5 gratis)
3. Ve a https://replicate.com/account/api-tokens
4. Copia tu token
5. Agrégalo al `.env`

### **2. Configurar .env**

Crea/edita el archivo `.env` en la raíz del proyecto:

```bash
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSy...
EXPO_PUBLIC_REPLICATE_API_TOKEN=r8_K1z...
```

### **3. Reiniciar servidor**

Después de modificar `.env`:
```bash
# Cerrar servidor actual (Ctrl+C)
npm start
```

---

## 📊 MONITOREO DE COSTES

### **Gemini**:
- Dashboard: https://console.cloud.google.com/
- Ver uso y facturación

### **Replicate**:
- Dashboard: https://replicate.com/account/billing
- Ver créditos restantes y uso mensual

---

## 🚀 OPTIMIZACIONES FUTURAS

1. **Caché de análisis**: Guardar análisis de prendas similares
2. **Batch processing**: Procesar múltiples imágenes en paralelo
3. **Modelos más baratos**: Evaluar alternativas si el uso crece
4. **Rate limiting**: Limitar llamadas por usuario para evitar abuso

---

## 🔒 SEGURIDAD

⚠️ **IMPORTANTE**:
- Las API keys están expuestas en el cliente (`EXPO_PUBLIC_*`)
- Para producción, considerar:
  1. Supabase Edge Functions como proxy
  2. Rate limiting por usuario
  3. Límites de uso por tier (Free, Pro, Premium)

---

## 📝 LICENCIAS

- **Gemini 2.0 Flash**: Uso comercial permitido
- **851-labs/background-remover**: Uso comercial permitido (verificar licencia del modelo)

---

**Última actualización**: Diciembre 2024
**Autor**: Il Baco Da Seta Team
