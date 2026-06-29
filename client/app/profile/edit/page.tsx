'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import { PeerlyAvatar } from '@/components/ui/peer-avatar';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { useMyProfile, useUpdateProfile } from '@/lib/hooks/useProfile';
import { uploadImage } from '@/lib/cloudinary';

export default function ProfileEditPage() {
  const router = useRouter();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  if (isLoading) {
    return <ContentShell><div className="text-sm text-[var(--muted)]">Loading…</div></ContentShell>;
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploading(true);
    try {
      let avatar_url = profile?.avatar_url ?? undefined;
      if (avatarFile) {
        const imageCompression = (await import('browser-image-compression')).default;
        const compressed = await imageCompression(avatarFile, { maxSizeMB: 0.5, maxWidthOrHeight: 400 });
        avatar_url = await uploadImage(compressed as File);
      }
      await updateProfile.mutateAsync({ name: name.trim() || undefined, bio: bio.trim(), avatar_url });
      router.push('/profile/me');
    } catch {
      setError('Failed to save profile');
    } finally {
      setUploading(false);
    }
  };

  const currentAvatar = avatarPreview ?? profile?.avatar_url ?? undefined;
  const displayName = name || profile?.username || 'You';
  const isPending = uploading || updateProfile.isPending;

  return (
    <ContentShell maxWidth={520}>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer font-[inherit] text-[13px] text-[var(--muted)] p-0 mb-6"
      >
        ← Cancel
      </button>

      <h1 className="text-[22px] font-semibold text-[var(--foreground)] tracking-tight mb-7">Edit profile</h1>

      <form onSubmit={handleSave}>
        {/* Avatar upload */}
        <div className="flex items-center gap-4 mb-7">
          <div className="relative">
            <PeerlyAvatar name={displayName} src={currentAvatar} size={72} />
            <label className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity duration-150">
              <span className="text-[11px] text-white font-semibold">Change</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <div className="text-[13px] text-[var(--muted)]">Hover avatar to change photo</div>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4 mb-7">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 tracking-widest uppercase">
              Display name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--accent)] font-[inherit]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 tracking-widest uppercase">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 200))}
              placeholder="A short bio…"
              rows={3}
              className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--accent)] font-[inherit] resize-none"
            />
            <div className="text-right text-xs text-[var(--muted)] mt-1">{200 - bio.length}</div>
          </div>
        </div>

        <ErrorMessage message={error} />

        <div className="flex justify-end gap-2.5 mt-4">
          <Button variant="ghost" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (uploading ? 'Uploading…' : 'Saving…') : 'Save changes'}
          </Button>
        </div>
      </form>
    </ContentShell>
  );
}
