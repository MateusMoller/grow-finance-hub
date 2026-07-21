#!/usr/bin/env node

const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v23.0";
const appId = process.env.WHATSAPP_APP_ID?.trim();
const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
const callbackUrl = process.env.WHATSAPP_WEBHOOK_CALLBACK_URL?.trim();
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
const shouldSubscribe = process.argv.includes("--subscribe");

const usage = `
Usage:
  WHATSAPP_APP_ID=... WHATSAPP_APP_SECRET=... npm run whatsapp:webhook:check
  WHATSAPP_APP_ID=... WHATSAPP_APP_SECRET=... WHATSAPP_WEBHOOK_CALLBACK_URL=... WHATSAPP_VERIFY_TOKEN=... npm run whatsapp:webhook:subscribe

Environment:
  WHATSAPP_APP_ID                 Meta app ID
  WHATSAPP_APP_SECRET             Meta app secret
  WHATSAPP_WEBHOOK_CALLBACK_URL   Supabase webhook callback URL
  WHATSAPP_VERIFY_TOKEN           Webhook verify token configured in Supabase
  WHATSAPP_GRAPH_API_VERSION      Optional. Defaults to v23.0
`;

if (!appId || !appSecret || (shouldSubscribe && (!callbackUrl || !verifyToken))) {
  console.error(usage.trim());
  process.exit(1);
}

const appAccessToken = `${appId}|${appSecret}`;
const graphUrl = (path) => `https://graph.facebook.com/${graphVersion}/${path}`;

async function requestGraph(path, init = {}) {
  const response = await fetch(graphUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${appAccessToken}`,
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;

  const error = payload?.error || {};
  const message = error.message || `HTTP ${response.status}`;
  const code = error.code ? ` code=${error.code}` : "";
  throw new Error(`${message}${code}`);
}

async function main() {
  console.log(`Checking app webhook subscriptions on ${graphVersion}/${appId}/subscriptions...`);
  const before = await requestGraph(`${appId}/subscriptions`);
  console.log(JSON.stringify(before, null, 2));

  if (!shouldSubscribe) return;

  const params = new URLSearchParams({
    object: "whatsapp_business_account",
    callback_url: callbackUrl,
    verify_token: verifyToken,
    fields: "messages",
    include_values: "true",
  });

  console.log("Subscribing app webhook to whatsapp_business_account/messages...");
  await requestGraph(`${appId}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const after = await requestGraph(`${appId}/subscriptions`);
  console.log(JSON.stringify(after, null, 2));
}

main().catch((error) => {
  console.error(`WhatsApp app webhook subscription failed: ${error.message}`);
  process.exit(1);
});
