import { supabase } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { CreatePostBody, FeedQuery, UserPostsQuery, PostResponse } from './posts.types';
import { POST_SELECT, buildPostResponse, computeHeatScore, fetchPostInteractions, getFeedType } from './posts.util';

export async function createPost(
  userId: string,
  campusId: string,
  body: CreatePostBody
): Promise<Omit<PostResponse, 'display_author' | 'user_vote' | 'is_hidden' | 'user_has_reported' | 'is_own'>> {
  const { data: campus } = await supabase
    .from('campuses')
    .select('college_id')
    .eq('id', campusId)
    .single();

  if (!campus) throw new AppError(400, 'Invalid campus');

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_id: userId,
      campus_id: campusId,
      college_id: campus.college_id,
      content: body.content,
      image_urls: body.image_urls,
      is_global: body.is_global,
      is_anonymous: body.is_anonymous,
    })
    .select('id, content, image_urls, is_global, is_anonymous, upvotes, comment_count, heat_score, created_at, campus_id')
    .single();

  if (error || !post) {
    logger.error('Failed to create post', { error: error?.message, userId });
    throw new AppError(500, 'Failed to create post');
  }

  logger.info('Post created', { postId: post.id, userId, campusId });
  return post;
}

export async function getFeed(
  options: FeedQuery & { feedType: 'campus' | 'global'; campusId: string; viewerUserId: string }
): Promise<PostResponse[]> {
  const { feedType, campusId, sort, page, limit, viewerUserId } = options;
  const offset = (page - 1) * limit;

  let query = supabase.from('posts').select(POST_SELECT);

  if (feedType === 'campus') {
    query = query.eq('campus_id', campusId) as any;
  } else {
    query = query.eq('is_global', true) as any;
  }
  query = query.eq('is_hidden', false) as any;

  switch (sort) {
    case 'oldest':   query = query.order('created_at', { ascending: true }) as any; break;
    case 'upvoted':  query = query.order('upvotes', { ascending: false }) as any; break;
    case 'trending': query = query.order('heat_score', { ascending: false }) as any; break;
    default:         query = query.order('created_at', { ascending: false }) as any; break;
  }

  const { data: posts, error } = await (query as any).range(offset, offset + limit - 1);

  if (error) {
    logger.error('Failed to fetch feed', { error: error.message, feedType });
    throw new AppError(500, 'Failed to fetch feed');
  }
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p: any) => p.id);
  const { voteMap, reportedSet } = await fetchPostInteractions(postIds, viewerUserId);

  return posts.map((p: any) =>
    buildPostResponse(p, feedType, viewerUserId, voteMap.get(p.id) ?? null, reportedSet.has(p.id))
  );
}

export async function getPost(postId: string, viewerUserId: string): Promise<PostResponse> {
  const { data: post, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .single();

  if (error || !post) throw new AppError(404, 'Post not found');

  const { data: voteRow } = await supabase
    .from('post_votes')
    .select('vote_type')
    .eq('post_id', postId)
    .eq('user_id', viewerUserId)
    .single();

  const { data: reportRow } = await supabase
    .from('post_reports')
    .select('post_id')
    .eq('post_id', postId)
    .eq('reporter_id', viewerUserId)
    .single();

  const feedType = getFeedType(post.is_global);
  return buildPostResponse(post, feedType, viewerUserId, voteRow?.vote_type as 'up' | 'down' | null ?? null, !!reportRow);
}

export async function deletePost(postId: string, userId: string, isAdmin: boolean): Promise<void> {
  const { data: post } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .single();

  if (!post) throw new AppError(404, 'Post not found');
  if (post.author_id !== userId && !isAdmin) throw new AppError(403, 'Not authorized');

  await supabase.from('posts').delete().eq('id', postId);
  logger.info('Post deleted', { postId, userId });
}

export async function getUserPosts(
  username: string,
  viewerUserId: string,
  options: UserPostsQuery
): Promise<PostResponse[]> {
  const { anonymous, page, limit } = options;
  const offset = (page - 1) * limit;

  const { data: author, error: authorErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single();

  if (authorErr || !author) throw new AppError(404, 'User not found');

  if (anonymous && author.id !== viewerUserId) throw new AppError(403, 'Forbidden');

  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('author_id', author.id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });

  query = (query as any).eq('is_anonymous', anonymous);

  const { data: posts, error } = await (query as any).range(offset, offset + limit - 1);

  if (error) {
    logger.error('Failed to fetch user posts', { error: error.message, username });
    throw new AppError(500, 'Failed to fetch user posts');
  }
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p: any) => p.id);
  const { voteMap, reportedSet } = await fetchPostInteractions(postIds, viewerUserId);

  return posts.map((p: any) => {
    const feedType = getFeedType(p.is_global);
    return buildPostResponse(p, feedType, viewerUserId, voteMap.get(p.id) ?? null, reportedSet.has(p.id));
  });
}


// NULL -> means remove the existing type of vote
export async function castVote(
  postId: string,
  userId: string,
  voteType: 'up' | 'down' | null
): Promise<void> {
  const { data: post } = await supabase
    .from('posts')
    .select('id, upvotes, downvotes, comment_count, created_at')
    .eq('id', postId)
    .single();

  if (!post) throw new AppError(404, 'Post not found');

  const { data: existing } = await supabase
    .from('post_votes')
    .select('vote_type')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single();

  let { upvotes, downvotes } = post;

  if (voteType === null) {
    if (!existing) return;
    if (existing.vote_type === 'up') upvotes = Math.max(0, upvotes - 1);
    else downvotes = Math.max(0, downvotes - 1);
    await supabase.from('post_votes').delete().eq('post_id', postId).eq('user_id', userId);
  } else if (!existing) {
    if (voteType === 'up') upvotes++;
    else downvotes++;
    await supabase.from('post_votes').insert({ post_id: postId, user_id: userId, vote_type: voteType });
  } else if (existing.vote_type === voteType) {
    return;
  } else {
    if (voteType === 'up') { upvotes++; downvotes = Math.max(0, downvotes - 1); }
    else { downvotes++; upvotes = Math.max(0, upvotes - 1); }
    await supabase.from('post_votes').update({ vote_type: voteType }).eq('post_id', postId).eq('user_id', userId);
  }

  const heat_score = computeHeatScore(upvotes, downvotes, post.comment_count, post.created_at);
  await supabase.from('posts').update({ upvotes, downvotes, heat_score }).eq('id', postId);
}
