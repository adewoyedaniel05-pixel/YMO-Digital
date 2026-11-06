# Ymo Express

Frontend (`public/index.html`) and backend (`server.js`) in one project.

## Run it
1. Install Node.js 20 or newer.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env` and fill in your company email's SMTP details and a secret `ADMIN_KEY`.
4. Run `npm run dev`, then open http://localhost:3000

## What it does
- Customers order on the site. Each order is saved to `orders.json`.
- The order is emailed to `COMPANY_EMAIL`, and to the customer if they gave an email.
- Staff open `/#staff`, enter the `ADMIN_KEY`, and move orders through each stage. Customers see the new status on their tracking screen.

## Card payment (Paystack)
1. Create a free account at paystack.com and copy your **secret key** (starts with `sk_test_` while testing).
2. Put it in `.env` as `PAYSTACK_SECRET`, and set `BASE_URL` to your site's address.
3. Customers who pick Card are sent to Paystack's secure payment page. The server confirms the amount with Paystack before marking the order paid and sending the emails. Card details never touch your server.
4. For real money, switch to your live key (`sk_live_`) after Paystack approves your business.

## Before going live
- Host it on a server (Render, Railway or a VPS) behind HTTPS.
- Prices are sent from the page. Before taking real payments, store the menu on the server and recalculate totals there.
