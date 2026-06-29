'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { CardLayout, AnonStyle, AccentColor } from '@/lib/types';

interface TweaksContextValue {
    cardLayout: CardLayout;
    anonStyle: AnonStyle;
    accentColor: AccentColor;
    setCardLayout: (v: CardLayout) => void;
    setAnonStyle: (v: AnonStyle) => void;
    setAccentColor: (v: AccentColor) => void;
}

const TweaksContext = createContext<TweaksContextValue>({
    cardLayout: 'open',
    anonStyle: 'badge',
    accentColor: 'sage',
    setCardLayout: () => { },
    setAnonStyle: () => { },
    setAccentColor: () => { },
});

export function TweaksProvider({ children }: { children: React.ReactNode }) {
    const [cardLayout, setCardLayoutState] = useState<CardLayout>('open');
    const [anonStyle, setAnonStyleState] = useState<AnonStyle>('badge');
    const [accentColor, setAccentColorState] = useState<AccentColor>('sage');

    useEffect(() => {
        const storedLayout = localStorage.getItem('peerly_card_layout') as CardLayout | null;
        if (storedLayout) setCardLayoutState(storedLayout);

        const storedAnonStyle = localStorage.getItem('peerly_anon_style') as AnonStyle | null;
        if (storedAnonStyle) setAnonStyleState(storedAnonStyle);

        const storedAccent = localStorage.getItem('peerly_accent_color') as AccentColor | null;
        if (storedAccent) {
            setAccentColorState(storedAccent);
            if (storedAccent === 'sage') {
                document.documentElement.removeAttribute('data-accent');
            } else {
                document.documentElement.setAttribute('data-accent', storedAccent);
            }
        }
    }, []);

    const setCardLayout = (v: CardLayout) => {
        setCardLayoutState(v);
        localStorage.setItem('peerly_card_layout', v);
    };

    const setAnonStyle = (v: AnonStyle) => {
        setAnonStyleState(v);
        localStorage.setItem('peerly_anon_style', v);
    };

    const setAccentColor = (v: AccentColor) => {
        setAccentColorState(v);
        localStorage.setItem('peerly_accent_color', v);
        if (v === 'sage') {
            document.documentElement.removeAttribute('data-accent');
        } else {
            document.documentElement.setAttribute('data-accent', v);
        }
    };

    return (
        <TweaksContext.Provider value={{ cardLayout, anonStyle, accentColor, setCardLayout, setAnonStyle, setAccentColor }}>
            {children}
        </TweaksContext.Provider>
    );
}

export const useTweaks = () => useContext(TweaksContext);
