import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { HEALTH_PATH } from '@pebble/protocol';
import type {
    ClientToServerEvents,
    HealthResponse,
    InterServerEvents,
    ServerToClientEvents,
    SocketData
} from '@pebble/protocol';
import { registerHandlers } from './handlers';

const PORT = Number(process.env.PORT ?? 3001);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8080').split(',').map(o => o.trim());

const httpServer = createServer((req, res) => {
    const origin = req.headers.origin;
    if (origin !== undefined && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    if (req.url === HEALTH_PATH) {
        const body: HealthResponse = { ok: true };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
        return;
    }
    res.writeHead(404);
    res.end();
});

export const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
    registerHandlers(io, socket);
});

httpServer.listen(PORT, () => {
    console.log(`[server] listening on :${PORT} — origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
