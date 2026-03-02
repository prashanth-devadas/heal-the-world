import { FastifyInstance } from "fastify";
import { addClient } from "../realtime/broadcaster";

export async function wsRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket) => {
    socket.socket.send(JSON.stringify({ type: "connected" }));
    const remove = addClient((data) => {
      try { socket.socket.send(data); } catch {}
    });
    socket.on("close", remove);
    socket.on("error", remove);
  });
}
