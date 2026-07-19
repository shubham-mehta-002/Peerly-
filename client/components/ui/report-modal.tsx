'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useReportPost } from '@/lib/hooks/useReports';
import type { ApiError } from '@/lib/types';

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
] as const;

type Reason = typeof REASONS[number]['value'];

interface ReportModalProps {
  postId: string;
  onClose: () => void;
}

export function ReportModal({ postId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState('');
  const report = useReportPost();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) { setError('Select a reason'); return; }
    if (reason === 'other' && !customText.trim()) { setError('Please describe the issue'); return; }
    setError('');
    try {
      await report.mutateAsync({
        postId,
        reason,
        customText: reason === 'other' ? customText.trim() : undefined,
      });
      toast.success('Report submitted — thanks for keeping Peerly safe');
      onClose();
    } catch (err: unknown) {
      const msg = (err as ApiError)?.response?.data?.error;
      setError(msg ?? 'Failed to submit report');
      toast.error(msg ?? 'Failed to submit report');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-6 max-w-[380px] w-full"
      >
        <h3 className="text-[16px] font-semibold text-[var(--foreground)] mb-4">Report post</h3>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2.5 mb-4">
            {REASONS.map(r => (
              <label key={r.value} className="flex items-center gap-2.5 cursor-pointer text-sm text-[var(--foreground)]">
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="cursor-pointer"
                />
                {r.label}
              </label>
            ))}
          </div>

          {reason === 'other' && (
            <textarea
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder="Describe the issue…"
              maxLength={500}
              className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] font-[inherit] resize-vertical min-h-[80px] outline-none mb-3"
            />
          )}

          {error && <div className="text-[13px] text-red-500 mb-2.5">{error}</div>}

          <div className="flex gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--muted)] text-[13px] cursor-pointer font-[inherit]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={report.isPending}
              className="px-4 py-2 rounded-lg border-none bg-[var(--accent)] text-white text-[13px] font-semibold cursor-pointer font-[inherit]"
              style={{ opacity: report.isPending ? 0.6 : 1 }}
            >
              {report.isPending ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
