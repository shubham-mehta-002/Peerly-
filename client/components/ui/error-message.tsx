import * as React from 'react';

interface ErrorMessageProps {
    message: string | null | undefined;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
    if (!message) return null;
    return (
        <div className="px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed bg-red-500/10 border border-red-600 text-red-500">
            {message}
        </div>
    );
}
