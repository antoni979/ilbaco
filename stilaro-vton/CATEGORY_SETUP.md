# Stilaro VTON - Category Setup Guide

## How the Recommendation System Works

The outfit recommendation engine automatically detects clothing categories by analyzing:
1. **Product Type** (Shopify's product_type field)
2. **Product Title**
3. **Product Tags**

It uses keyword matching in **6 languages**: English, Spanish, French, German, Italian, and Portuguese.

---

## Supported Categories

| Category | What it includes |
|----------|-----------------|
| **TOP** | Shirts, t-shirts, blouses, sweaters, hoodies, polos |
| **BOTTOM** | Pants, jeans, skirts, shorts, leggings |
| **OUTERWEAR** | Coats, jackets, blazers, cardigans, parkas |
| **DRESS** | Dresses, jumpsuits, rompers |
| **SHOES** | All footwear |
| **ACCESSORY** | Bags, belts, scarves, hats, jewelry |

---

## Recommendation Logic

When a customer views a product, the system recommends complementary items:

| If viewing... | System recommends... |
|---------------|---------------------|
| TOP | Bottoms, Outerwear, Shoes |
| BOTTOM | Tops, Outerwear, Shoes |
| OUTERWEAR | Tops, Bottoms, Shoes |
| DRESS | Outerwear, Shoes |
| SHOES | Tops, Bottoms |

---

## Automatic Keywords (Built-in)

The system recognizes these keywords automatically:

### TOP
```
English: sweater, jumper, blouse, shirt, t-shirt, tee, sweatshirt, hoodie, top, polo, pullover
Spanish: jersey, suéter, blusa, camiseta, camisa, sudadera, top, polo
French: pull, chemise, chemisier, haut, sweat
German: pullover, hemd, bluse, oberteil, shirt
Italian: maglione, camicia, maglia, felpa
Portuguese: camisola, camisa, blusa, moletom
```

### BOTTOM
```
English: pants, trousers, jeans, skirt, shorts, leggings, joggers, chinos
Spanish: pantalón, pantalones, vaquero, jeans, falda, shorts, leggins
French: pantalon, jean, jupe, short
German: hose, hosen, jeans, rock, shorts
Italian: pantaloni, jeans, gonna, shorts
Portuguese: calça, calças, jeans, saia, shorts
```

### OUTERWEAR
```
English: coat, jacket, outerwear, parka, blazer, cardigan, overcoat
Spanish: abrigo, chaqueta, cazadora, parka, blazer, americana
French: manteau, veste, blouson, pardessus
German: mantel, jacke, blazer
Italian: cappotto, giacca, giubbotto
Portuguese: casaco, jaqueta, blazer
```

### DRESS
```
English: dress, gown, jumpsuit, romper
Spanish: vestido, mono, jumpsuit
French: robe, combinaison
German: kleid, kleider
Italian: vestito, abito
Portuguese: vestido
```

### SHOES
```
English: shoe, shoes, footwear, sneaker, boot, sandal, heel, loafer
Spanish: zapato, calzado, zapatilla, bota, sandalia, tacón
French: chaussure, basket, botte, sandale, talon
German: schuh, schuhe, stiefel, sandale, sneaker
Italian: scarpa, scarpe, stivale, sandalo, sneaker
Portuguese: sapato, tênis, bota, sandália
```

---

## Setup Options for Stores

### Option 1: Use Standard Product Types (Recommended)

Set your Shopify product types to any of the keywords above. Examples:
- `Sweater`, `Jersey`, `Pull`, `Maglione`
- `Pants`, `Pantalón`, `Hose`, `Pantaloni`
- `Jacket`, `Chaqueta`, `Veste`, `Giacca`

### Option 2: Use Tags

If your product types are custom, add tags to help detection:
- Add `top`, `bottom`, `outerwear`, `dress`, or `shoes` as a tag
- Example: Product type "Casual Wear" + Tag "top" → Detected as TOP

### Option 3: Custom Mapping (Enterprise)

Contact us to configure custom category mappings for your store.

---

## Stock Filtering

The system automatically filters out products with no available stock. Only products with at least one variant marked as `available: true` will appear in recommendations.

---

## Color Matching

The system also analyzes colors for better outfit suggestions:
- Extracts color from product tags or title
- Calculates compatibility scores based on fashion color theory
- Neutral colors (black, white, gray, beige) match with everything
- Complementary colors get higher scores
- Clashing colors (red+green, orange+pink) are avoided

### Supported Colors
```
Neutrals: black, white, gray, beige, cream, camel, brown
Colors: red, blue, navy, green, pink, orange, yellow, burgundy
```

---

## Troubleshooting

### "No complementary items available"

This means either:
1. The current product's category wasn't detected
2. No products in complementary categories have stock
3. Product types/titles don't contain recognizable keywords

**Solution**: Check your product types and add recognizable keywords or tags.

### Products not being detected

Check the browser console for:
```
[Fashion] Tipo no reconocido para: [product title] - product_type: [type]
```

This shows which products aren't being categorized. Add appropriate keywords to fix.

---

## Questions?

Contact support@stilaro.com
