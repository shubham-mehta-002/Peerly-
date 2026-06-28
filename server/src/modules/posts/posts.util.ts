import { supabase } from '../../integrations/supabase';
import { DisplayAuthor, PostResponse } from './posts.types';

export const POST_SELECT = `
  id, author_id, content, image_urls, is_global, is_anonymous, is_hidden,
  upvotes, downvotes, comment_count, heat_score, created_at, campus_id,
  author:profiles!author_id(username, name, avatar_url),
  college:colleges!college_id(name)
`;

export function computeHeatScore(
  upvotes: number,
  downvotes: number,
  commentCount: number,
  createdAt: string
): number {
  const hoursSincePosted = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const raw = (upvotes * 2 + commentCount * 1.5 - downvotes) / Math.pow(hoursSincePosted + 2, 1.8);
  return Math.max(0, parseFloat(raw.toFixed(6)));
}

export function maskAuthor(
  authorId: string,
  isAnonymous: boolean,
  viewerUserId: string,
  feedType: 'campus' | 'global',
  collegeName: string,
  username: string,
  name: string | null,
  avatarUrl: string | null
): DisplayAuthor {
  if (!isAnonymous || authorId === viewerUserId) {
    return { username, name, avatar_url: avatarUrl };
  }

  return {
    username: feedType === 'global' ? `Anonymous @ ${collegeName}` : 'Anonymous Peer',
    name: null,
    avatar_url: null,
  };
}

export function getFeedType(isGlobal: boolean): 'global' | 'campus' {
  return isGlobal ? 'global' : 'campus';
}

export function buildPostResponse(
  post: any,
  feedType: 'campus' | 'global',
  viewerUserId: string,
  userVote: 'up' | 'down' | null,
  userHasReported: boolean
): PostResponse {
  const author = post.author as { username: string; name: string | null; avatar_url: string | null } | null;
  const collegeName = (post.college as { name: string } | null)?.name ?? 'Unknown';
  const display_author = maskAuthor(
    post.author_id,
    post.is_anonymous,
    viewerUserId,
    feedType,
    collegeName,
    author?.username ?? 'Unknown',
    author?.name ?? null,
    author?.avatar_url ?? null
  );

  const { author_id: _authorId, author: _author, college: _college, downvotes: _downvotes, ...rest } = post;

  return {
    ...rest,
    display_author,
    user_vote: userVote,
    user_has_reported: userHasReported,
    is_own: post.author_id === viewerUserId,
  };
}

export async function fetchPostInteractions(postIds: string[], viewerUserId: string) {
  const [{ data: votes }, { data: reportedRows }] = await Promise.all([
    supabase
      .from('post_votes')
      .select('post_id, vote_type')
      .eq('user_id', viewerUserId)
      .in('post_id', postIds),
    supabase
      .from('post_reports')
      .select('post_id')
      .eq('reporter_id', viewerUserId)
      .in('post_id', postIds),
  ]);

  const voteMap = new Map((votes ?? []).map((vote: any) => [vote.post_id, vote.vote_type as 'up' | 'down']));
  const reportedSet = new Set((reportedRows ?? []).map((row: any) => row.post_id as string));

  return { voteMap, reportedSet };
}
