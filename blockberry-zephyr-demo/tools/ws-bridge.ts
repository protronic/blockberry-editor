const executableIndex = Bun.argv.indexOf('--firmware');
const executable =
  executableIndex >= 0 ? Bun.argv[executableIndex + 1] : '../build-native/zephyr/zephyr.exe';
const portIndex = Bun.argv.indexOf('--port');
const port = Number(portIndex >= 0 ? Bun.argv[portIndex + 1] : '8765');

if (!executable) {
  throw new Error('Usage: bun ws-bridge.ts --firmware <zephyr.exe> [--port 8765]');
}

const firmware = Bun.spawn([executable], {
  stdin: 'pipe',
  stdout: 'pipe',
  stderr: 'pipe',
});

const clients = new Set<ServerWebSocket<unknown>>();
const decoder = new TextDecoder();

function broadcast(data: Uint8Array): void {
  const text = decoder.decode(data, {stream: true});
  for (const client of clients) client.send(text);
  Bun.write(Bun.stdout, data);
}

async function forward(stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) return;
  const reader = stream.getReader();
  for (;;) {
    const {done, value} = await reader.read();
    if (done) return;
    if (value) broadcast(value);
  }
}

void forward(firmware.stdout);
void forward(firmware.stderr);

const server = Bun.serve({
  port,
  fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === '/repl' && server.upgrade(request)) return;
    if (url.pathname === '/health') {
      return Response.json({ok: true, firmwarePid: firmware.pid});
    }
    return new Response('BlockBerry REPL WebSocket: connect to /repl\n');
  },
  websocket: {
    open(socket) {
      clients.add(socket);
      socket.send('[bridge] connected to Zephyr native_sim\n');
    },
    message(_socket, message) {
      const command =
        typeof message === 'string' ? message : new TextDecoder().decode(message);
      firmware.stdin.write(command.endsWith('\n') ? command : `${command}\n`);
      firmware.stdin.flush();
    },
    close(socket) {
      clients.delete(socket);
    },
  },
});

console.log(`BlockBerry REPL bridge listening on ws://localhost:${server.port}/repl`);

const exitCode = await firmware.exited;
for (const client of clients) client.close(1011, 'Zephyr process exited');
server.stop();
process.exit(exitCode);
