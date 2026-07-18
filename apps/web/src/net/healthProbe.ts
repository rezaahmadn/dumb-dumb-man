export async function probeServerHealth(serverUrl: string, signal?: AbortSignal): Promise<boolean> {
    try {
        const res = await fetch(`${serverUrl}/health`, { method: 'GET', signal });
        return res.ok && (await res.json()).ok === true;
    } catch {
        return false;
    }
}
