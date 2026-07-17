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

const PORT = Number(process.env.PORT ?? 3001);

//  The web client is served from a different origin than this process --
//  Netlify is static-only and cannot host a socket server, so cross-origin is
//  the normal case here, not an edge case. 8080 is the vite dev server
//  (apps/web/vite/config.dev.mjs:10). Production origins arrive via env.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8080').split(',');

const httpServer = createServer((req, res) => {
    //  The health probe is a cross-origin fetch, so it needs its own CORS
    //  header: socket.io's cors option covers the socket handshake only and
    //  does nothing for this plain HTTP route.
    const origin = req.headers.origin;
    if (origin !== undefined && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
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

//  Exported so Phase 2's handlers can register against it. No connection
//  logic here yet: this phase proves the process boots and the authority
//  boundary holds, nothing more.
export const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

httpServer.listen(PORT, () => {
    console.log(`[server] listening on :${PORT} — origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
