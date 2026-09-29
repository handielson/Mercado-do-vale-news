#!/usr/bin/env node

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { Client } = require('ssh2');
const { config: loadEnv } = require('dotenv');

const root = path.resolve(__dirname, '..');
for (const name of ['.env.vps.local', '.env.local', '.env', '.env.production']) {
  loadEnv({ path: path.join(root, name), override: false, quiet: true });
}

const localPort = Number(process.env.MDV_SHOPEE_TUNNEL_PORT || 43123);
const remotePort = Number(process.env.MDV_VPS_API_PORT || 4000);
const privateKeyPath = String(process.env.VPS_SITE_PRIVATE_KEY || '').trim();
const ssh = new Client();
let server = null;

const connection = {
  host: process.env.VPS_SITE_HOST,
  port: Number(process.env.VPS_SITE_PORT || 22),
  username: process.env.VPS_SITE_USER,
  password: process.env.VPS_SITE_PASSWORD || undefined,
  privateKey: privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined,
  readyTimeout: 20000,
  keepaliveInterval: 15000,
};

if (!connection.host || !connection.username || (!connection.password && !connection.privateKey)) {
  throw new Error('Credenciais SSH da VPS nao configuradas.');
}
if (!Number.isInteger(localPort) || localPort < 1024 || localPort > 65535) throw new Error('Porta local do tunel invalida.');
if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) throw new Error('Porta remota da API invalida.');

function shutdown(exitCode = 0) {
  if (server) server.close();
  ssh.end();
  process.exitCode = exitCode;
}

ssh.on('ready', () => {
  server = net.createServer((socket) => {
    socket.setKeepAlive(true, 15000);
    socket.on('error', () => {
      // Browsers and fetch clients may close a keep-alive socket abruptly.
      // That must only end this forwarded connection, never the tunnel process.
      socket.destroy();
    });
    ssh.forwardOut('127.0.0.1', 0, '127.0.0.1', remotePort, (error, stream) => {
      if (error) {
        socket.destroy(error);
        return;
      }
      socket.pipe(stream).pipe(socket);
      stream.on('error', () => socket.destroy());
      stream.on('close', () => socket.destroy());
    });
  });
  server.on('error', (error) => {
    console.error(`ERRO_TUNEL: ${error.message}`);
    shutdown(1);
  });
  server.listen(localPort, '127.0.0.1', () => {
    console.log(`SHOPEE_TUNNEL_READY http://127.0.0.1:${localPort}`);
  });
});
ssh.on('error', (error) => {
  console.error(`ERRO_SSH: ${error.message}`);
  shutdown(1);
});
ssh.on('close', () => {
  if (server) server.close();
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
ssh.connect(connection);
