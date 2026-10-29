# Querydesk — Text-to-SQL Assistant

A local web app that turns sales questions into editable SQLite queries. Includes a reproducible sample sales database, schema explorer, query explanations, read-only execution, recent questions and CSV export. No npm dependencies or API key are required for sample mode.

## Run

Install Node.js **24.13 or later**, then in PowerShell:

```powershell
cd D:\NLP_CWS-Daksh
npm start
```

Open http://localhost:3000. The first start creates `data/sales.sqlite`. If PowerShell blocks `npm.ps1`, use `npm.cmd start` or `node --env-file-if-exists=.env server.js`.

## Use

1. Choose a suggested question or enter one of the supported sample questions.
2. Select **Generate SQL**. Review the explanation and edit the SQL if needed.
3. Select **Run query**. Export the result as CSV if needed.

Ctrl+Enter generates SQL in the question box and runs SQL in the editor. Recent questions are kept in this browser's local storage; Clear removes them.

Sample mode is a rule-based translator, not a language model. It supports monthly revenue, regional revenue, top customers (including a requested top count), best-selling products or categories, order counts by status, customers without orders, total revenue, and simple table lists/counts. More complex filtering, dates and free-form requests require the optional AI integration or manual SQL. Always review generated SQL for your intended meaning.

## Optional AI translation

Copy `.env.example` to `.env` and set `OPENAI_API_KEY`. Restart the app. The model defaults to `gpt-4.1-mini` and can be changed using `OPENAI_MODEL`. The API key stays on the server. In AI mode your question and database schema are sent to OpenAI; query result rows are not sent. API usage may incur charges. Do not commit `.env`.

## Sample data

The database contains 12 fictional customers, 8 products, 180 orders and 360 order items dated January–October 2026. Amounts are illustrative, with no currency implied. Revenue uses completed orders only and equals `quantity * unit_price`. Relationships: `orders.customer_id → customers.id`, `order_items.order_id → orders.id`, `order_items.product_id → products.id`.

## Safety and scope

The server binds to `127.0.0.1` for local single-user use. Queries use a read-only SQLite connection, query-only mode and an allowlist-based SQLite authorizer. Execution runs in a subprocess killed after 3 seconds; results are capped at 500 rows. Non-query statements and file access are blocked. This app has no authentication and is not intended to be exposed directly to a network. CSV output escapes formula prefixes. Sample mode is intentionally limited; review SQL before using its results.

## Test

```powershell
npm test
```

API routes: `GET /api/schema`, `POST /api/translate` with `{ "question": "..." }`, and `POST /api/query` with `{ "sql": "SELECT ..." }`.
