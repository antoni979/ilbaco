-- Tabla para cachear resultados del Probador Virtual
-- Evita regenerar imágenes que ya se crearon (ahorro de API calls)

CREATE TABLE IF NOT EXISTS public.vton_cache (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    top_item_id BIGINT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    bottom_item_id BIGINT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    result_image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice único para evitar duplicados y búsquedas rápidas
-- Una combinación user+top+bottom solo puede tener UN resultado
CREATE UNIQUE INDEX IF NOT EXISTS vton_cache_unique_combo
ON public.vton_cache (user_id, top_item_id, bottom_item_id);

-- Índice para búsquedas por usuario
CREATE INDEX IF NOT EXISTS vton_cache_user_id_idx
ON public.vton_cache (user_id);

-- Índice para limpiar resultados antiguos (opcional)
CREATE INDEX IF NOT EXISTS vton_cache_created_at_idx
ON public.vton_cache (created_at DESC);

-- Políticas RLS (Row Level Security)
ALTER TABLE public.vton_cache ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver sus propios resultados
CREATE POLICY "Users can view their own vton results"
ON public.vton_cache
FOR SELECT
USING (auth.uid() = user_id);

-- Política: Los usuarios pueden insertar sus propios resultados
CREATE POLICY "Users can insert their own vton results"
ON public.vton_cache
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden actualizar sus propios resultados
CREATE POLICY "Users can update their own vton results"
ON public.vton_cache
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden eliminar sus propios resultados
CREATE POLICY "Users can delete their own vton results"
ON public.vton_cache
FOR DELETE
USING (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_vton_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_vton_cache_updated_at_trigger
BEFORE UPDATE ON public.vton_cache
FOR EACH ROW
EXECUTE FUNCTION update_vton_cache_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE public.vton_cache IS 'Caché de resultados del probador virtual para evitar regenerar imágenes';
COMMENT ON COLUMN public.vton_cache.user_id IS 'ID del usuario que generó el resultado';
COMMENT ON COLUMN public.vton_cache.top_item_id IS 'ID de la prenda superior usada';
COMMENT ON COLUMN public.vton_cache.bottom_item_id IS 'ID de la prenda inferior usada';
COMMENT ON COLUMN public.vton_cache.result_image_url IS 'URL de la imagen generada (data URI o Storage URL)';
COMMENT ON COLUMN public.vton_cache.created_at IS 'Fecha de creación del resultado';
COMMENT ON COLUMN public.vton_cache.updated_at IS 'Fecha de última actualización';
