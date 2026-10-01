import { app } from "../server";

// Vercel's Node runtime expects a (req, res) request handler. An Express app is
// exactly that, so exporting it turns every /api/* route in server.ts into a
// serverless endpoint (Google Drive share, gdoc-title, Gemini, state).
export default app;
