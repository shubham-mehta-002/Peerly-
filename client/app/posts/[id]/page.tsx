'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import { PeerlyAvatar } from '@/components/ui/peer-avatar';
import { AnonLabel } from '@/components/ui/anon-label';
import { Button } from '@/components/ui/button';
import { ImageCarousel } from '@/components/ui/image-carousel';
import { ReportModal } from '@/components/ui/report-modal';
import { usePost, usePostVote, type PostResponse } from '@/lib/hooks/useFeed';
import { useComments, useAddComment, type CommentResponse } from '@/lib/hooks/useComments';
import { PostDetailSkeleton, CommentsSkeleton } from '@/components/skeletons';
import { formatRelativeTime } from '@/lib/time';

const ANON_PREFIXES = ['Anonymous Peer', 'Anonymous @'];
function isAnon(username: string) { return ANON_PREFIXES.some(p => username.startsWith(p)); }

function buildTree(comments: CommentResponse[]): Map<string | null, CommentResponse[]> {
  const map = new Map<string | null, CommentResponse[]>();
  for (const c of comments) {
    const key = c.parent_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return map;
}

function CommentNode({ comment, tree, depth, postId }: {
  comment: CommentResponse;
  tree: Map<string | null, CommentResponse[]>;
  depth: number;
  postId: string;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const addComment = useAddComment();
  const commentIsAnon = isAnon(comment.author.username);
  const displayName = commentIsAnon ? null : comment.author.username;
  const children = tree.get(comment.id) ?? [];
  const indentPx = Math.min(depth, 2) * 20;

  const handleReply = () => {
    if (!replyText.trim()) return;
    addComment.mutate(
      { postId, content: replyText.trim(), parent_id: comment.id },
      { onSuccess: () => { setReplyText(''); setReplying(false); } }
    );
  };

  return (
    <div style={{ paddingLeft: indentPx }}>
      <div
        className="flex gap-2.5 pt-3 pb-1"
        style={{
          borderTop: depth === 0 ? '1px solid var(--border)' : 'none',
          borderLeft: depth > 0 ? '2px solid var(--border)' : 'none',
          paddingLeft: depth > 0 ? 10 : 0,
          marginLeft: depth > 0 ? -10 : 0,
        }}
      >
        <PeerlyAvatar name={comment.author.username} src={comment.author.avatar_url ?? undefined} size={28} anon={commentIsAnon} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {commentIsAnon
              ? <AnonLabel scope="campus" />
              : <span className="text-[13px] font-semibold text-[var(--foreground)]">{displayName}</span>}
            <span className="text-xs text-[var(--muted)]">{formatRelativeTime(comment.created_at)}</span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--foreground)] mb-1.5">{comment.content}</p>
          <button
            onClick={() => setReplying(v => !v)}
            className="bg-transparent border-none cursor-pointer p-0 text-xs text-[var(--muted)] font-medium font-[inherit]"
          >
            {replying ? 'Cancel' : 'Reply'}
          </button>

          {replying && (
            <div className="mt-2 flex flex-col gap-1.5">
              <textarea
                autoFocus
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Reply to ${commentIsAnon ? 'Anonymous' : displayName}…`}
                className="w-full px-2.5 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--foreground)] font-[inherit] outline-none resize-none min-h-[60px]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setReplying(false); setReplyText(''); }}>Cancel</Button>
                <Button size="sm" onClick={handleReply} disabled={addComment.isPending || !replyText.trim()}>
                  {addComment.isPending ? '…' : 'Reply'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div style={{ marginLeft: depth < 2 ? 20 : 0 }}>
          {children.map(child => (
            <CommentNode key={child.id} comment={child} tree={tree} depth={depth + 1} postId={postId} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostContent({ post, postId }: { post: PostResponse; postId: string }) {
  const [comment, setComment] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const router = useRouter();
  const { data: comments = [], isLoading: commentsLoading } = useComments(postId);
  const addComment = useAddComment();
  const { localVote, localUpvotes, handleVote } = usePostVote(post);

  const authorIsAnon = post.is_anonymous && isAnon(post.display_author.username);
  const displayName = authorIsAnon ? null : (post.display_author.name || post.display_author.username);
  const trending = post.heat_score > 10;
  const tree = buildTree(comments);
  const roots = tree.get(null) ?? [];

  const handleComment = () => {
    if (!comment.trim()) return;
    addComment.mutate({ postId, content: comment.trim() }, { onSuccess: () => setComment('') });
  };

  return (
    <>
      <button
        onClick={() => router.push('/feed')}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer font-[inherit] text-[13px] text-[var(--muted)] p-0 mb-6"
      >
        ← Back to feed
      </button>

      <div className="border-b border-[var(--border)] pb-6 mb-7">
        <div className="flex items-center gap-2.5 mb-3.5">
          <PeerlyAvatar name={post.display_author.username} src={post.display_author.avatar_url ?? undefined} size={38} anon={authorIsAnon} />
          <div>
            {authorIsAnon
              ? <AnonLabel scope={post.is_global ? 'global' : 'campus'} />
              : <span className="text-sm font-semibold text-[var(--foreground)]">{displayName}</span>}
            <div className="flex gap-2 items-center mt-0.5">
              <span className="text-xs text-[var(--muted)]">{formatRelativeTime(post.created_at)}</span>
              {post.is_global && <span className="text-xs text-[var(--accent)] font-medium">Global</span>}
              {trending && <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider">Trending</span>}
            </div>
          </div>
        </div>

        <p className="text-[17px] leading-[1.65] text-[var(--foreground)] font-normal mb-4">{post.content}</p>

        {post.image_urls?.length > 0 && (
          <div className="mb-4"><ImageCarousel urls={post.image_urls} maxHeight={480} /></div>
        )}

        <div className="flex items-center gap-4">
          <button onClick={() => handleVote('up')}
            className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-sm p-0 font-[inherit]"
            style={{ color: localVote === 'up' ? 'var(--accent)' : 'var(--muted)', fontWeight: localVote === 'up' ? 600 : 400 }}>
            ↑ {localUpvotes}
          </button>
          <button onClick={() => handleVote('down')}
            className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-sm p-0 font-[inherit]"
            style={{ color: localVote === 'down' ? '#C0392B' : 'var(--muted)' }}>
            ↓
          </button>
          <button onClick={() => setCommentsOpen(v => !v)}
            className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-[13px] text-[var(--muted)] p-0 font-[inherit]">
            💬 {post.comment_count} {commentsOpen ? '▾' : '▸'}
          </button>
        </div>

        {!post.is_own && (
          <div className="flex items-center gap-2 mt-2">
            {post.user_has_reported && <span className="text-xs text-[var(--muted)] font-medium">Reported</span>}
            <button
              onClick={() => { if (!post.user_has_reported) setShowReport(true); }}
              disabled={post.user_has_reported}
              className="border border-[var(--border)] rounded-md text-xs text-[var(--muted)] px-2.5 py-1 bg-transparent font-[inherit] cursor-pointer"
              style={{ opacity: post.user_has_reported ? 0.6 : 1, cursor: post.user_has_reported ? 'default' : 'pointer' }}
            >
              {post.user_has_reported ? 'Reported' : 'Report'}
            </button>
          </div>
        )}
        {showReport && <ReportModal postId={post.id} onClose={() => setShowReport(false)} />}
      </div>

      {commentsOpen && (
        <>
          <div className="flex gap-3 mb-8">
            <PeerlyAvatar name="You" size={32} />
            <div className="flex-1 flex flex-col gap-2">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add a comment…"
                className="w-full px-3 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] font-[inherit] outline-none resize-none min-h-[72px]"
              />
              {comment && (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setComment('')}>Cancel</Button>
                  <Button size="sm" onClick={handleComment} disabled={addComment.isPending}>
                    {addComment.isPending ? 'Posting…' : 'Post'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {commentsLoading && <CommentsSkeleton />}
          <div>
            {roots.map(c => (
              <CommentNode key={c.id} comment={c} tree={tree} depth={0} postId={postId} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: post, isLoading: postLoading } = usePost(id);

  if (postLoading) return <ContentShell><PostDetailSkeleton /></ContentShell>;
  if (!post) return <ContentShell><div className="text-sm text-red-500">Post not found.</div></ContentShell>;

  if (post?.is_hidden) {
    return (
      <ContentShell>
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center gap-3">
          <span className="text-[32px]">🚫</span>
          <p className="text-[15px] text-[var(--muted)] m-0">This post has been removed by an admin.</p>
        </div>
      </ContentShell>
    );
  }

  return <ContentShell><PostContent post={post} postId={id} /></ContentShell>;
}
