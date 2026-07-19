'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { ContentShell } from '@/components/content-shell';
import { PeerlyAvatar } from '@/components/ui/peer-avatar';
import { AnonLabel } from '@/components/ui/anon-label';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { useCreatePost } from '@/lib/hooks/useFeed';
import { uploadImage } from '@/lib/cloudinary';
import { toast } from 'sonner';
import type { ApiError } from '@/lib/types';

const CHAR_LIMIT = 500;
const CLOUDINARY_OK =
  !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
  !!process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export default function CreatePostPage() {
  const [content, setContent] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [isGlobal, setIsGlobal] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const router = useRouter();
  const createPost = useCreatePost();

  useEffect(() => {
    return () => { imagePreviews.forEach(URL.revokeObjectURL); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const imageCompression = (await import('browser-image-compression')).default;
    const files: File[] = [];
    const previews: string[] = [];
    for (const file of acceptedFiles.slice(0, 4)) {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
      files.push(compressed as File);
      previews.push(URL.createObjectURL(compressed));
    }
    setImageFiles(prev => [...prev, ...files].slice(0, 4));
    setImagePreviews(prev => [...prev, ...previews].slice(0, 4));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 4,
  });

  const handlePublish = async () => {
    if (!content.trim()) return;
    setUploadError('');
    setUploading(true);
    const toastId = toast.loading('Publishing post…');
    try {
      const image_urls = imageFiles.length > 0 ? await Promise.all(imageFiles.map(uploadImage)) : [];
      createPost.mutate(
        { content: content.trim(), image_urls, is_global: isGlobal, is_anonymous: isAnon },
        {
          onSuccess: () => { toast.success('Post published!', { id: toastId }); router.push('/feed'); },
          onError: (e) => { toast.error((e as ApiError).response?.data?.error ?? 'Failed to publish', { id: toastId }); },
        }
      );
    } catch {
      setUploadError('Image upload failed. Try again.');
      toast.error('Image upload failed', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const isPending = uploading || createPost.isPending;
  const errorMsg = uploadError || ((createPost.error as ApiError)?.response?.data?.error ?? '');

  return (
    <ContentShell maxWidth={600}>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer font-[inherit] text-[13px] text-[var(--muted)] p-0 mb-6"
      >
        ← Cancel
      </button>

      <h1 className="text-[22px] font-semibold text-[var(--foreground)] tracking-tight mb-6">New post</h1>

      <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--card)]">

        {/* Author row */}
        <div className="flex items-center gap-3 mb-5">
          <PeerlyAvatar name={isAnon ? '?' : 'You'} size={38} anon={isAnon} />
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {isAnon ? <AnonLabel scope={isGlobal ? 'global' : 'campus'} /> : 'You'}
            </div>
            <div className="text-xs text-[var(--muted)] mt-0.5">{isGlobal ? 'Visible globally' : 'Your campus'}</div>
          </div>
        </div>

        {/* Text area */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value.slice(0, CHAR_LIMIT))}
          placeholder="What's on your mind?"
          className="w-full py-3.5 bg-transparent border-none border-b border-[var(--border)] text-[16px] leading-[1.65] text-[var(--foreground)] font-[inherit] outline-none resize-none min-h-[140px]"
          style={{ borderBottom: '1px solid var(--border)' }}
        />
        <div className={`text-right text-xs mt-1.5 mb-5 ${content.length > CHAR_LIMIT * 0.85 ? 'text-red-500' : 'text-[var(--muted)]'}`}>
          {CHAR_LIMIT - content.length}
        </div>

        {/* Image upload */}
        {!CLOUDINARY_OK ? (
          <div className="px-4 py-3 bg-red-500/7 border border-red-600/25 rounded-lg text-[13px] text-red-500 mb-6">
            Image uploads unavailable — Cloudinary env vars not configured.
          </div>
        ) : (
          <div className="mb-6">
            {imagePreviews.length > 0 ? (
              <div
                className="grid gap-2 mb-2.5"
                style={{ gridTemplateColumns: imagePreviews.length === 1 ? '1fr' : 'repeat(2, 1fr)' }}
              >
                {imagePreviews.map((url, i) => (
                  <div
                    key={i}
                    className="relative rounded-xl overflow-hidden bg-[var(--border)]"
                    style={{ aspectRatio: imagePreviews.length === 1 ? '16/9' : '1/1' }}
                  >
                    <img
                      src={url} alt=""
                      onClick={e => { e.stopPropagation(); setLightboxSrc(url); }}
                      className="w-full h-full object-cover cursor-zoom-in"
                    />
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setImageFiles(f => f.filter((_, j) => j !== i));
                        setImagePreviews(p => p.filter((_, j) => j !== i));
                      }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 border-none text-white text-[13px] cursor-pointer flex items-center justify-center leading-none"
                    >×</button>
                  </div>
                ))}
                {imagePreviews.length < 4 && (
                  <div
                    {...getRootProps()}
                    className="rounded-xl flex flex-col items-center justify-center cursor-pointer gap-1 transition-all duration-150"
                    style={{
                      aspectRatio: '1/1',
                      border: `1px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
                      background: isDragActive ? 'rgba(45,106,79,.04)' : 'transparent',
                    }}
                  >
                    <input {...getInputProps()} />
                    <span className="text-[22px] text-[var(--muted)] leading-none">+</span>
                    <span className="text-[11px] text-[var(--muted)]">Add more</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                {...getRootProps()}
                className="rounded-xl px-5 py-8 text-center cursor-pointer transition-all duration-150"
                style={{
                  border: `1px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
                  background: isDragActive ? 'rgba(45,106,79,.04)' : 'transparent',
                }}
              >
                <input {...getInputProps()} />
                <div className="text-[28px] mb-2.5 opacity-35 leading-none">🖼</div>
                <div className="text-[13px] font-medium text-[var(--foreground)] mb-1">Drag & drop images here</div>
                <div className="text-xs text-[var(--muted)]">or click to browse · up to 4 images · auto-compressed to 1 MB</div>
              </div>
            )}
          </div>
        )}

        {errorMsg && <ErrorMessage message={errorMsg} />}

        {/* Toggles */}
        <div className="flex flex-col border border-[var(--border)] rounded-xl overflow-hidden mb-7">
          {[
            { label: 'Post anonymously', sub: "Your name won't be shown", val: isAnon, set: setIsAnon },
            { label: 'Share globally', sub: 'Visible to all whitelisted campuses', val: isGlobal, set: setIsGlobal },
          ].map((item, i) => (
            <div
              key={item.label}
              onClick={() => item.set(!item.val)}
              className="flex items-center justify-between px-4 py-3.5 cursor-pointer bg-[var(--background)]"
              style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}
            >
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">{item.label}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{item.sub}</div>
              </div>
              <div
                className="w-10 h-[22px] rounded-full relative transition-colors duration-200 shrink-0"
                style={{ background: item.val ? 'var(--accent)' : 'var(--border)' }}
              >
                <div
                  className="w-4 h-4 rounded-full bg-white absolute top-[3px] transition-all duration-200 shadow-sm"
                  style={{ left: item.val ? 21 : 3 }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button size="lg" disabled={!content.trim() || isPending} onClick={handlePublish}>
            {isPending ? (uploading ? 'Uploading…' : 'Publishing…') : 'Publish post'}
          </Button>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-6 cursor-zoom-out"
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-5 bg-white/12 border-none text-white text-xl w-9 h-9 rounded-full cursor-pointer flex items-center justify-center leading-none"
          >×</button>
          <img
            src={lightboxSrc} alt=""
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-[0_8px_48px_rgba(0,0,0,0.6)] cursor-default"
          />
        </div>
      )}
    </ContentShell>
  );
}
