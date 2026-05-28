/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json());

  // API Routes for SMART on FHIR
  
  // 1. Construct the SMART Launch URL
  app.get("/api/auth/epic-url", (req, res) => {
    const clientId = process.env.EPIC_CLIENT_ID;
    const fhirBaseUrl = process.env.EPIC_FHIR_BASE_URL || "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const redirectUri = `${appUrl}/auth/callback`;

    if (!clientId) {
      return res.status(500).json({ error: "EPIC_CLIENT_ID is not configured in environment variables." });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid fhirUser launch patient/*.read patient/Communication.write encounter/read",
      state: Math.random().toString(36).substring(7),
      aud: fhirBaseUrl
    });

    const authEndpoint = "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize";
    const authUrl = `${authEndpoint}?${params.toString()}`;

    res.json({ url: authUrl });
  });

  // 2. Callback handler
  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error_description || error}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    try {
      // Exchange code for token
      const clientId = process.env.EPIC_CLIENT_ID!;
      const clientSecret = process.env.EPIC_CLIENT_SECRET; // Might be empty for public client
      const appUrl = process.env.APP_URL!;
      const redirectUri = `${appUrl}/auth/callback`;
      const tokenEndpoint = "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token";

      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri,
        client_id: clientId
      });
      
      if (clientSecret) {
        tokenParams.append("client_secret", clientSecret);
      }

      const tokenResponse = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString()
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange token");
      }

      // In a real HIPAA compliant app, you'd store this token in a secure session or DB associated with the user.
      // For this demo, we'll send it back to the client via postMessage (short-lived).
      // SECURITY NOTE: In production, tokens should NOT be sent via postMessage if they are long-lived.
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  data: ${JSON.stringify(tokenData)} 
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h2>Authentication successful!</h2>
              <p>This window should close automatically.</p>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("SMART Auth Error:", err);
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${err.message}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
    console.log(`Redirect URI: ${process.env.APP_URL}/auth/callback`);
  });
}

startServer();
