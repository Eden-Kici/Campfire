/* ============================================================
   CAMPFIRE RELAY
   ============================================================

   Forty lines that know nothing about D&D.

   The relay's only job is delivery: a socket says which room it is in, and
   everything it sends is copied to the other sockets in that room. It never
   parses a message, never holds character state, never decides who may see
   what. All of that lives in the app, where it can be unit tested and where
   it belongs -- a table's rules are the app's business, and a server that
   understood them would be a second place for them to drift.

   That also means the relay never needs to change as the app's party features
   grow. New message type? The relay already forwards it.

   Deployed on a single always-on instance on purpose. Rooms are held in
   memory, so two players must reach the same process; a serverless host that
   scales to many isolates would happily put two phones in the same room on
   two different machines and neither would ever hear the other. */

const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8787;

// a room is small on purpose -- this is a table of players, and the cap is
// what stops a stray reconnect loop from filling memory
const MAX_PER_ROOM = 8;

// generous for a roster entry, far below an accidentally-attached avatar,
// which is the realistic way a client floods this
const MAX_MESSAGE_BYTES = 64 * 1024;

const rooms = new Map();

const server = http.createServer((req, res) => {
  // Render pings this to decide the service is alive, and it is also the
  // "is the relay awake" check before a demo
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("campfire relay ok\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket, req) => {
  const room = roomFrom(req.url);
  if (!room) { socket.close(1008, "bad room"); return; }

  const peers = rooms.get(room) || new Set();
  if (peers.size >= MAX_PER_ROOM) { socket.close(1013, "room full"); return; }
  peers.add(socket);
  rooms.set(room, peers);

  socket.on("message", (data, isBinary) => {
    if (isBinary || data.length > MAX_MESSAGE_BYTES) return;
    peers.forEach(peer => {
      if (peer !== socket && peer.readyState === peer.OPEN) peer.send(data, { binary: false });
    });
  });

  const drop = () => {
    peers.delete(socket);
    if (peers.size === 0) rooms.delete(room);
  };
  socket.on("close", drop);
  socket.on("error", drop);
});

/* Room codes are the only thing the relay validates, because an unvalidated
   one is an unbounded key into a Map that never empties. */
function roomFrom(url) {
  let room;
  try { room = new URL(url, "http://x").searchParams.get("room"); }
  catch (err) { return null; }
  if (!room) return null;
  room = room.toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(room) ? room : null;
}

server.listen(PORT, () => console.log("campfire relay listening on " + PORT));
