# Plan: Probador Virtual - Plugin Shopify
Para construir todo, ten en cuenta que usaras la docuemntacion oficial del MCP de shopify
## 1. Arquitectura
- **Frontend**: Shopify Custom App + Theme App Extensions (bloque nativo)
- **Backend**: Supabase (almacenamiento + Edge Functions + Gemini)

## 2. Bloque Editable (sin código para el cliente)
- Settings visuales: texto botón, colores, márgenes
- Captura automática del `product.id`

## 3. Flujo VTON
1. Click en botón → Modal overlay
2. Usuario sube foto
3. Envío a Supabase Edge Function → Gemini VTON
4. Resultado mostrado en web

## 4. Roadmap
| Fase | Tarea |
|------|-------|
| 1 | Sincronización catálogo Shopify → Supabase (products.json) |
| 2 | Crear Theme App Extension (Shopify CLI) |
| 3 | Conectar botón con lógica `probador.tsx` adaptada |

## 5. Flujo de Trabajo
- **Ramas**: `antoni` / `mario`
- **Merge**: PR a `main` por cada funcionalidad

