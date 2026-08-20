import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { storefrontRouter } from "./routes/storefront";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { punchoutRouter } from "./routes/punchout";
import { accountRouter } from "./routes/account";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001").split(",");
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());

// Punchout setup accepts raw cXML (text/xml); everything else is JSON.
app.use(express.text({ type: ["text/xml", "application/xml"], limit: "2mb" }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/storefront", storefrontRouter);
app.use("/api/admin", adminRouter);
app.use("/api/punchout", punchoutRouter);
app.use("/api/account", accountRouter);

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
app.listen(port, () => {
  console.log(`Signet API listening on http://localhost:${port}`);
});

