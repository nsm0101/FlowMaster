/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EPIC_SANDBOX_FHIR_BASE_URL = "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";
const EPIC_SANDBOX_AUTH_ENDPOINT = "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize";
const EPIC_SANDBOX_TOKEN_ENDPOINT = "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token";
const DEFAULT_SMART_SCOPES = [
  "openid",
  "fhirUser",
  "launch",
  "patient/Patient.read",
  "patient/Encounter.read",
];
const OPTIONAL_WRITE_SCOPE = "patient/Communication.write";
const pendingSmartStates = new Map<string, number>();
const STATE_TTL_MS = 10 * 60 * 1000;

type FhirIntegrationMode = "demo" | "production";

const getFhirMode = (): FhirIntegrationMode =>
  process.env.FHIR_INTEGRATION_MODE === "production" ? "production" : "demo";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for SMART on FHIR ${getFhirMode()} mode.`);
  }
  return value;
};

const auditSmartEvent = (event: string, details: Record<string, unknown> = {}) => {
  console.log(JSON.stringify({
    type: "SMART_FHIR_AUDIT",
    event,
    mode: getFhirMode(),
    at: new Date().toISOString(),
    ...details,
  }));
};

const getSmartConfig = () => {
  const mode = getFhirMode();
  const clientId = requireEnv("EPIC_CLIENT_ID");
  const appUrl = requireEnv("APP_URL").replace(/\/$/, "");
  const fhirBaseUrl = mode === "production"
    ? requireEnv("EPIC_FHIR_BASE_URL")
    : process.env.EPIC_FHIR_BASE_URL || EPIC_SANDBOX_FHIR_BASE_URL;
  const authEndpoint = mode === "production"
    ? requireEnv("EPIC_AUTH_ENDPOINT")
    : process.env.EPIC_AUTH_ENDPOINT || EPIC_SANDBOX_AUTH_ENDPOINT;
  const tokenEndpoint = mode === "production"
    ? requireEnv("EPIC_TOKEN_ENDPOINT")
    : process.env.EPIC_TOKEN_ENDPOINT || EPIC_SANDBOX_TOKEN_ENDPOINT;
  const enableWriteBack = process.env.FHIR_WRITE_BACK_ENABLED === "true";
  const requestedScopes = (process.env.SMART_ALLOWED_SCOPES || DEFAULT_SMART_SCOPES.join(" "))
    .split(/\s+/)
    .filter(Boolean);
  const allowedScopes = enableWriteBack
    ? Array.from(new Set([...requestedScopes, OPTIONAL_WRITE_SCOPE]))
    : requestedScopes.filter((scope) => scope !== OPTIONAL_WRITE_SCOPE);

  if (mode === "production" && process.env.ALLOW_CLIENT_TOKEN_POSTMESSAGE === "true") {
    throw new Error("ALLOW_CLIENT_TOKEN_POSTMESSAGE must not be enabled in production mode.");
  }

  return { mode, clientId, appUrl, fhirBaseUrl, authEndpoint, tokenEndpoint, allowedScopes };
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json());

  // API Routes for SMART on FHIR
  
  // 1. Construct the SMART Launch URL
  app.get("/api/auth/epic-url", (req, res) => {
    try {
      const config = getSmartConfig();
      const redirectUri = `${config.appUrl}/auth/callback`;
      const state = crypto.randomBytes(24).toString("base64url");
      pendingSmartStates.set(state, Date.now() + STATE_TTL_MS);
      res.cookie("smart_state", state, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.mode === "production",
        maxAge: STATE_TTL_MS,
      });

      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: config.allowedScopes.join(" "),
        state,
        aud: config.fhirBaseUrl
      });

      auditSmartEvent("launch_url_created", { scopes: config.allowedScopes, aud: config.fhirBaseUrl });
      res.json({ url: `${config.authEndpoint}?${params.toString()}`, mode: config.mode, state });
    } catch (err: any) {
      auditSmartEvent("launch_url_failed", { error: err.message });
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Callback handler
  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code, state, error, error_description } = req.query;
    const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

    if (error) {
      auditSmartEvent("callback_error", { error });
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(error_description || error)} }, ${JSON.stringify(appUrl)});
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    try {
      const config = getSmartConfig();
      const stateValue = typeof state === "string" ? state : "";
      const expectedState = req.headers.cookie
        ?.split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("smart_state="))
        ?.split("=")[1];
      const expiresAt = pendingSmartStates.get(stateValue);

      if (!code || !stateValue || expectedState !== stateValue || !expiresAt || expiresAt < Date.now()) {
        auditSmartEvent("callback_state_rejected", { hasCode: Boolean(code), hasState: Boolean(stateValue) });
        return res.status(400).send("Invalid or expired SMART launch state.");
      }
      pendingSmartStates.delete(stateValue);
      res.clearCookie("smart_state");
      const clientSecret = process.env.EPIC_CLIENT_SECRET; // Public SMART clients may not have a secret.
      const redirectUri = `${config.appUrl}/auth/callback`;

      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri,
        client_id: config.clientId
      });
      
      if (clientSecret) {
        tokenParams.append("client_secret", clientSecret);
      }

      const tokenResponse = await fetch(config.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString()
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange token");
      }

      auditSmartEvent("token_exchange_succeeded", {
        patientContext: Boolean(tokenData.patient),
        scopes: tokenData.scope,
      });

      if (config.mode === "production") {
        // Production guardrail: do not hand bearer tokens to browser windows. Replace this
        // demo callback with a server-side encrypted session tied to enterprise auth.
        return res.status(501).send("SMART production callback requires server-side token/session storage before enabling.");
      }

      // Demo mode only: send short-lived sandbox token to the opener for local exploration.
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  data: ${JSON.stringify(tokenData)} 
                }, ${JSON.stringify(config.appUrl)});
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h2>Authentication successful!</h2>
              <p>This demo window should close automatically.</p>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      auditSmartEvent("token_exchange_failed", { error: err.message });
      console.error("SMART Auth Error:", err);
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(err.message)} }, ${JSON.stringify(appUrl)});
              window.close();
            </script>
          </body>
        </html>
      `);
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", fhirMode: getFhirMode() });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`FHIR integration mode: ${getFhirMode()}`);
    console.log(`Redirect URI: ${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/auth/callback`);
  });
}

startServer();
