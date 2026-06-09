const ws = new WebSocket("wss://wavesync-backend-0j3v.onrender.com/ws");
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "JOIN_ROOM", roomCode: "TEST", displayName: "Tester" }));
  ws.send(JSON.stringify({ type: "NTP_REQUEST", t0: Date.now() }));
};
ws.onmessage = (e) => {
  console.log("Received:", e.data);
};
setTimeout(() => process.exit(0), 1000);
