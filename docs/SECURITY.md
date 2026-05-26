# PadelUP Security Notes

## VAPID keys

Generate one VAPID pair before enabling push notifications:

```bash
npx web-push generate-vapid-keys
```

Store the private key only in Supabase secrets:

```bash
supabase secrets set VAPID_PRIVATE_KEY=<private-key>
supabase secrets set VAPID_PUBLIC_KEY=<public-key>
supabase secrets set VAPID_SUBJECT=mailto:contato@padelup.app
```

Expose only the public key to the web client:

```bash
VITE_VAPID_PUBLIC_KEY=<public-key>
```

Never commit `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `.env.local`, or Vercel/Supabase temporary files.

## Edge Function database settings

After deploying the Edge Functions, configure the hosted database settings manually:

```sql
alter database postgres set app.edge_function_url = 'https://<project-ref>.supabase.co/functions/v1';
alter database postgres set app.edge_function_key = '<service-role-key>';
```

These values are environment-specific and must not be committed.
