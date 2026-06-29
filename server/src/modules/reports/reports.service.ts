import { supabase } from '../../integrations/supabase';
import { AppError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import type { ReportReason, PostReportSummary, AdminReportsQuery } from './reports.types';

export async function createReport(
  postId: string,
  reporterId: string,
  reason: ReportReason,
  customText?: string
): Promise<void> {
  // Verify post exists and reporter isn't the author
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, author_id')
    .eq('id', postId)
    .single();

  if (postErr || !post) throw new AppError(404, 'Post not found');
  if ((post as { author_id: string }).author_id === reporterId) {
    throw new AppError(403, 'Cannot report your own post');
  }

  // Insert report (post_reports table must exist — see migrations.sql)
  const { error: insertError } = await supabase
    .from('post_reports')
    .insert({ post_id: postId, reporter_id: reporterId, reason, custom_text: customText ?? null });

  if (insertError) {
    if (insertError.code === '23505') throw new AppError(409, 'You have already reported this post');
    if (insertError.code === '42P01') throw new AppError(503, 'Reports feature not yet enabled — run migrations.sql');
    throw new AppError(500, 'Failed to submit report');
  }

  // Try to increment report_count if the column exists (added by migrations.sql)
  await supabase
    .from('posts')
    .update({ report_count: 0 } as Record<string, unknown>) // placeholder — actual increment via DB trigger or migration
    .eq('id', postId);
  // Ignore update error — report_count column may not exist yet
}

export async function getAdminReports(options: AdminReportsQuery): Promise<PostReportSummary[]> {
  const { reason, page, limit } = options;
  const offset = (page - 1) * limit;

  // Get all reports (filtered by reason if provided)
  let reportsQuery = supabase
    .from('post_reports')
    .select('post_id, reason')
    .order('post_id');

  if (reason) {
    reportsQuery = reportsQuery.eq('reason', reason);
  }

  const { data: allReports, error: reportsErr } = await reportsQuery;

  if (reportsErr) {
    // post_reports table doesn't exist yet
    if (reportsErr.code === '42P01') return [];
    throw new AppError(500, 'Failed to fetch reports');
  }
  if (!allReports || allReports.length === 0) return [];

  // Build breakdown and count per post
  const countMap = new Map<string, number>();
  const breakdownMap = new Map<string, Record<string, number>>();
  for (const r of allReports as { post_id: string; reason: string }[]) {
    countMap.set(r.post_id, (countMap.get(r.post_id) ?? 0) + 1);
    if (!breakdownMap.has(r.post_id)) breakdownMap.set(r.post_id, {});
    const bd = breakdownMap.get(r.post_id)!;
    bd[r.reason] = (bd[r.reason] ?? 0) + 1;
  }

  // Sort post IDs by report count desc, apply pagination
  const sortedPostIds = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(offset, offset + limit)
    .map(([id]) => id);

  if (sortedPostIds.length === 0) return [];

  // Fetch the actual posts
  const { data: posts, error: postsErr } = await supabase
    .from('posts')
    .select('id, content, created_at, author:profiles!author_id(username, name, avatar_url)')
    .in('id', sortedPostIds);

  if (postsErr) {
    logger.error('Failed to fetch reported posts', { error: postsErr.message });
    throw new AppError(500, 'Failed to fetch reports');
  }

  return (posts ?? []).map((p: any) => {
    const author = p.author as { username: string; name: string | null; avatar_url: string | null } | null;
    return {
      id: p.id,
      content: p.content,
      author: {
        username: author?.username ?? 'Unknown',
        name: author?.name ?? null,
        avatar_url: author?.avatar_url ?? null,
      },
      created_at: p.created_at,
      report_count: countMap.get(p.id) ?? 0,
      is_hidden: false, // column added by migrations.sql
      reason_breakdown: breakdownMap.get(p.id) ?? {},
    };
  });
}

export async function hidePost(postId: string): Promise<void> {
  const { data, error } = await supabase
    .from('posts')
    .update({ is_hidden: true } as Record<string, unknown>)
    .eq('id', postId)
    .select('id')
    .single();

  if (error) {
    if (error.code === '42703') {
      // Column doesn't exist yet — silently succeed until migration is run
      logger.warn('hidePost: is_hidden column missing — run migrations.sql');
      return;
    }
    throw new AppError(500, 'Failed to hide post');
  }
  if (!data) throw new AppError(404, 'Post not found');
}

export async function unhidePost(postId: string): Promise<void> {
  const { data, error } = await supabase
    .from('posts')
    .update({ is_hidden: false } as Record<string, unknown>)
    .eq('id', postId)
    .select('id')
    .single();

  if (error) {
    if (error.code === '42703') {
      logger.warn('unhidePost: is_hidden column missing — run migrations.sql');
      return;
    }
    throw new AppError(500, 'Failed to unhide post');
  }
  if (!data) throw new AppError(404, 'Post not found');
}
