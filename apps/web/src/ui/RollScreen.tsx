import { useEffect, useState } from 'react';
import type { PlayerId } from '@pebble/engine';
import { PLAYER_COLOR_CSS } from '../game/render/theme';

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

    const pillColor = displayedColor === 'Red' ? PLAYER_COLOR_CSS[1] : PLAYER_COLOR_CSS[2];

    return (
        <div id="menu-layer">
            <div id="menu-box">
                <h1 className="menu-title">Room Joined</h1>
                <div className="online-panel">
                    <p className="online-subtitle">You play as</p>
                    <div className="roll-color" style={{ background: pillColor }}>
                        {displayedColor}
                    </div>
                    <button className="menu-mode-button" onClick={onReady} disabled={!animationComplete}>
                        {animationComplete ? 'Start Game' : 'Revealing…'}
                    </button>
                </div>
            </div>
        </div>
    );
}
