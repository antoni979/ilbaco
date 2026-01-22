-- Add model_photo_url column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS model_photo_url TEXT;

-- Create storage bucket for model photos if it doesn't exist
-- Note: In pure SQL without Supabase dashboard, we insert into storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('model-photos', 'model-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for model-photos bucket

-- Policy to allow authenticated users to view their own photos (or all public photos)
-- Since it's public, anyone can view if they have the URL, but let's restrict listing if possible or just allow standard public access
CREATE POLICY "Model photos are publicly accessible"
ON storage.objects FOR SELECT
USING ( bucket_id = 'model-photos' );

-- Policy to allow users to upload their own photos
CREATE POLICY "Users can upload their own model photo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'model-photos' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- Policy to allow users to update their own photos
CREATE POLICY "Users can update their own model photo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'model-photos' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- Policy to allow users to delete their own photos
CREATE POLICY "Users can delete their own model photo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'model-photos' AND 
  auth.uid() = (storage.foldername(name))[1]::uuid
);
