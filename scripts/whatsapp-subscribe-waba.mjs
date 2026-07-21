#!/usr/bin/env node

const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v23.0";
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
const shouldSubscribe = process.argv.includes("--subscribe");

const usage = `
Usage:
  WHATSAPP_ACCESS_TOKEN=... WHATSAPP_BUSINESS_ACCOUNT_ID=... npm run whatsapp:waba:check
  WHATSAPP_ACCESS_TOKEN=... WHATSAPP_BUSINESS_ACCOUNT_ID=... npm run whatsapp:waba:subscribe

Environment:
  WHATSAPP_ACCESS_TOKEN          Meta access token with whatsapp_business_management permission
  WHATSAPP_BUSINESS_ACCOUNT_ID   WhatsApp Business Account ID
  WHATSAPP_GRAPH_API_VERSION     Optional. Defaults to v23.0
`;

if (!accessToken || !wabaId) {
  console.error(usage.trim());
  process.exit(1);
}

const graphUrl = (path) => `https://graph.facebook.com/${graphVersion}/${path}`;

async function requestGraph(path, init = {}) {
  const response = await fetch(graphUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;

  const error = payload?.error || {};
  const message = error.message || `HTTP ${response.status}`;
  const code = error.code ? ` code=${error.code}` : "";
  const subcode = error.error_subcode ? ` subcode=${error.error_subcode}` : "";
  throw new Error(`${message}${code}${subcode}`);
}

async function main() {
  console.log(`Checking WABA subscription on ${graphVersion}/${wabaId}/subscribed_apps...`);
  const before = await requestGraph(`${wabaId}/subscribed_apps`);
  const beforeCount = Array.isArray(before.data) ? before.data.length : 0;
  console.log(`Current subscribed apps: ${beforeCount}`);

  if (!shouldSubscribe) return;

  console.log("Subscribing current Meta app to WABA webhook events...");
  const result = await requestGraph(`${wabaId}/subscribed_apps`, { method: "POST" });
  if (result?.success !== true) {
    console.log("Subscription response:");
    console.log(JSON.stringify(result, null, 2));
  }

  const after = await requestGraph(`${wabaId}/subscribed_apps`);
  const afterCount = Array.isArray(after.data) ? after.data.length : 0;
  console.log(`Subscribed apps after POST: ${afterCount}`);
}

main().catch((error) => {
  console.error(`WhatsApp WABA subscription failed: ${error.message}`);
  process.exit(1);
});
