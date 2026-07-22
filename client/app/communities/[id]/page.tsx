'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { PeerlyAvatar } from '@/components/ui/peer-avatar';
import { Button } from '@/components/ui/button';
import {
  useCommunity, useJoinCommunity, useLeaveCommunity, useDeleteCommunity,
  useCommunityMembers, useKickMember, useUpdateMemberRole,
  isAdminRole, type MemberResponse,
} from '@/lib/hooks/useCommunities';
import { useMessages } from '@/lib/hooks/useMessages';
import { useMe } from '@/lib/hooks/useAuth';

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateSeparatorLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function msgDay(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function MembersPanel({ communityId, myUserId, myRole, onClose, onLeave }: {
  communityId: string; myUserId: string; myRole: string | null;
  onClose: () => void; onLeave: () => void;
}) {
  const { data: members, isLoading } = useCommunityMembers(communityId, true);
  const kickMember = useKickMember(communityId);
  const updateRole = useUpdateMemberRole(communityId);
  const amAdmin = isAdminRole(myRole as never);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex items-stretch justify-end">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-[360px] h-full bg-[var(--background)] border-l border-[var(--border)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <h2 className="text-[16px] font-semibold text-[var(--foreground)] m-0">Members</h2>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-[var(--muted)] text-xl p-0 leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading && <div className="px-6 py-6 text-center text-[var(--muted)] text-sm">Loading…</div>}
          {!isLoading && (members ?? []).map(member => (
            <MemberRow key={member.user_id} member={member}
              isMe={member.user_id === myUserId} amAdmin={amAdmin}
              onKick={() => kickMember.mutate(member.user_id)}
              onRoleChange={role => updateRole.mutate({ userId: member.user_id, role })}
              kicking={kickMember.isPending} updating={updateRole.isPending} />
          ))}
        </div>
        <div className="px-5 py-4 border-t border-[var(--border)] shrink-0">
          <button onClick={onLeave}
            className="w-full py-2.5 rounded-lg bg-red-500/8 border border-red-600/30 text-red-500 text-sm font-medium cursor-pointer font-[inherit]">
            Leave community
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, isMe, amAdmin, onKick, onRoleChange, kicking, updating }: {
  member: MemberResponse; isMe: boolean; amAdmin: boolean;
  onKick: () => void; onRoleChange: (role: 'admin' | 'member') => void;
  kicking: boolean; updating: boolean;
}) {
  const isAdmin = member.role === 'admin' || member.role === 'owner';
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <PeerlyAvatar name={member.username} src={member.avatar_url ?? undefined} size={36} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--foreground)] overflow-hidden text-ellipsis whitespace-nowrap">
          {member.name || member.username}{isMe && <span className="text-[var(--muted)] font-normal"> (you)</span>}
        </div>
        <div className="text-[11px] uppercase tracking-wider font-[inherit]"
          style={{ color: isAdmin ? 'var(--accent)' : 'var(--muted)', fontWeight: isAdmin ? 600 : 400 }}>
          {member.role}
        </div>
      </div>
      {amAdmin && !isMe && (
        <div className="flex gap-1.5 shrink-0">
          {!isAdmin ? (
            <>
              <button onClick={() => onRoleChange('admin')} disabled={updating}
                className="text-[11px] px-2 py-1 rounded border border-[var(--accent)] text-[var(--accent)] bg-transparent cursor-pointer font-[inherit]">
                + Admin
              </button>
              <button onClick={onKick} disabled={kicking}
                className="text-[11px] px-2 py-1 rounded border border-red-500/40 text-red-500 bg-transparent cursor-pointer font-[inherit]">
                Kick
              </button>
            </>
          ) : (
            <button onClick={() => onRoleChange('member')} disabled={updating}
              className="text-[11px] px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)] bg-transparent cursor-pointer font-[inherit]">
              Demote
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LeaveDialog({ isSoleAdmin, isLeavePending, isDeletePending, onConfirm, onCancel, onAssignAdmin, onDelete }: {
  isSoleAdmin: boolean; isLeavePending: boolean; isDeletePending: boolean;
  onConfirm: () => void; onCancel: () => void; onAssignAdmin: () => void; onDelete: () => void;
}) {
  return (
    <div onClick={onCancel} className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-6">
      <div onClick={e => e.stopPropagation()} className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-6 max-w-[340px] w-full">
        {isSoleAdmin ? (
          <>
            <h3 className="text-[16px] font-semibold text-[var(--foreground)] mb-2">You&apos;re the only admin</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-5">Assign another member as admin before leaving, or delete this community.</p>
            <div className="flex flex-col gap-2.5">
              <button onClick={onAssignAdmin}
                className="py-2.5 rounded-lg border border-[var(--accent)] bg-transparent text-[var(--accent)] text-sm font-medium cursor-pointer font-[inherit]">
                Assign an admin
              </button>
              <button onClick={onDelete} disabled={isDeletePending}
                className="py-2.5 rounded-lg border-none bg-red-600 text-white text-sm font-medium cursor-pointer font-[inherit]">
                {isDeletePending ? 'Deleting…' : 'Delete community'}
              </button>
              <button onClick={onCancel}
                className="py-2.5 rounded-lg border border-[var(--border)] bg-transparent text-[var(--muted)] text-sm cursor-pointer font-[inherit]">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-[16px] font-semibold text-[var(--foreground)] mb-2">Leave community?</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-5">You will lose access to this community&apos;s chat.</p>
            <div className="flex gap-2.5">
              <button onClick={onCancel}
                className="flex-1 py-2.5 rounded-lg border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm cursor-pointer font-[inherit]">
                Cancel
              </button>
              <button onClick={onConfirm} disabled={isLeavePending}
                className="flex-1 py-2.5 rounded-lg border-none bg-red-600 text-white text-sm font-medium cursor-pointer font-[inherit]">
                {isLeavePending ? 'Leaving…' : 'Leave'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isSoleAdmin, setIsSoleAdmin] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const { data: me } = useMe();
  const { data: community, refetch: refetchCommunity } = useCommunity(id);
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();
  const deleteCommunity = useDeleteCommunity();

  const isMember = community?.user_role !== null && community?.user_role !== undefined;
  const amAdmin = isAdminRole(community?.user_role ?? null);

  const { messages, isLoading, isLoadingMore, hasMore, loadMore, sendMessage, sendTyping, typingUser } =
    useMessages(isMember ? id : '');

  useEffect(() => {
    if (!isLoading && bottomRef.current && isAtBottomRef.current) {
      bottomRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoadingMore && scrollRef.current) {
      const newH = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop += newH - prevScrollHeightRef.current;
    }
  }, [isLoadingMore]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (el.scrollTop < 80 && hasMore && !isLoadingMore) {
      prevScrollHeightRef.current = el.scrollHeight;
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const send = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
    isAtBottomRef.current = true;
    setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'end' }), 50);
  };

  const handleLeave = () => {
    setIsSoleAdmin(false);
    leave.mutate(id, {
      onSuccess: () => { toast.success('Left community'); router.push('/communities'); },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '';
        if (msg.toLowerCase().includes('only admin')) setIsSoleAdmin(true);
        else toast.error(msg || 'Failed to leave community');
      },
    });
  };

  const myUserId = me?.id ?? '';
  const myUsername = me?.profile?.username;

  // Join gate
  if (community && !isMember) {
    return (
      <div className="h-screen flex flex-col bg-[var(--background)]">
        <div className="h-[52px] flex items-center gap-3 px-5 border-b border-[var(--border)] shrink-0">
          <button onClick={() => router.push('/communities')} className="bg-transparent border-none cursor-pointer text-[var(--muted)] text-lg p-0 leading-none">←</button>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--foreground)]">{community.name}</div>
            <div className="text-xs text-[var(--muted)]">{community.member_count} members</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="text-[40px] mb-4 leading-none">🔒</div>
          <h2 className="text-[18px] font-semibold text-[var(--foreground)] mb-2">Members only</h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-6 max-w-[260px]">
            Join <strong className="text-[var(--foreground)]">{community.name}</strong> to read and send messages.
          </p>
          <Button onClick={() => join.mutate(id, {
            onSuccess: () => { refetchCommunity(); toast.success('Joined community!'); },
            onError: () => toast.error('Failed to join community'),
          })} disabled={join.isPending}>
            {join.isPending ? 'Joining…' : 'Join community'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="h-[52px] flex items-center gap-3 px-5 border-b border-[var(--border)] bg-[var(--background)] shrink-0 relative">
        <button onClick={() => router.push('/communities')} className="bg-transparent border-none cursor-pointer text-[var(--muted)] text-lg p-0 leading-none flex">←</button>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[var(--foreground)]">{community?.name ?? '…'}</div>
          <div className="text-xs text-[var(--muted)]">{community ? `${community.member_count} members` : ''}</div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(v => !v)}
            className="bg-transparent border-none cursor-pointer text-[var(--muted)] text-lg px-2 py-1 leading-none rounded-md">⋯</button>
          {showMenu && (
            <>
              <div onClick={() => setShowMenu(false)} className="fixed inset-0 z-20" />
              <div className="absolute top-full right-0 z-30 mt-1 bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl min-w-[170px] overflow-hidden">
                {amAdmin && (
                  <button onClick={() => { setShowMenu(false); setShowMembers(true); }}
                    className="block w-full text-left px-4 py-3 bg-transparent border-none cursor-pointer text-sm text-[var(--foreground)] font-[inherit]">
                    Members
                  </button>
                )}
                <button onClick={() => { setShowMenu(false); setShowLeaveDialog(true); }}
                  className="block w-full text-left px-4 py-3 bg-transparent border-none cursor-pointer text-sm text-red-500 font-[inherit]">
                  Leave community
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-0.5">
        {isLoadingMore && <div className="text-center py-2 text-[var(--muted)] text-xs">Loading older messages…</div>}
        {isLoading && <div className="text-[var(--muted)] text-sm text-center m-auto">Loading…</div>}
        {!isLoading && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="text-[36px] mb-3.5 leading-none">💬</div>
            <h3 className="text-[16px] font-semibold text-[var(--foreground)] mb-2">No messages yet</h3>
            <p className="text-[13px] text-[var(--muted)] leading-relaxed max-w-[240px] m-0">
              Be the first to start the conversation in <strong className="text-[var(--foreground)]">{community?.name}</strong>.
            </p>
          </div>
        )}
        {messages.map((msg, i) => {
          const mine = myUsername ? msg.sender.username === myUsername : false;
          const showDateSep = i === 0 || msgDay(messages[i - 1].created_at) !== msgDay(msg.created_at);
          const showHeader = !mine && !msg.is_system && (i === 0 || messages[i - 1].sender.username !== msg.sender.username || showDateSep);
          const DateSep = showDateSep ? (
            <div className="flex items-center gap-2.5 my-4">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[11px] text-[var(--muted)] font-medium whitespace-nowrap px-2.5 py-px bg-[var(--card)] border border-[var(--border)] rounded-full">
                {dateSeparatorLabel(msg.created_at)}
              </span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
          ) : null;
          if (msg.is_system) return (
            <div key={msg.id}>
              {DateSep}
              <div className="flex items-center gap-2.5 my-2">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-xs text-[var(--muted)] italic whitespace-nowrap">{msg.content}</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
            </div>
          );
          return (
            <div key={msg.id}>
              {DateSep}
              <div className="flex items-end gap-2 mb-0.5" style={{ flexDirection: mine ? 'row-reverse' : 'row' }}>
                {!mine && showHeader && <PeerlyAvatar name={msg.sender.username} src={msg.sender.avatar_url ?? undefined} size={28} />}
                {!mine && !showHeader && <div className="w-7 shrink-0" />}
                <div className="max-w-[72%]">
                  {showHeader && <div className="text-[11px] font-semibold text-[var(--muted)] mb-0.5 pl-0.5">{msg.sender.username}</div>}
                  <div className="px-3 py-2 text-sm leading-relaxed"
                    style={{
                      borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: mine ? 'var(--accent)' : 'var(--card)',
                      border: mine ? 'none' : '1px solid var(--border)',
                      color: mine ? '#fff' : 'var(--foreground)',
                    }}>
                    {msg.content}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5" style={{ textAlign: mine ? 'right' : 'left', paddingLeft: mine ? 0 : 2 }}>
                    {formatMessageTime(msg.created_at)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {typingUser && <div className="text-xs text-[var(--muted)] italic pl-10 mt-1">{typingUser} is typing…</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--background)] flex gap-2.5 items-end shrink-0">
        <div className="flex-1">
          <textarea value={input}
            onChange={e => { setInput(e.target.value); sendTyping(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Message…" rows={1}
            className="w-full px-3.5 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-[22px] text-sm text-[var(--foreground)] font-[inherit] outline-none resize-none leading-relaxed" />
        </div>
        <button onClick={send}
          className="w-[38px] h-[38px] rounded-full border-none cursor-pointer flex items-center justify-center text-white text-base shrink-0 transition-colors duration-150"
          style={{ background: input.trim() ? 'var(--accent)' : 'var(--border)' }}>↑</button>
      </div>

      {showMembers && (
        <MembersPanel communityId={id} myUserId={myUserId} myRole={community?.user_role ?? null}
          onClose={() => setShowMembers(false)}
          onLeave={() => { setShowMembers(false); setShowLeaveDialog(true); }} />
      )}
      {showLeaveDialog && (
        <LeaveDialog isSoleAdmin={isSoleAdmin} isLeavePending={leave.isPending} isDeletePending={deleteCommunity.isPending}
          onConfirm={handleLeave}
          onCancel={() => { setShowLeaveDialog(false); setIsSoleAdmin(false); }}
          onAssignAdmin={() => { setShowLeaveDialog(false); setIsSoleAdmin(false); setShowMembers(true); }}
          onDelete={() => deleteCommunity.mutate(id, {
            onSuccess: () => { toast.success('Community deleted'); router.push('/communities'); },
            onError: () => toast.error('Failed to delete community'),
          })} />
      )}
    </div>
  );
}
