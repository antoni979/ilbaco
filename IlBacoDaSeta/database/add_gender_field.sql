-- Agregar campo de género a la tabla profiles
ALTER TABLE public.profiles
ADD COLUMN gender text CHECK (gender IN ('male', 'female', 'other', NULL));

-- Actualizar la función handle_new_user para incluir el género
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
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario: Ejecuta este script en tu dashboard de Supabase (SQL Editor)
-- para agregar el campo de género a los perfiles de usuario.
