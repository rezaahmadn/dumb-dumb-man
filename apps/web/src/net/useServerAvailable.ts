import { useEffect, useState } from 'react';
import { probeServerHealth } from './healthProbe';

export function useServerAvailable(): 'probing' | 'up' | 'down' {
    const [status, setStatus] = useState<'probing' | 'up' | 'down'>('probing');
    const serverUrl = import.meta.env.VITE_SERVER_URL;

    useEffect(() => {
        if (!serverUrl) {
            setStatus('down');
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        (async () => {
            const signal = AbortSignal.any([
                controller.signal,
                AbortSignal.timeout(1500)
            ]);
            const result = await probeServerHealth(serverUrl, signal);
            if (!cancelled) {
                const outcome = result ? 'up' : 'down';
                setStatus(outcome);
                console.info(`[online] probed ${serverUrl}/health -> ${outcome}`);
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [serverUrl]);

    return status;
}
