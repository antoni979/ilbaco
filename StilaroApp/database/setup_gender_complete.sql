-- Script completo para configurar el campo gender en profiles
-- Ejecuta este script en el SQL Editor de Supabase Dashboard

-- 1. Agregar campo de género a la tabla profiles (si no existe)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', NULL));

-- 2. Actualizar la función handle_new_user para incluir el género
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, gender)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'gender'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Verificar que las políticas RLS permitan actualizaciones
-- Esta política ya debería existir del schema inicial, pero la incluimos por seguridad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Users can update own profile.'
  ) THEN
    CREATE POLICY "Users can update own profile."
      ON profiles FOR UPDATE
      USING ( auth.uid() = id );
  END IF;
END $$;

-- 4. Comentario de verificación
-- Después de ejecutar este script, verifica que la columna existe con:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name = 'gender';
