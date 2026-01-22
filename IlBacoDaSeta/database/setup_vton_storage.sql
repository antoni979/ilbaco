-- Create a public storage bucket for Virtual Try-On temporary images
insert into storage.buckets (id, name, public)
values ('vton', 'vton', true)
on conflict (id) do nothing;

-- Policy to allow authenticated users to upload images to the 'vton' bucket
create policy "Authenticated users can upload vton images"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'vton' );

-- Policy to allow anyone to view (read) images in the 'vton' bucket
-- This is required so Replicate API can download them for processing
create policy "Public can view vton images"
on storage.objects for select
to public
using ( bucket_id = 'vton' );

-- Policy to allow users to delete their own images (optional, for cleanup)
create policy "Users can delete their own vton images"
on storage.objects for delete
to authenticated
using ( bucket_id = 'vton' AND auth.uid() = owner );
