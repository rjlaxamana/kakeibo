# 家計簿+ (kakeibo+)

A mobile-first personal finance web app for tracking expenses and income in JPY and PHP, synced to a Notion database via a Cloudflare Worker proxy. Built for a Filipino master's student based in Japan managing dual-currency finances. Installable as a PWA, hosted on GitHub Pages.

## Features
- **Transaction Logging**: Log expenses or income with an amount, currency (JPY/PHP), category/source pill, optional note, and timestamp.
- **Recent Transactions List**: Displays the 20 most recent transactions. Clicking any transaction allows the user to edit or delete any transaction details and syncs it with Notion.
- **Analysis**: Visual financial analysis by Month & by Category over historical Notion data. Includes horizontal progress bars, bar charts, line charts, and donut charts.
- **Accounts Management**: Track bank, credit card, and cash/wallet accounts. Displays net balance and available credit.
- **Notion Sync**: Backend uses Notion Databases and is synced via a Cloudflare Worker CORS proxy. 

## Technical Stack
- **Frontend**: Vanilla HTML5, CSS3, ES2020+ JavaScript (No frameworks).
- **Backend**: Notion API (Transactions and Accounts databases) and Cloudflare Worker CORS proxy.
- **Local Storage**: Data persists in `localStorage` for offline fallback.

## Setup
1. Create a Notion Internal Integration and two databases (Transactions and Accounts) with the required schemas.
2. Open the app and navigate to **Settings** (⚙ icon).
3. Input the **API Key**, **Transactions Database ID**, and **Accounts Database ID**.
4. Click **Test Connection** to verify setup.