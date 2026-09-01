import Keycloak from "keycloak-js";

const issuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "http://localhost:8081";

export const keycloak = new Keycloak({
  url: issuer,
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "storemesh",
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "storemesh-web",
});

export async function startOIDCLogin() {
  await keycloak.init({ onLoad: "login-required", pkceMethod: "S256", checkLoginIframe: false });
}

export async function refreshOIDCToken() {
  if (!keycloak.authenticated) return false;
  await keycloak.updateToken(30);
  return Boolean(keycloak.token);
}

export function logoutOIDC() { return keycloak.logout({ redirectUri: window.location.origin }); }
