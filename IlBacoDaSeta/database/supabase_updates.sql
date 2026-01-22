-- 1. Modificar tabla items para guardar el analisis de la IA
alter table public.items 
add column if not exists characteristics jsonb;

-- 2. Crear Bucket de Storage (Si no lo has creado por interfaz)
insert into storage.buckets (id, name, public)
values ('closet-items', 'closet-items', true)
on conflict (id) do nothing;

-- 3. Políticas de Seguridad para el Storage (RSL)

-- Permitir ver las imagenes a cualquiera (necesario para que la app las muestre publcamente si es necesario, o restringir a auth)
create policy "Ver imagenes de armario"
  on storage.objects for select
  using ( bucket_id = 'closet-items' );

-- Permitir subir imagenes solo a usuarios autenticados
create policy "Subir imagenes de armario"
  on storage.objects for insert
  with check ( bucket_id = 'closet-items' and auth.uid() = owner );

-- Permitir actualizar solo tus imagenes
create policy "Actualizar tus imagenes"
  on storage.objects for update
  using ( bucket_id = 'closet-items' and auth.uid() = owner );

-- Permitir borrar solo tus imagenes
create policy "Borrar tus imagenes"
  on storage.objects for delete
  using ( bucket_id = 'closet-items' and auth.uid() = owner );
