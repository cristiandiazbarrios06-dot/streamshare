import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import crypto from 'crypto';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map(); // room -> host websocket
const sockets = new Map(); // socket -> metadata

app.use(express.static('public'));
app.get('/health', (_, res) => res.json({ ok: true }));

function send(ws, obj) { if (ws?.readyState === 1) ws.send(JSON.stringify(obj)); }
function roomId() { return crypto.randomBytes(5).toString('base64url'); }

wss.on('connection', ws => {
  sockets.set(ws, {});
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const meta = sockets.get(ws) || {};
    if (m.type === 'host') {
      let id = roomId(); while (rooms.has(id)) id = roomId();
      rooms.set(id, ws); sockets.set(ws, { role: 'host', room: id });
      send(ws, { type: 'room', room: id });
      return;
    }
    if (m.type === 'join') {
      const host = rooms.get(m.room);
      if (!host) return send(ws, { type: 'error', message: 'Sala no encontrada o ya cerrada.' });
      const id = crypto.randomBytes(8).toString('hex');
      sockets.set(ws, { role: 'viewer', room: m.room, id });
      send(ws, { type: 'joined', id, room: m.room });
      send(host, { type: 'viewer-joined', id });
      return;
    }
    const room = meta.room;
    const host = rooms.get(room);
    if (m.type === 'offer' && meta.role === 'host') {
      for (const [sock, info] of sockets) if (info.role === 'viewer' && info.room === room && info.id === m.to) send(sock, { ...m, from: 'host' });
    } else if ((m.type === 'answer' || m.type === 'ice') && meta.role === 'viewer') {
      send(host, { ...m, from: meta.id });
    } else if (m.type === 'ice' && meta.role === 'host') {
      for (const [sock, info] of sockets) if (info.role === 'viewer' && info.room === room && info.id === m.to) send(sock, { ...m, from: 'host' });
    }
  });
  ws.on('close', () => {
    const meta = sockets.get(ws);
    if (meta?.role === 'host') {
      if (rooms.get(meta.room) === ws) rooms.delete(meta.room);
      for (const [sock, info] of sockets) if (info.role === 'viewer' && info.room === meta.room) send(sock, { type: 'ended' });
    } else if (meta?.role === 'viewer') {
      const host = rooms.get(meta.room); send(host, { type: 'viewer-left', id: meta.id });
    }
    sockets.delete(ws);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`StreamShare server listening on :${port}`));
