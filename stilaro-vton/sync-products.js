/**
 * Script de sincronización masiva de productos desde Supabase a Shopify
 * Ejecutar con: node sync-products.js
 */

const SHOPIFY_STORE = process.env.SHOPIFY_STORE || 'prueba-stilaro.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

if (!SHOPIFY_ACCESS_TOKEN) {
  console.error('ERROR: SHOPIFY_ACCESS_TOKEN environment variable is required');
  console.error('Set it with: export SHOPIFY_ACCESS_TOKEN=your_token');
  process.exit(1);
}

// Items de Supabase (61 productos)
const items = [
  {"id":61,"name":"Parka Harris Wharf London Capucha Light Tecnica Marino","brand":"Harris Wharf London","category":"abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/7A1EE3DE-62A5-4F83-8622-EADAAD8737E3.jpg?v=1768990818","characteristics":{"color":"marino","style":"Casual","season":"Primavera/Verano","description":"Parka con capucha y cordon en cintura ajustable, cremallera","sub_category":"parka"}},
  {"id":62,"name":"Chaqueta Harris Wharf London Trench Técnica Camel","brand":"Harris Wharf London","category":"chaqueta","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/B5644D51-D00E-4EFF-B40E-4A8B387F0BF8.jpg?v=1768923847","characteristics":{"color":"camel","style":"Elegante","season":"Primavera/Verano","description":"Chaqueta cruzada con botones tecnica","sub_category":"trench"}},
  {"id":63,"name":"Chaqueta Harris Wharf London Trench Tecnica Marino","brand":"Harris Wharf London","category":"chaqueta","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/89C77811-D8DC-43A8-8CDA-3051B5EBCF65.jpg?v=1768923904","characteristics":{"color":"marino","style":"Elegante","season":"Primavera/Verano","description":"Chaqueta cruzada tecnica con botones","sub_category":"trench"}},
  {"id":64,"name":"Chaqueta Harris Wharf London Trench Lana Roja","brand":"Harris Wharf London","category":"chaqueta","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/5BE63146-E043-4CA2-9346-D33503BFDC44.jpg?v=1768990772","characteristics":{"color":"rojo","style":"Elegante","season":"Primavera/Verano","description":"Chaqueta cruzada con botones de lana","sub_category":"trench","material_guess":"lana"}},
  {"id":65,"name":"Chaqueta Harris Wharf London Trench Lana Vison","brand":"Harris Wharf London","category":"chaqueta","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/413FF42D-D9FD-4FA5-BCB6-CB31D8BE8C96.jpg?v=1768924052","characteristics":{"color":"vison","style":"Elegante","season":"Primavera/Verano","description":"Chaqueta cruzada con botones y de lana","sub_category":"trench","material_guess":"lana"}},
  {"id":66,"name":"Chaqueta Harris Wharf London Trench Lana Crema","brand":"Harris Wharf London","category":"chaqueta","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/CD25CE10-BE5D-4D34-B032-60A362433887.jpg?v=1768923989","characteristics":{"color":"crema","style":"Elegante","season":"Primavera/Verano","description":"Chaqueta cruzada con botones de lana","sub_category":"trench","material_guess":"lana"}},
  {"id":67,"name":"Blazer Harris Wharf London Frise Bicolor Denim","brand":"Harris Wharf London","category":"blazer","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/75264009-C180-4999-A3AB-F04D80C66124.jpg?v=1768922485","characteristics":{"color":"denim","style":"Elegante","season":"Primavera/Verano","description":"Chaqueta con dos botones en tejido frise bicolor","sub_category":"blazer"}},
  {"id":68,"name":"Sneaker Ecoalf Strenk Caqui","brand":"ECOALF","category":"calzado","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/90A3BE2A-7B70-499C-BE29-9D6F33E8CE50.jpg?v=1768316759","characteristics":{"color":"caqui","style":"Casual","season":"Primavera/Verano","sub_category":"sneaker"}},
  {"id":69,"name":"Sneaker Ecoalf Strenk Gris","brand":"ECOALF","category":"calzado","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/6CA102CE-7246-44AB-B168-57586258111F.jpg?v=1768317227","characteristics":{"color":"gris","style":"Casual","season":"Primavera/Verano","sub_category":"sneaker"}},
  {"id":70,"name":"Sneaker Ecoalf Condeknit Sand","brand":"ECOALF","category":"Calzado","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/43416610-5A70-41DB-9292-557334D91D82.jpg?v=1763379024","characteristics":{"color":"arena","style":"Casual","season":"Primavera/Verano","description":"Sneaker ecologica","sub_category":"sneaker"}},
  {"id":71,"name":"Blusa Liviana Conti Cruzada","brand":"Liviana Conti","category":"blusa","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/1004F0FE-5B4D-4990-80C1-8FB5E44F7CD8.jpg?v=1765368867","characteristics":{"color":"blanco","style":"Elegante","season":"Primavera/Verano","description":"Blusa de popelin, elastica, cruzada y abrochada con un boton el el lado","sub_category":"blusa","material_guess":"popelin"}},
  {"id":72,"name":"Jersey Floor Cuello Pico","brand":"FLOOR","category":"jersey","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/D382E843-A6AB-454B-B017-3E7925548766.jpg?v=1763552291","characteristics":{"color":"beige","style":"Casual","season":"Otoño/Invierno","description":"Jersey cuello pico, manga larga, ancho","sub_category":"jersey manga larga"}},
  {"id":73,"name":"Jersey Floor C.Redondo M.Francesa","brand":"FLOOR","category":"jersey","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/F1E66A5C-1F4C-4D04-9B57-10B91F05EB37.jpg?v=1763553111","characteristics":{"color":"beige","style":"Casual","season":"Otoño/Invierno","description":"Jersey 100% lana de cuello redondo, manga francesa","sub_category":"jersey manga francesa","material_guess":"lana"}},
  {"id":74,"name":"Jersey Floor C.Pico","brand":"FLOOR","category":"jersey","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/E873D7C2-EFBE-4567-A2ED-7472F6AE1744.jpg?v=1763553142","characteristics":{"color":"beige","style":"Casual","season":"Otoño/Invierno","description":"Jersey de lana, cuello pico, manga larga","sub_category":"jersey manga larga","material_guess":"lana"}},
  {"id":75,"name":"Jersey Floor Cuello Cisne","brand":"FLOOR","category":"jersey","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/555B74B7-4FE9-4C08-8F41-C32E6913B73E.jpg?v=1763553179","characteristics":{"color":"beige","style":"Casual","season":"Otoño/Invierno","description":"Jersey de lana, cuello cisne, manga larga","sub_category":"jersey cuello cisne","material_guess":"lana"}},
  {"id":76,"name":"Pantalon Il Baco Da Seta Ancho Vuelta","brand":"Il Baco Da Seta","category":"pantalon","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/99B869FD-AE92-41F7-A505-E1AF5B481A4F.jpg?v=1763983741","characteristics":{"color":"beige","style":"Casual","season":"Otoño/Invierno","description":"Pantalon con goma en la cintura, ancho con vuelta, elastico","sub_category":"pantalon ancho"}},
  {"id":77,"name":"Pantalon Agoefilo Campanita Flecos","brand":"AGOeFILO","category":"pantalon","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/99FBE9BC-A9C0-41DD-B8C0-B8EFD0C68D56.jpg?v=1768990253","characteristics":{"color":"blanco","style":"Casual","season":"Primavera/Verano","description":"Pantalon de algodon elastico campanita flecos","sub_category":"pantalon campana","material_guess":"algodon"}},
  {"id":78,"name":"Pantalon Agoefilo Ancho Strech","brand":"AGOeFILO","category":"pantalon","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/969914E3-E789-4564-AC5A-ABDF71516915.jpg?v=1768990460","characteristics":{"color":"blanco","style":"Casual","season":"Primavera/Verano","description":"Pantalon elastico ancho con bolsillos traseros","sub_category":"pantalon ancho"}},
  {"id":79,"name":"Pantalón Cambio Cameron","brand":"Cambio","category":"pantalon","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/26496A7A-8E3E-42A3-9FC1-A0F88FBED94E.jpg?v=1768481669","characteristics":{"color":"beige","style":"Casual","season":"Primavera/Verano","description":"Pantalon elastico, con goma en la cintura, ancho corto","sub_category":"pantalon ancho corto"}},
  {"id":80,"name":"Jeans Cambio Tess Pocket Cropped","brand":"Cambio","category":"pantalon","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/C381ACC7-5654-4F88-937B-823EA0F8AADD.jpg?v=1768481621","characteristics":{"color":"azul","style":"Casual","season":"Primavera/Verano","description":"Jeans recto, con bolsillos de plaston delantero, elastico","sub_category":"jeans cropped"}},
  {"id":81,"name":"Jeans Cambio Elin","brand":"Cambio","category":"pantalon","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/B5259201-9098-4105-A63A-CFFD96D367BC.jpg?v=1768481718","characteristics":{"color":"azul","style":"Casual","season":"Primavera/Verano","description":"Jeans, elastico, 5 bolsillos, con pinza en el camal","sub_category":"jeans pinza"}},
  {"id":82,"name":"Jeans Cambio Francesca Azul","brand":"Cambio","category":"pantalon","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/E7F9A86D-0012-418F-9C01-3894B023D715.jpg?v=1766504330","characteristics":{"color":"azul","style":"Casual","season":"Primavera/Verano","description":"Jeans elastico, recto, 5 bolsillos","sub_category":"jeans recto"}},
  {"id":83,"name":"Pantalon Cambio Elena","brand":"Cambio","category":"pantalon","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/923540EB-2CDC-4897-912C-CB702B18BDB3.jpg?v=1768388788","characteristics":{"color":"beige","style":"Casual","season":"Primavera/Verano","description":"Pantalon elastico, regular fit, con goma en la cintura","sub_category":"pantalon regular"}},
  {"id":84,"name":"Pantalon Liviana Conti Recto","brand":"Liviana Conti","category":"pantalon","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/A331CEE4-BAC3-4DD1-9948-C9BF67A9E4B9.jpg?v=1765544283","characteristics":{"color":"negro","style":"Elegante","season":"Primavera/Verano","description":"Pantalon tipo punto roma, recto, con goma detras","sub_category":"pantalon recto"}},
  {"id":85,"name":"Pantalon Liviana Conti Popelin Flare","brand":"Liviana Conti","category":"pantalon","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/DD379E4A-777A-4608-AFD8-0F6B50C75853.jpg?v=1765369027","characteristics":{"color":"blanco","style":"Elegante","season":"Primavera/Verano","description":"Pantalon de popelin, flare, con goma en la cintura","sub_category":"pantalon flare","material_guess":"popelin"}},
  {"id":86,"name":"Vestido Il Baco Da Seta Saja Terciopelo Estampado Flores","brand":"Il Baco Da Seta","category":"vestido","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/2778C605-A0E3-4E2A-899E-4E13D11C036D.jpg?v=1762350232","characteristics":{"color":"multicolor","style":"Elegante","season":"Otoño/Invierno","pattern":"flores","description":"Vestido largo de terciopelo, manga larga, estampado flores","sub_category":"vestido largo","material_guess":"terciopelo"}},
  {"id":90,"name":"Jeans Cambio Tess Jogg","brand":"Cambio","category":"Pantalón","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/D26ACA34-FAD9-4287-80A7-619F7AFF376A.jpg","characteristics":{"color":"Azul","style":"Casual","season":"Invierno/Otoño","pattern":"Solid","category":"Pantalón","brand_guess":"Cambio","sub_category":"Pantalón","material_guess":null,"secondary_color":null}},
  {"id":91,"name":"Chaqueta VLab Punto y Pluma","brand":"VLAB","category":"Chaqueta","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/BA925F62-8B2D-4662-98A5-7958167DC34E.jpg","characteristics":{"color":"Rojo","style":"Elegante","season":"Invierno/Otoño","pattern":"Other","category":"Chaqueta","brand_guess":"VLAB","sub_category":"Chaqueta","material_guess":null,"secondary_color":null}},
  {"id":92,"name":"Chaqueton Harris Wharf London Forro Escoses Azul Noche","brand":"Harris Wharf London","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/1168ADE7-D289-490C-9493-2A651853DA48.jpg","characteristics":{"color":"Azul Noche","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Abrigo","brand_guess":"Harris Wharf London","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":93,"name":"Jersey Floor Rombos - Verde","brand":"FLOOR","category":"Jersey","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/198E6F0F-6B8E-46F7-9D91-583597EC5007.jpg","characteristics":{"color":"Verde","style":"Casual","season":"Invierno/Otoño","pattern":"Other","category":"Jersey","brand_guess":"FLOOR","sub_category":"Jersey","material_guess":null,"secondary_color":null}},
  {"id":94,"name":"Jersey Floor Rombos - Rojo","brand":"FLOOR","category":"Jersey","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/C1D78C8A-9DF8-4348-9E30-93EA6EC48E9B.jpg","characteristics":{"color":"Rojo","style":"Casual","season":"Invierno/Otoño","pattern":"Other","category":"Jersey","brand_guess":"FLOOR","sub_category":"Jersey","material_guess":null,"secondary_color":null}},
  {"id":95,"name":"Abrigo VLab Cuadros Largo","brand":"VLAB","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/F27BD893-3D1D-4FED-93A0-E9D9EF1A0350.jpg","characteristics":{"color":"Verde","style":"Elegante","season":"Invierno/Otoño","pattern":"Plaid","category":"Abrigo","brand_guess":"VLAB","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":96,"name":"Chaqueta VLab Cuadros","brand":"VLAB","category":"Chaqueta","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/CA1CDABE-936B-4E38-BAF2-42F38736DA0E.jpg","characteristics":{"color":"Verde","style":"Elegante","season":"Invierno/Otoño","pattern":"Plaid","category":"Chaqueta","brand_guess":"VLAB","sub_category":"Chaqueta","material_guess":null,"secondary_color":null}},
  {"id":97,"name":"Jeans Cigalas Baggy Fatigue Azul Oscuro","brand":"CIGALAS","category":"Pantalón","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_27_10.jpg","characteristics":{"color":"Azul Oscuro","style":"Casual","season":"Invierno/Otoño","pattern":"Solid","category":"Pantalón","brand_guess":"CIGALAS","sub_category":"Pantalón","material_guess":null,"secondary_color":null}},
  {"id":98,"name":"Abrigo Capa Harris Wharf London Recto Rojo","brand":"Harris Wharf London","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/E428FEC7-5CFA-4C2D-A435-142CD0C01A00.jpg","characteristics":{"color":"Rojo","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Abrigo","brand_guess":"Harris Wharf London","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":99,"name":"Camiseta Whyci Milano Cuadrito Punto Y Seda - Rojo","brand":"Whyci Milano","category":"Top","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/82969D49-48BB-4985-AC3C-68FBE0F552C0.jpg","characteristics":{"color":"Rojo","style":"Casual","season":"Invierno/Otoño","pattern":"Other","category":"Top","brand_guess":"Whyci Milano","sub_category":"Top","material_guess":null,"secondary_color":null}},
  {"id":100,"name":"Camiseta Whyci Milano Cuadrito Punto Y Seda - Azul Marino","brand":"Whyci Milano","category":"Top","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/188D153E-A178-49FF-B442-2998DC699877.jpg","characteristics":{"color":"Azul Marino","style":"Casual","season":"Invierno/Otoño","pattern":"Other","category":"Top","brand_guess":"Whyci Milano","sub_category":"Top","material_guess":null,"secondary_color":null}},
  {"id":101,"name":"Pantalon Majestic Filatures Terciopelo - Vino","brand":"Majestic Filatures","category":"Pantalón","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/65B2F761-CDFC-468E-A119-4B59A628CEBA.jpg","characteristics":{"color":"Vino","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Pantalón","brand_guess":"Majestic Filatures","sub_category":"Pantalón","material_guess":null,"secondary_color":null}},
  {"id":102,"name":"Pantalon Majestic Filatures Terciopelo - Beige","brand":"Majestic Filatures","category":"Pantalón","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/59D9CB90-36D2-493A-8AD7-5446D72715F2.jpg","characteristics":{"color":"Beige","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Pantalón","brand_guess":"Majestic Filatures","sub_category":"Pantalón","material_guess":null,"secondary_color":null}},
  {"id":103,"name":"Blazer Majestic Filatures Terciopelo - Vino","brand":"Majestic Filatures","category":"Chaqueta","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/C1A8266C-4F3D-4326-B97A-4BA07400AABB.jpg","characteristics":{"color":"Vino","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Chaqueta","brand_guess":"Majestic Filatures","sub_category":"Chaqueta","material_guess":null,"secondary_color":null}},
  {"id":104,"name":"Blazer Majestic Filatures Terciopelo - Beige","brand":"Majestic Filatures","category":"Chaqueta","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/140ADD19-DC7B-45EC-80EE-484AAC642069.jpg","characteristics":{"color":"Beige","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Chaqueta","brand_guess":"Majestic Filatures","sub_category":"Chaqueta","material_guess":null,"secondary_color":null}},
  {"id":105,"name":"Jersey Shirt C-Zero De Rayas - Burdeos","brand":"Shirt C-Zero","category":"Jersey","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/46EB951F-0E40-4A6E-B909-3317B0728F0A.jpg","characteristics":{"color":"Burdeos","style":"Casual","season":"Invierno/Otoño","pattern":"Striped","category":"Jersey","brand_guess":"Shirt C-Zero","sub_category":"Jersey","material_guess":null,"secondary_color":null}},
  {"id":106,"name":"Jersey Shirt C-Zero De Rayas - Negro","brand":"Shirt C-Zero","category":"Jersey","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/F83F84B1-293B-4EC8-885C-9DE308F10332.jpg","characteristics":{"color":"Negro","style":"Casual","season":"Invierno/Otoño","pattern":"Striped","category":"Jersey","brand_guess":"Shirt C-Zero","sub_category":"Jersey","material_guess":null,"secondary_color":null}},
  {"id":107,"name":"Jeans Cigalas Bell Bottom Negro","brand":"CIGALAS","category":"Pantalón","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_14_17.jpg","characteristics":{"color":"Negro","style":"Casual","season":"Invierno/Otoño","pattern":"Solid","category":"Pantalón","brand_guess":"CIGALAS","sub_category":"Pantalón","material_guess":null,"secondary_color":null}},
  {"id":108,"name":"Abrigo Harris Wharf London Pressed Verde","brand":"Harris Wharf London","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/77D8AE6A-4123-4C19-81CC-3363BEDFF766.jpg","characteristics":{"color":"Verde","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Abrigo","brand_guess":"Harris Wharf London","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":109,"name":"Jersey Shirt C-Zero Con Cuello Seda Campana","brand":"Shirt C-Zero","category":"Jersey","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/35C9DCCB-F50A-4F20-9DD4-4F2AB85C7938.jpg","characteristics":{"color":"Marrón","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Jersey","brand_guess":"Shirt C-Zero","sub_category":"Jersey","material_guess":null,"secondary_color":null}},
  {"id":110,"name":"Abanico The Viana Fan Pezenas","brand":"The Viana Fan","category":"Accesorios","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_1_69.jpg","characteristics":{"color":"Natural","style":"Casual","season":"Verano/Primavera","pattern":"Solid","category":"Accesorios","brand_guess":"The Viana Fan","sub_category":"Accesorios","material_guess":null,"secondary_color":null}},
  {"id":111,"name":"Abanico The Viana Fan Portofino","brand":"The Viana Fan","category":"Accesorios","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_3_60.jpg","characteristics":{"color":"Azul","style":"Casual","season":"Verano/Primavera","pattern":"Solid","category":"Accesorios","brand_guess":"The Viana Fan","sub_category":"Accesorios","material_guess":null,"secondary_color":null}},
  {"id":112,"name":"Abanico The Viana Fan Positano","brand":"The Viana Fan","category":"Accesorios","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_1_65.jpg","characteristics":{"color":"Rosa","style":"Casual","season":"Verano/Primavera","pattern":"Solid","category":"Accesorios","brand_guess":"The Viana Fan","sub_category":"Accesorios","material_guess":null,"secondary_color":null}},
  {"id":113,"name":"Abanico The Viana Fan Samana","brand":"The Viana Fan","category":"Accesorios","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/image_9.png","characteristics":{"color":"Verde Lima","style":"Casual","season":"Verano/Primavera","pattern":"Solid","category":"Accesorios","brand_guess":"The Viana Fan","sub_category":"Accesorios","material_guess":null,"secondary_color":null}},
  {"id":114,"name":"Abrigo Diega Terciopelo","brand":"DIEGA","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/9DF66DD3-3E00-4DCE-B99E-D58CA745571F.jpg","characteristics":{"color":"Azul","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Abrigo","brand_guess":"DIEGA","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":115,"name":"Abrigo Ecoalf Marins Piedra","brand":"ECOALF","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/86BC356C-0FFD-4C93-AAA0-9821F93411BE.jpg","characteristics":{"color":"Piedra","style":"Casual","season":"Invierno/Otoño","pattern":"Solid","category":"Abrigo","brand_guess":"ECOALF","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":116,"name":"Abrigo Goodmatch Cuadros Beige","brand":"GOODMATCH","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/1A74E9FD-7324-40A8-9819-32C7EAE16CC0.jpg","characteristics":{"color":"Beige","style":"Elegante","season":"Invierno/Otoño","pattern":"Plaid","category":"Abrigo","brand_guess":"GOODMATCH","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":117,"name":"Abrigo Harris Largo Abertura","brand":"Harris Wharf London","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/ABRIGO_HARRIS_2.jpg","characteristics":{"color":"Beige","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Abrigo","brand_guess":"Harris Wharf London","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":118,"name":"Abrigo Harris Wharf London Dos Botones Crema","brand":"Harris Wharf London","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/Abrigo_Harris_Wharf_London_Dos_Botones_crema_8105119e-0b8a-48ae-92e6-2fdd42ba4767.jpg","characteristics":{"color":"Crema","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Abrigo","brand_guess":"Harris Wharf London","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":119,"name":"Abrigo Harris Wharf London Over Boiled Wool Beige","brand":"Harris Wharf London","category":"Chaqueta","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/IMG_2441_1_f85cefe2-3982-452d-b339-9d150dcac867.jpg","characteristics":{"color":"Beige","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Chaqueta","brand_guess":"Harris Wharf London","sub_category":"Chaqueta","material_guess":null,"secondary_color":null}},
  {"id":120,"name":"Abrigo Harris Wharf London Pressed Rojo","brand":"Harris Wharf London","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/E808A3EE-A45A-460C-BED4-51379FF0324D.jpg","characteristics":{"color":"Rojo","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Abrigo","brand_guess":"Harris Wharf London","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":121,"name":"Abrigo Sunny Studio Largo","brand":"SUNNY STUDIO","category":"Abrigo","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/60B87011-2224-4EAE-B34D-9D1098E74755.jpg","characteristics":{"color":"Camel","style":"Elegante","season":"Invierno/Otoño","pattern":"Solid","category":"Abrigo","brand_guess":"SUNNY STUDIO","sub_category":"Abrigo","material_guess":null,"secondary_color":null}},
  {"id":122,"name":"Bailarina Le Capresi Pulsera Piedras Oro","brand":"LE CAPRESI","category":"Calzado","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/pixelcut_4_23.jpg","characteristics":{"color":"Dorado","style":"Elegante","season":"Verano/Primavera","pattern":"Solid","category":"Calzado","brand_guess":"LE CAPRESI","sub_category":"Calzado","material_guess":null,"secondary_color":null}},
  {"id":124,"name":"Billetero Anna Kaszer Granate","brand":"Anna Kaszer","category":"Accesorios","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/61001328-479C-4080-B93D-1CFEA0DF551F.jpg","characteristics":{"color":"Granate","style":"Casual","season":"Invierno/Otoño","pattern":"Solid","category":"Accesorios","brand_guess":"Anna Kaszer","sub_category":"Accesorios","material_guess":null,"secondary_color":null}},
  {"id":125,"name":"Billetero Anna Kaszer Marron","brand":"Anna Kaszer","category":"Accesorios","image_url":"https://cdn.shopify.com/s/files/1/0654/2937/3183/files/A73EAAA3-53BB-4AA0-B043-B9176B3ABC75.jpg","characteristics":{"color":"Marrón","style":"Casual","season":"Invierno/Otoño","pattern":"Solid","category":"Accesorios","brand_guess":"Anna Kaszer","sub_category":"Accesorios","material_guess":null,"secondary_color":null}}
];

// Normalizar categoria para Shopify
function normalizeCategory(category) {
  const cat = category.toLowerCase();
  const mapping = {
    'abrigo': 'Abrigos',
    'chaqueta': 'Chaquetas',
    'blazer': 'Chaquetas',
    'jersey': 'Jerseys',
    'pantalon': 'Pantalones',
    'pantalón': 'Pantalones',
    'calzado': 'Calzado',
    'blusa': 'Blusas y Tops',
    'top': 'Blusas y Tops',
    'vestido': 'Vestidos',
    'accesorios': 'Accesorios'
  };
  return mapping[cat] || category;
}

// Construir tags para el producto
function buildTags(item) {
  const tags = [];
  const chars = item.characteristics || {};

  if (item.brand) tags.push(item.brand);
  if (item.category) tags.push(item.category);
  if (chars.color) tags.push(chars.color);
  if (chars.style) tags.push(chars.style);
  if (chars.season) tags.push(chars.season);
  if (chars.sub_category) tags.push(chars.sub_category);
  if (chars.material_guess) tags.push(chars.material_guess);
  if (chars.pattern && chars.pattern !== 'Solid') tags.push(chars.pattern);

  return tags.filter(t => t).join(', ');
}

// Construir descripcion HTML
function buildDescription(item) {
  const chars = item.characteristics || {};
  let desc = chars.description || '';

  const details = [];
  if (chars.color) details.push(`<strong>Color:</strong> ${chars.color}`);
  if (chars.style) details.push(`<strong>Estilo:</strong> ${chars.style}`);
  if (chars.season) details.push(`<strong>Temporada:</strong> ${chars.season}`);
  if (chars.material_guess) details.push(`<strong>Material:</strong> ${chars.material_guess}`);

  if (details.length > 0) {
    desc += `<br><br><ul>${details.map(d => `<li>${d}</li>`).join('')}</ul>`;
  }

  return desc || `${item.name} de ${item.brand}`;
}

// Crear producto via GraphQL
async function createProduct(item) {
  const mutation = `
    mutation productCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
      productCreate(input: $input, media: $media) {
        product {
          id
          title
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      title: item.name,
      vendor: item.brand,
      productType: normalizeCategory(item.category),
      tags: buildTags(item).split(', '),
      descriptionHtml: buildDescription(item),
      status: "ACTIVE"
    },
    media: [{
      originalSource: item.image_url,
      mediaContentType: "IMAGE"
    }]
  };

  const response = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify({ query: mutation, variables })
    }
  );

  return response.json();
}

// Delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Main sync function
async function syncProducts() {
  console.log('='.repeat(60));
  console.log('SINCRONIZACION DE PRODUCTOS SUPABASE -> SHOPIFY');
  console.log('='.repeat(60));
  console.log(`Total de items a sincronizar: ${items.length}`);
  console.log(`Tienda: ${SHOPIFY_STORE}`);
  console.log('='.repeat(60));
  console.log('');

  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const progress = `[${i + 1}/${items.length}]`;

    console.log(`${progress} Creando: ${item.name}...`);

    try {
      const response = await createProduct(item);

      if (response.data?.productCreate?.userErrors?.length > 0) {
        const errors = response.data.productCreate.userErrors;
        console.log(`   ERROR: ${errors.map(e => e.message).join(', ')}`);
        results.failed.push({ item, errors });
      } else if (response.data?.productCreate?.product) {
        const product = response.data.productCreate.product;
        console.log(`   OK -> ID: ${product.id}, Handle: ${product.handle}`);
        results.success.push({ item, product });
      } else if (response.errors) {
        console.log(`   ERROR API: ${response.errors.map(e => e.message).join(', ')}`);
        results.failed.push({ item, errors: response.errors });
      }
    } catch (error) {
      console.log(`   EXCEPTION: ${error.message}`);
      results.failed.push({ item, errors: [{ message: error.message }] });
    }

    // Rate limiting: esperar 500ms entre requests
    await delay(500);
  }

  // Resumen final
  console.log('');
  console.log('='.repeat(60));
  console.log('RESUMEN DE SINCRONIZACION');
  console.log('='.repeat(60));
  console.log(`Productos creados exitosamente: ${results.success.length}`);
  console.log(`Productos con errores: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('');
    console.log('Productos fallidos:');
    results.failed.forEach(f => {
      console.log(`  - ${f.item.name}: ${f.errors.map(e => e.message).join(', ')}`);
    });
  }

  console.log('');
  console.log('Sincronizacion completada!');

  return results;
}

// Run
syncProducts().catch(console.error);
