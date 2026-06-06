const ws = new WebSocket("wss://wavesync-backend-0j3v.onrender.com/ws");
ws.onopen = () => {
  console.log("Connected");
  ws.send(JSON.stringify({ type: "NTP_REQUEST", t0: Date.now() }));
};
ws.onmessage = (e) => {
  console.log("Message:", e.data);
  process.exit(0);
};
ws.onerror = (e) => {
  console.error("Error:", e);
};
