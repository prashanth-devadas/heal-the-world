import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config";
import { campaignRoutes } from "./routes/campaigns";
import { featureRoutes } from "./routes/features";
import { wsRoutes } from "./routes/ws";
import { startProposalListener } from "./listeners/campaignProposalListener";

const app = Fastify({ logger: true });

app.register(cors, { origin: true });
app.register(websocket);
app.register(campaignRoutes, { prefix: "/api/v1" });
app.register(featureRoutes, { prefix: "/api/v1" });
app.register(wsRoutes, { prefix: "/api/v1" });

app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) { app.log.error(err); process.exit(1); }
  startProposalListener();
});

export default app;
