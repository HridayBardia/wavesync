let socket: WebSocket | null = null;

export const socketService = {
  connect(
    url: string,
    onOpen: () => void,
    onMessage: (msg: any) => void,
    onClose: () => void
  ) {
    this.disconnect();
    socket = new WebSocket(url);
    socket.onopen = onOpen;
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (err) {
        console.error("Failed to parse websocket message:", err);
      }
    };
    socket.onclose = onClose;
    socket.onerror = (err) => {
      console.error("WebSocket transport error:", err);
    };
  },

  send(message: any) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn("Attempted to send WS message on non-open socket:", message);
    }
  },

  disconnect() {
    if (socket) {
      try {
        socket.close();
      } catch (e) {}
      socket = null;
    }
  },

  isOpen(): boolean {
    return socket !== null && socket.readyState === WebSocket.OPEN;
  }
};
