import { useEffect, useState } from 'react';
import type { PlayerId } from '@pebble/engine';

interface RollScreenProps {
    yourSeat: PlayerId;
    onReady: () => void;
}

export function RollScreen({ yourSeat, onReady }: RollScreenProps) {
    const realColor = yourSeat === 1 ? 'Red' : 'Blue';
    const [displayedColor, setDisplayedColor] = useState<'Red' | 'Blue'>('Red');
    const [animationComplete, setAnimationComplete] = useState(false);

    useEffect(() => {
        const cycleDuration = 2000; // 2 seconds
        const switchInterval = 150; // 150ms per cycle

        const interval = setInterval(() => {
            setDisplayedColor(prev => prev === 'Red' ? 'Blue' : 'Red');
        }, switchInterval);

        const timeout = setTimeout(() => {
            clearInterval(interval);
            setDisplayedColor(realColor);
            setAnimationComplete(true);
        }, cycleDuration);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [realColor]);

    return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <h2>Room Joined</h2>
            <p>You are: <strong>{displayedColor}</strong></p>
            <button onClick={onReady} disabled={!animationComplete}>
                {animationComplete ? 'Start Game' : 'Revealing…'}
            </button>
        </div>
    );
}
