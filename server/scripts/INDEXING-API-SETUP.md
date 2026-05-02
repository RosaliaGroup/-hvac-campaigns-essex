# Google Indexing API Setup

Follow these steps to configure the Google Indexing API for mechanicalenterprise.com.

## 1. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project named `mechanicalenterprise-indexing`

## 2. Enable the Indexing API

1. In the project, go to **APIs & Services > Library**
2. Search for **"Web Search Indexing API"** (also called "Indexing API")
3. Click **Enable**

## 3. Create a Service Account

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > Service Account**
3. Name it `indexing-bot` (or anything descriptive)
4. Click **Done** (no extra permissions needed)
5. Click on the new service account, go to **Keys** tab
6. Click **Add Key > Create new key > JSON**
7. Save the downloaded file as:
   ```
   server/scripts/indexing-api-key.json
   ```
   This file is already in `.gitignore` — never commit it.

## 4. Add Service Account to Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select the `mechanicalenterprise.com` property
3. Go to **Settings > Users and permissions**
4. Click **Add user**
5. Enter the service account email (looks like `indexing-bot@mechanicalenterprise-indexing.iam.gserviceaccount.com`)
6. Set permission to **Owner**
7. Click **Add**

## 5. Run the Script

```bash
npm run submit-index
```

Or directly:

```bash
npx tsx server/scripts/submitToIndexingAPI.ts
```

## Notes

- Google's daily quota is **200 URL notifications per day**
- The script tracks submitted URLs in `logs/submitted-urls.json` and skips any submitted in the last 7 days
- Logs are written to `logs/indexing-api-YYYY-MM-DD.log`
- Run the script daily until all 286 URLs are submitted (takes ~2 days)
- After initial submission, re-run whenever you add new pages to the sitemap
