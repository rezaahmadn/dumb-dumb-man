export async function probeServerHealth(serverUrl: string): Promise<boolean> {
    try {
        const res = await fetch(`${serverUrl}/health`, { method: 'GET' });
        return res.ok && (await res.json()).ok === true;
    } catch {
        return false;
    }
}
