---
title: Google OAuth2 & API Keys
description: Step-by-step guide to creating a Google Cloud project, OAuth consent screen, and credentials for YouTube, Google Sheets, and Gemini in n8n.
sidebar:
  order: 2
---

All Google services used by this stack (YouTube, Google Sheets, Gemini) share **one Google Cloud project**. You create the project and OAuth consent screen once, then enable each API and add the matching credential in n8n.

---

## Which workflows use Google

| Google service | n8n credential type | Used by |
|---|---|---|
| YouTube Data API v3 | `YouTube OAuth2 API` | Youtube Video Upload |
| Google Sheets | `Google Sheets OAuth2 API` | Schedule Management (shift data) |
| Google Gemini | `Google Gemini(PaLM) Api` | Telegram Voice to Text |

---

## Step 1 — Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Click the project selector at the top → **New Project**.
3. Name it (e.g. `n8n-automation`) and click **Create**.
4. Make sure the new project is selected in the project selector before continuing.

---

## Step 2 — Configure the OAuth Consent Screen

This step is required before you can create OAuth credentials. Skip it and the Client ID creation will fail.

1. Go to **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (works for personal Google accounts; lets you add test users).
3. Fill in:
   - **App name:** `n8n automation` (any name)
   - **User support email:** your email
   - **Developer contact email:** your email
4. Click **Save and Continue** through the Scopes page (leave scopes empty — n8n requests them during the OAuth flow).
5. On the **Test users** page, click **Add users** and add the Google account you will use for YouTube and Sheets. Click **Save and Continue**.
6. Click **Back to Dashboard**.

> **Important:** While the app is in **Testing** mode, OAuth tokens expire after 7 days and the refresh will silently fail, causing workflows to stop working. To prevent this, either keep the connecting account added as a test user (and reconnect every 7 days), or click **Publish App** on the consent screen page to remove the limit. Publishing does not require Google review for personal use.

---

## Step 3 — Create the OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. Application type: **Web application**.
4. Name: `n8n`.
5. Under **Authorized redirect URIs**, click **Add URI** and enter:
   ```
   https://your-n8n-domain.com/rest/oauth2-credential/callback
   ```
   Replace `your-n8n-domain.com` with the value of `N8N_EDITOR_BASE_URL` from your `.env`.

   For local dev, also add:
   ```
   http://localhost:5678/rest/oauth2-credential/callback
   ```
6. Click **Create**.
7. Copy the **Client ID** and **Client Secret** from the dialog — you'll paste these into n8n in Steps 5 and 6.

> The redirect URI must match exactly. If your n8n is at `https://n8n.example.com`, the URI must be `https://n8n.example.com/rest/oauth2-credential/callback`. A mismatch causes `redirect_uri_mismatch` during the OAuth login.

---

## Step 4 — Enable APIs

Go to **APIs & Services** → **Library**, search for each API below, and click **Enable**.

| API | Required for |
|---|---|
| YouTube Data API v3 | Youtube Video Upload workflow |
| Google Sheets API | Schedule Management workflows |

---

## Step 5 — YouTube credential in n8n

1. In n8n → **Settings** → **Credentials** → **Add credential**.
2. Search for **YouTube OAuth2 API** and select it.
3. Paste the **Client ID** and **Client Secret** from Step 3.
4. Click **Connect my account** — a Google consent page opens in your browser.
5. Sign in with the Google account that owns the YouTube channel.
6. Grant the requested permissions.
7. You're redirected back to n8n and the credential shows as connected.
8. Name it `YouTube (JNN Channel)` and click **Save**.

**Assign it to the workflow:**  
Open the **Youtube Video Upload** workflow → click the YouTube node → under **Credential**, select `YouTube (JNN Channel)`.

---

## Step 6 — Google Sheets credential in n8n

The Schedule Management workflows read and write shift schedules in Google Sheets. Use the same Client ID and Client Secret from Step 3.

1. In n8n → **Settings** → **Credentials** → **Add credential**.
2. Search for **Google Sheets OAuth2 API** and select it.
3. Paste the **Client ID** and **Client Secret**.
4. Click **Connect my account** → sign in with the Google account that owns the Sheets.
5. Grant permissions.
6. Name it `Google Sheets` and click **Save**.

**Sheet access:** The connected account must have at least **Editor** access on the spreadsheets used by Schedule Management. If the sheets are owned by the same account, no extra sharing is needed.

---

## Step 7 — Google Gemini API key

The **Telegram Voice to Text** workflow uses Google Gemini for speech-to-text. Gemini uses an **API key**, not OAuth — no consent screen or Client ID needed.

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Click **Create API key** → select the Google Cloud project from Step 1.
3. Copy the key.
4. In n8n → **Settings** → **Credentials** → **Add credential** → search **Google Gemini(PaLM) Api**.
5. Paste the API key.
6. Name it `Google Gemini` and click **Save**.

**Assign it:** Open the **Telegram (Voice to Text)** workflow → click the Gemini node → select `Google Gemini`.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` | Redirect URI in Google Cloud Console doesn't match n8n's URL | Add the exact URL `{N8N_EDITOR_BASE_URL}/rest/oauth2-credential/callback` to Authorized redirect URIs |
| `Token has been expired or revoked` | App is in Testing mode and the 7-day token limit hit | Re-connect the credential, or publish the app to remove the limit |
| `Access blocked: app has not completed Google verification` | App is External + published but unverified | Keep the app in Testing mode with your account added as a test user |
| `The caller does not have permission` | API not enabled for the project | Enable the specific API (Sheets, YouTube Data) in APIs & Services → Library |
| `Daily Limit Exceeded` | YouTube Data API free quota hit | Check quotas under **APIs & Services** → **YouTube Data API v3** → **Quotas** |
| Sheets nodes can't find the spreadsheet | Wrong account connected, or sheet not shared | Confirm the connected Google account has Editor access to the sheet |
