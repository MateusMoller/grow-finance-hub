# WhatsApp Webhook

Required runtime secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_GRAPH_API_VERSION` (optional, defaults to `v23.0`)

Provider credentials for the final Meta Cloud API dispatch must stay in backend functions only. Browser code calls internal Edge Functions and never receives provider tokens.

## WABA webhook subscription

The webhook URL can validate successfully and still receive no real phone messages if the Meta app is not subscribed to the WhatsApp Business Account.

First, configure the Meta app webhook subscription for `whatsapp_business_account/messages`:

```bash
WHATSAPP_APP_ID=... WHATSAPP_APP_SECRET=... npm run whatsapp:webhook:check
WHATSAPP_APP_ID=... WHATSAPP_APP_SECRET=... WHATSAPP_WEBHOOK_CALLBACK_URL=... WHATSAPP_VERIFY_TOKEN=... npm run whatsapp:webhook:subscribe
```

Then subscribe the app to the WABA. Use a valid long-lived Meta token with the `whatsapp_business_management` permission:

```bash
WHATSAPP_ACCESS_TOKEN=... WHATSAPP_BUSINESS_ACCOUNT_ID=... npm run whatsapp:waba:check
WHATSAPP_ACCESS_TOKEN=... WHATSAPP_BUSINESS_ACCOUNT_ID=... npm run whatsapp:waba:subscribe
```

`whatsapp:webhook:check` reads the Meta app webhook subscriptions. `whatsapp:webhook:subscribe` posts to `/{APP_ID}/subscriptions`.

`whatsapp:waba:check` reads the current WABA app subscriptions. `whatsapp:waba:subscribe` posts to `/{WABA_ID}/subscribed_apps` and reads the subscriptions again.
