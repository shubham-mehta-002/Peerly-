'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContentShell } from '@/components/content-shell';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { useCommunities, useJoinCommunity, useLeaveCommunity, useCreateCommunity } from '@/lib/hooks/useCommunities';
import { CommunitiesListSkeleton } from '@/components/skeletons';

const CATS = ['All', 'Technical', 'Cultural', 'Sports'];
const CATEGORY_ICON: Record<string, string> = { Technical: '⌨', Cultural: '♪', Sports: '⚽' };

export default function CommunitiesPage() {
  const [search, setSearch] = useState('');
  const [scopeTab, setScopeTab] = useState<'college' | 'global' | 'all'>('all');
  const [newIsGlobal, setNewIsGlobal] = useState(false);
  const [activeCat, setActiveCat] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState<'Technical' | 'Cultural' | 'Sports'>('Technical');
  const [createError, setCreateError] = useState('');
  const router = useRouter();

  const { data: all = [], isLoading } = useCommunities(search || undefined);
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();
  const createCommunity = useCreateCommunity();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateError('');
    try {
      const c = await createCommunity.mutateAsync({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        category: newCat,
        is_global: newIsGlobal,
      });
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewCat('Technical'); setNewIsGlobal(false);
      router.push(`/communities/${c.id}`);
    } catch { setCreateError('Failed to create community'); }
  };

  const scopeFiltered =
    scopeTab === 'college' ? all.filter(c => !c.is_global) :
      scopeTab === 'global' ? all.filter(c => c.is_global) : all;
  const displayed = scopeFiltered.filter(c => activeCat === 'All' || c.category === activeCat);

  return (
    <ContentShell>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <h1 className="text-[22px] font-semibold text-[var(--foreground)] tracking-tight m-0">Communities</h1>
        <Button size="sm" onClick={() => setShowCreate(v => !v)}>+ New</Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <div className="text-[13px] font-semibold text-[var(--foreground)] mb-3">New Community</div>
          <div className="flex flex-col gap-2.5">
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Community name"
              className="px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] font-[inherit] outline-none" />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
              className="px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] font-[inherit] outline-none" />
            <div className="flex gap-2">
              {(['Technical', 'Cultural', 'Sports'] as const).map(cat => (
                <button key={cat} type="button" onClick={() => setNewCat(cat)}
                  className="px-3 py-1.5 rounded-full text-[13px] font-medium font-[inherit] cursor-pointer transition-all duration-150"
                  style={{
                    border: `1px solid ${newCat === cat ? 'var(--accent)' : 'var(--border)'}`,
                    background: newCat === cat ? 'var(--accent)' : 'transparent',
                    color: newCat === cat ? '#fff' : 'var(--muted)',
                  }}>
                  {cat}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-[13px] text-[var(--muted)]">
              <input type="checkbox" checked={newIsGlobal} onChange={e => setNewIsGlobal(e.target.checked)} className="cursor-pointer" />
              Make this a global community (visible to all campuses, max 500 members)
            </label>
            <ErrorMessage message={createError} />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowCreate(false); setCreateError(''); setNewIsGlobal(false); }}
                className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-transparent text-[var(--muted)] text-[13px] cursor-pointer font-[inherit]">
                Cancel
              </button>
              <button type="submit" disabled={createCommunity.isPending || !newName.trim()}
                className="px-4 py-1.5 rounded-lg border-none bg-[var(--accent)] text-white text-[13px] font-semibold cursor-pointer font-[inherit]"
                style={{ opacity: createCommunity.isPending ? 0.6 : 1 }}>
                {createCommunity.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Scope tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-5">
        {([['all', 'All'], ['college', 'My College'], ['global', 'Global']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setScopeTab(id)}
            className="py-2.5 mr-6 bg-transparent border-none cursor-pointer font-[inherit] text-sm transition-all -mb-px"
            style={{
              fontWeight: scopeTab === id ? 600 : 400,
              color: scopeTab === id ? 'var(--foreground)' : 'var(--muted)',
              borderBottom: scopeTab === id ? '2px solid var(--foreground)' : '2px solid transparent',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">⌕</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search communities…"
          className="w-full pl-8 pr-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] font-[inherit] outline-none" />
      </div>

      {/* Category filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATS.map(c => (
          <button key={c} onClick={() => setActiveCat(c)}
            className="px-3 py-1 rounded-full text-[13px] font-medium cursor-pointer font-[inherit] transition-all duration-150"
            style={{
              border: `1px solid ${activeCat === c ? 'var(--accent)' : 'var(--border)'}`,
              background: activeCat === c ? 'var(--accent)' : 'transparent',
              color: activeCat === c ? '#fff' : 'var(--muted)',
            }}>
            {c}
          </button>
        ))}
      </div>

      {isLoading && <CommunitiesListSkeleton />}

      {/* Community list */}
      <div className="flex flex-col gap-0">
        {displayed.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3.5 py-4"
            style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
            <div onClick={() => router.push(`/communities/${c.id}`)}
              className="flex items-center gap-3.5 flex-1 cursor-pointer min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-lg shrink-0">
                {CATEGORY_ICON[c.category] || '•'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-[var(--foreground)]">{c.name}</span>
                  <span className="text-[11px] text-[var(--muted)] bg-[var(--card)] border border-[var(--border)] rounded px-1.5 py-px font-medium">{c.category}</span>
                  {c.is_global && <span className="text-[11px] text-[var(--accent)] border border-[var(--accent)] rounded px-1.5 py-px font-medium">Global</span>}
                </div>
                <p className="m-0 text-[13px] text-[var(--muted)] truncate">{c.description}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] font-semibold text-[var(--foreground)]">{c.member_count}</div>
                <div className="text-[11px] text-[var(--muted)]">members</div>
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); c.user_role ? leave.mutate(c.id) : join.mutate(c.id); }}
              className="px-3 py-1.5 rounded-md shrink-0 text-xs font-medium cursor-pointer font-[inherit] transition-all duration-150"
              style={{
                border: `1px solid ${c.user_role ? 'var(--border)' : 'var(--accent)'}`,
                background: c.user_role ? 'transparent' : 'var(--accent)',
                color: c.user_role ? 'var(--muted)' : '#fff',
              }}>
              {c.user_role ? 'Leave' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </ContentShell>
  );
}
