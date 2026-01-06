import { createGoogleOAuthConfig } from "@deno/kv-oauth";

export const oauthConfig = createGoogleOAuthConfig({
  redirectUri: `${Deno.env.get("BASE_URL") || "http://localhost:8000"}/auth/google/callback`,
  scope: [
    "openid", 
    "email", 
    "profile",
    "https://www.googleapis.com/auth/devstorage.read_only"
  ],
});
