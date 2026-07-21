'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTweaks } from '@/lib/providers/tweaks-provider';
import { PeerlyAvatar } from './ui/peer-avatar';
import { AnonLabel } from './ui/anon-label';
import { ImageCarousel } from './ui/image-carousel';
import { formatRelativeTime } from '@/lib/time';
import { usePostVote, useDeletePost, type PostResponse } from '@/lib/hooks/useFeed';
import { ReportModal } from './ui/report-modal';

interface PostCardProps {
  post: PostResponse;
  onClick?: () => void;
}

const ANON_NAMES = ['Anonymous Peer', 'Anonymous @'];
function isAnonymousDisplay(username: string) {
  return ANON_NAMES.some(n => username.startsWith(n));
}

export function PostCard({ post, onClick }: PostCardProps) {
  const { cardLayout } = useTweaks();
  const { localVote, localUpvotes, handleVote } = usePostVote(post);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const deletePost = useDeletePost();
  const router = useRouter();

  const isAnon = post.is_anonymous && isAnonymousDisplay(post.display_author.username);
  const displayName = isAnon ? null : (post.display_author.name || post.display_author.username);
  const trending = post.heat_score > 10;

  const cardClass =
    cardLayout === 'filled'
      ? 'bg-[var(--card)] border border-[var(--border)] rounded-xl p-[18px_20px] mb-2'
      : 'bg-[var(--background)] border border-[var(--border)] rounded-xl p-[18px_20px] mb-2';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (!confirm('Delete this post?')) return;
    deletePost.mutate(post.id, {
      onSuccess: () => toast.success('Post deleted'),
      onError: () => toast.error('Failed to delete post'),
    });
  };

  return (
    <div className={`${cardClass} cursor-pointer transition-colors duration-150`} onClick={onClick}>
      {/* Author */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <PeerlyAvatar
          name={post.display_author.username}
          src={post.display_author.avatar_url ?? undefined}
          size={34}
          anon={isAnon}
        />
        <div>
          {isAnon
            ? <span className="text-[13px] text-[var(--muted)]">{post.display_author.username}</span>
            : <span className="text-[13px] font-semibold text-[var(--foreground)]">{displayName}</span>}
          <div className="flex gap-1.5 mt-px">
            <span className="text-xs text-[var(--muted)]">{formatRelativeTime(post.created_at)}</span>
            {post.is_global && <span className="text-xs text-[var(--accent)] font-medium">Global</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-[15px] leading-relaxed text-[var(--foreground)] mb-2.5">{post.content}</p>

      {post.image_urls?.length > 0 && (
        <div onClick={e => e.stopPropagation()} className="mb-2.5">
          <ImageCarousel urls={post.image_urls} maxHeight={360} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={e => { e.stopPropagation(); handleVote('up'); }}
          className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-[13px] p-0 font-[inherit] transition-colors"
          style={{ color: localVote === 'up' ? 'var(--accent)' : 'var(--muted)', fontWeight: localVote === 'up' ? 600 : 400 }}
        >↑ {localUpvotes}</button>

        <button
          onClick={e => { e.stopPropagation(); handleVote('down'); }}
          className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-[13px] p-0 font-[inherit]"
          style={{ color: localVote === 'down' ? '#C0392B' : 'var(--muted)' }}
        >↓</button>

        <span className="text-[var(--muted)] text-[13px]">💬 {post.comment_count}</span>

        {trending && (
          <span className="text-[11px] font-semibold text-[var(--accent)] tracking-wider uppercase">Trending</span>
        )}

        {/* ⋯ menu — always visible */}
        <div className="ml-auto relative">
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            className="bg-transparent border-none cursor-pointer text-[var(--muted)] text-base px-1 leading-none"
          >⋯</button>

          {showMenu && (
            <>
              <div
                onClick={e => { e.stopPropagation(); setShowMenu(false); }}
                className="fixed inset-0 z-20"
              />
              <div className="absolute right-0 top-full z-30 mt-1 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-md min-w-[130px] overflow-hidden">
                {post.is_own ? (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); setShowMenu(false); router.push(`/posts/${post.id}`); }}
                      className="block w-full text-left px-3.5 py-2.5 bg-transparent border-none cursor-pointer text-[13px] text-[var(--foreground)] font-[inherit]"
                    >
                      View post
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deletePost.isPending}
                      className="block w-full text-left px-3.5 py-2.5 bg-transparent border-none cursor-pointer text-[13px] text-red-500 font-[inherit]"
                      style={{ opacity: deletePost.isPending ? 0.6 : 1 }}
                    >
                      {deletePost.isPending ? 'Deleting…' : 'Delete post'}
                    </button>
                  </>
                ) : (
                  <>
                    {post.user_has_reported ? (
                      <div className="px-3.5 py-2.5 text-[13px] text-[var(--muted)]">
                        Reported
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setShowMenu(false); setShowReport(true); }}
                        className="block w-full text-left px-3.5 py-2.5 bg-transparent border-none cursor-pointer text-[13px] text-[var(--foreground)] font-[inherit]"
                      >
                        Report post
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showReport && <ReportModal postId={post.id} onClose={() => setShowReport(false)} />}
    </div>
  );
}
