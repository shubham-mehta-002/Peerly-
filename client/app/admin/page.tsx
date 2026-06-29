'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import { ErrorMessage } from '@/components/ui/error-message';
import { useAdminColleges, useCreateCollege, useUpdateCollege } from '@/lib/hooks/useAdmin';
import { useMe } from '@/lib/hooks/useAuth';
import { useAdminReports, useHidePost, useUnhidePost, type PostReportSummary } from '@/lib/hooks/useReports';
import { formatRelativeTime } from '@/lib/time';

function CollegeRow({
  college, onToggle, onClick,
}: {
  college: { id: string; name: string; is_active: boolean; college_domains: [{ count: number }]; campuses: [{ count: number }] };
  onToggle: () => void;
  onClick: () => void;
}) {
  const domainCount = college.college_domains?.[0]?.count ?? 0;
  const campusCount = college.campuses?.[0]?.count ?? 0;
  return (
    <div className="flex items-center gap-3.5 py-4 border-t border-[var(--border)]">
      <div onClick={onClick} className="flex-1 min-w-0 cursor-pointer">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-[var(--foreground)]">{college.name}</span>
          <span className="text-[11px] font-medium px-1.5 py-px rounded border"
            style={{
              borderColor: college.is_active ? 'var(--accent)' : 'var(--border)',
              color: college.is_active ? 'var(--accent)' : 'var(--muted)',
            }}>
            {college.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="text-[13px] text-[var(--muted)]">
          {domainCount} domain{domainCount !== 1 ? 's' : ''} · {campusCount} campus{campusCount !== 1 ? 'es' : ''}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--muted)] text-xs font-medium cursor-pointer font-[inherit] shrink-0"
      >
        {college.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: colleges = [], isLoading } = useAdminColleges();
  const createCollege = useCreateCollege();
  const updateCollege = useUpdateCollege();

  const [adminTab, setAdminTab] = useState<'colleges' | 'reports'>('colleges');
  const [reportFilter, setReportFilter] = useState('');
  const [reportPage, setReportPage] = useState(1);
  const { data: reports = [], isLoading: reportsLoading } = useAdminReports(reportFilter || undefined, reportPage);
  const hidePost = useHidePost();
  const unhidePost = useUnhidePost();

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState('');

  if (meLoading) return null;
  if (!me?.is_admin) { router.replace('/feed'); return null; }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!newName.trim()) return;
    try {
      await createCollege.mutateAsync({ name: newName.trim() });
      setNewName('');
      setShowForm(false);
    } catch { setFormError('Failed to create college'); }
  }

  return (
    <ContentShell>
      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-6">
        {([['colleges', 'Colleges'], ['reports', 'Reports']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setAdminTab(id)}
            className="py-2.5 mr-6 bg-transparent border-none cursor-pointer font-[inherit] text-sm transition-all -mb-px"
            style={{
              fontWeight: adminTab === id ? 600 : 400,
              color: adminTab === id ? 'var(--foreground)' : 'var(--muted)',
              borderBottom: adminTab === id ? '2px solid var(--foreground)' : '2px solid transparent',
            }}>
            {label}
          </button>
        ))}
      </div>

      {adminTab === 'colleges' && (
        <>
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-xs font-semibold text-[var(--accent)] tracking-widest uppercase mb-1">Admin</div>
              <h1 className="text-[22px] font-semibold text-[var(--foreground)] tracking-tight m-0">Colleges</h1>
            </div>
            <button onClick={() => setShowForm(v => !v)}
              className="px-4 py-1.5 rounded-lg border-none bg-[var(--accent)] text-white text-[13px] font-semibold cursor-pointer font-[inherit]">
              + Add College
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="mb-6 p-4 bg-[var(--card)] rounded-xl border border-[var(--border)]">
              <div className="text-[13px] font-semibold text-[var(--foreground)] mb-3">New College</div>
              <div className="flex gap-2">
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="College name"
                  className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] font-[inherit] outline-none" />
                <button type="submit" disabled={createCollege.isPending || !newName.trim()}
                  className="px-4 py-2 rounded-lg border-none bg-[var(--accent)] text-white text-[13px] font-semibold cursor-pointer font-[inherit]"
                  style={{ opacity: createCollege.isPending ? 0.6 : 1 }}>
                  {createCollege.isPending ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setNewName(''); setFormError(''); }}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--muted)] text-[13px] cursor-pointer font-[inherit]">
                  Cancel
                </button>
              </div>
              <ErrorMessage message={formError} />
            </form>
          )}

          <div className="text-[13px] text-[var(--muted)] mb-1">
            {colleges.length} college{colleges.length !== 1 ? 's' : ''}
          </div>
          {isLoading && <div className="text-[var(--muted)] text-sm py-5">Loading…</div>}
          <div>
            {colleges.map(c => (
              <CollegeRow key={c.id} college={c}
                onClick={() => router.push(`/admin/colleges/${c.id}`)}
                onToggle={() => updateCollege.mutate({ id: c.id, is_active: !c.is_active })} />
            ))}
          </div>
        </>
      )}

      {adminTab === 'reports' && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-[18px] font-semibold text-[var(--foreground)] m-0">Reported Posts</h2>
            <select value={reportFilter} onChange={e => { setReportFilter(e.target.value); setReportPage(1); }}
              className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] text-[13px] font-[inherit] cursor-pointer outline-none">
              <option value="">All reasons</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="misinformation">Misinformation</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="other">Other</option>
            </select>
          </div>

          {reportsLoading && <div className="text-[var(--muted)] text-sm">Loading reports…</div>}
          {!reportsLoading && reports.length === 0 && (
            <div className="text-[var(--muted)] text-sm py-8 text-center">No reported posts.</div>
          )}

          <div className="flex flex-col gap-0">
            {reports.map((r: PostReportSummary, i: number) => (
              <div key={r.id} className="py-4" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div className="flex items-start gap-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-[var(--foreground)]">{r.author.name || r.author.username}</span>
                      <span className="text-xs text-[var(--muted)]">{formatRelativeTime(r.created_at)}</span>
                      {r.is_hidden && <span className="text-[11px] text-red-500 border border-red-500/40 rounded px-1.5 py-px font-medium">Hidden</span>}
                    </div>
                    <p className="text-sm text-[var(--foreground)] mb-2 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {r.content}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[var(--foreground)]">{r.report_count} report{r.report_count !== 1 ? 's' : ''}</span>
                      {Object.entries(r.reason_breakdown).map(([reason, count]) => (
                        <span key={reason} className="text-[11px] text-[var(--muted)] bg-[var(--card)] border border-[var(--border)] rounded px-1.5 py-px">{reason}: {count}</span>
                      ))}
                    </div>
                  </div>
                  {r.is_hidden ? (
                    <button onClick={() => unhidePost.mutate(r.id)} disabled={unhidePost.isPending}
                      className="shrink-0 px-3.5 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--muted)] text-xs font-medium cursor-pointer font-[inherit]"
                      style={{ opacity: unhidePost.isPending ? 0.6 : 1 }}>Unhide</button>
                  ) : (
                    <button onClick={() => hidePost.mutate(r.id)} disabled={hidePost.isPending}
                      className="shrink-0 px-3.5 py-1.5 rounded-md border border-red-500/40 bg-transparent text-red-500 text-xs font-medium cursor-pointer font-[inherit]"
                      style={{ opacity: hidePost.isPending ? 0.6 : 1 }}>Hide post</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {reports.length === 20 && (
            <div className="flex justify-center gap-3 mt-5">
              <button onClick={() => setReportPage(p => Math.max(1, p - 1))} disabled={reportPage === 1}
                className="px-3.5 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--muted)] text-[13px] font-[inherit]"
                style={{ cursor: reportPage === 1 ? 'default' : 'pointer' }}>← Prev</button>
              <span className="text-[13px] text-[var(--muted)] leading-[30px]">Page {reportPage}</span>
              <button onClick={() => setReportPage(p => p + 1)}
                className="px-3.5 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--muted)] text-[13px] cursor-pointer font-[inherit]">Next →</button>
            </div>
          )}
        </div>
      )}
    </ContentShell>
  );
}
