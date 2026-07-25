'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import { PeerlyAvatar } from '@/components/ui/peer-avatar';
import { Button } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { useMe, useLogout } from '@/lib/hooks/useAuth';
import { useMyProfile, usePublicProfile } from '@/lib/hooks/useProfile';
import { useUserPosts } from '@/lib/hooks/useFeed';
import { ProfileSkeleton } from '@/components/skeletons';
import { PostCard } from '@/components/post-card';
import { toast } from 'sonner';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'posts' | 'anonymous'>('posts');
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const logout = useLogout();

  const { data: me, isLoading: meLoading } = useMe();
  const isSelf = !username || username === 'me' || username === me?.profile?.username;

  const { data: myProfile, isLoading: myLoading } = useMyProfile();
  const { data: publicProfile, isLoading: pubLoading } = usePublicProfile(isSelf ? '' : username);

  const isLoading = meLoading || (isSelf ? myLoading : pubLoading);
  const profile = isSelf ? myProfile : publicProfile;

  const targetUsername = profile?.username ?? '';
  const { data: posts, isLoading: postsLoading } = useUserPosts(targetUsername, false);
  const { data: anonPosts, isLoading: anonLoading } = useUserPosts(isSelf ? targetUsername : '', true);

  if (isLoading) return <ContentShell><ProfileSkeleton /></ContentShell>;
  if (!profile) return <ContentShell><div className="text-sm text-red-500">Profile not found.</div></ContentShell>;

  const displayName = profile.name ?? (isSelf ? me?.email : profile.username) ?? 'Unknown';
  const uname = profile.username ?? '';
  const bio = profile.bio ?? '';

  return (
    <ContentShell>
      {/* Header */}
      <div className="flex items-start gap-5 mb-7">
        <PeerlyAvatar name={displayName} src={profile.avatar_url ?? undefined} size={68} />
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-[20px] font-semibold text-[var(--foreground)] tracking-tight m-0">{displayName}</h1>
            {uname && <span className="text-[13px] text-[var(--muted)]">@{uname}</span>}
          </div>
          {bio && <p className="text-sm text-[var(--muted)] leading-relaxed mb-3">{bio}</p>}
        </div>
        {isSelf && (
          <Button variant="secondary" size="sm" onClick={() => router.push('/profile/edit')}>
            Edit profile
          </Button>
        )}
      </div>

      <Divider />

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-5 mt-0">
        {(isSelf
          ? [['posts', 'Posts'], ['anonymous', 'Anonymous']] as const
          : [['posts', 'Posts']] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className="py-3 mr-6 bg-transparent border-none cursor-pointer font-[inherit] text-sm transition-all duration-150 -mb-px"
            style={{
              fontWeight: activeTab === id ? 600 : 400,
              color: activeTab === id ? 'var(--foreground)' : 'var(--muted)',
              borderBottom: activeTab === id ? '2px solid var(--foreground)' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {activeTab === 'posts' ? (
        postsLoading
          ? <div className="py-6 text-center text-[13px] text-[var(--muted)]">Loading…</div>
          : !posts?.length
            ? <div className="py-6 text-center text-[13px] text-[var(--muted)]">No posts yet.</div>
            : <div className="flex flex-col gap-3">{posts.map(p => <PostCard key={p.id} post={p} />)}</div>
      ) : (
        anonLoading
          ? <div className="py-6 text-center text-[13px] text-[var(--muted)]">Loading…</div>
          : !anonPosts?.length
            ? <div className="py-10 text-center text-[13px] text-[var(--muted)] leading-relaxed">No anonymous posts yet.</div>
            : <div className="flex flex-col gap-3">{anonPosts.map(p => <PostCard key={p.id} post={p} />)}</div>
      )}

      {/* Footer */}
      {isSelf && (
        <div className="mt-9 pt-6 border-t border-[var(--border)] flex gap-4 flex-wrap">
          <button className="bg-transparent border-none cursor-pointer font-[inherit] text-[13px] text-[var(--muted)] p-0 underline underline-offset-[3px]">
            Account settings
          </button>
          <button className="bg-transparent border-none cursor-pointer font-[inherit] text-[13px] text-[var(--muted)] p-0 underline underline-offset-[3px]">
            Privacy
          </button>
          <button
            onClick={() => { toast.success('Signed out'); logout(); }}
            className="bg-transparent border-none cursor-pointer font-[inherit] text-[13px] text-red-500 p-0 underline underline-offset-[3px]"
          >
            Sign out
          </button>
        </div>
      )}
    </ContentShell>
  );
}
