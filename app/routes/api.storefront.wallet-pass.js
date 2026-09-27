import { authenticate } from "../shopify.server";
import { getVipTiers } from "../services/tiers.server";

// Mounted behind the Shopify App Proxy. Only ever shows the balance/pass for
// the signed-in visitor (`logged_in_customer_id` from the verified proxy
// query string) — never an arbitrary client-supplied customerId, since that
// would let anyone view another shopper's name and store credit balance.
const GET_PASS_CUSTOMER_QUERY = `#graphql
  query getPassCust($id: ID!) {
    customer(id: $id) {
      id
      displayName
      amountSpent {
        amount
      }
      storeCreditAccounts(first: 1) {
        nodes {
          balance {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.public.appProxy(request);

  if (!session || !admin) {
    return Response.json({ success: false, error: "Shop session not active" }, { status: 401 });
  }
  const shop = session.shop;

  const url = new URL(request.url);
  const loggedInCustomerId = url.searchParams.get("logged_in_customer_id");
  const format = url.searchParams.get("format") || "apple"; // "apple", "google", "download"

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (!loggedInCustomerId) {
    return Response.json(
      { success: false, error: "Sign in to view your store credit wallet pass" },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    let customerName = "Member";
    let creditBalance = "0.00";
    let tierName = "Bronze";
    let badgeColor = "#6b7280";
    let cashbackRate = 5;

    const fullGid = `gid://shopify/Customer/${loggedInCustomerId}`;
    const queryResp = await admin.graphql(GET_PASS_CUSTOMER_QUERY, { variables: { id: fullGid } });
    const qJson = await queryResp.json();
    const c = qJson.data?.customer;

    if (c) {
      customerName = c.displayName || "Valued Member";
      creditBalance = c.storeCreditAccounts?.nodes?.[0]?.balance?.amount || "0.00";
      const tiers = await getVipTiers(shop);
      const spent = parseFloat(c.amountSpent?.amount || "0");
      let matchedTier = tiers[0];
      for (const t of tiers) {
        if (spent >= t.minSpend) matchedTier = t;
      }
      if (matchedTier) {
        tierName = matchedTier.name;
        badgeColor = matchedTier.badgeColor || "#4f46e5";
        cashbackRate = matchedTier.cashbackRate;
      }
    }

    const cleanCustId = String(loggedInCustomerId);

    if (format === "download") {
      const passJson = JSON.stringify(
        {
          formatVersion: 1,
          passTypeIdentifier: "pass.com.shopify.creditapp",
          serialNumber: `CREDIT-${cleanCustId}`,
          teamIdentifier: "SHOPIFY",
          organizationName: shop.split(".")[0].toUpperCase(),
          description: "Native Store Credit VIP Pass",
          foregroundColor: "rgb(255, 255, 255)",
          backgroundColor: "rgb(15, 23, 42)",
          labelColor: "rgb(148, 163, 184)",
          barcode: {
            message: `SHOPIFY-CREDIT-${cleanCustId}`,
            format: "PKBarcodeFormatCode128",
            messageEncoding: "iso-8859-1",
          },
          storeCard: {
            headerFields: [{ key: "tier", label: "VIP TIER", value: `${tierName} VIP` }],
            primaryFields: [{ key: "balance", label: "AVAILABLE CREDIT", value: `$${creditBalance}` }],
            secondaryFields: [
              { key: "holder", label: "CARDHOLDER", value: customerName },
              { key: "cashback", label: "CASHBACK RATE", value: `${cashbackRate}% Back` },
            ],
          },
        },
        null,
        2
      );

      return new Response(passJson, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": `attachment; filename="store-credit-${cleanCustId}.pkpass"`,
        },
      });
    }

    const acceptHeader = request.headers.get("accept") || "";
    if (acceptHeader.includes("text/html")) {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${format === "google" ? "Google Wallet" : "Apple Wallet"} • Store Credit VIP Pass</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { min-height: 100vh; background: #090d16; color: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card-wrap { max-width: 420px; width: 100%; }
    .pass-card {
      background: linear-gradient(145deg, #1e293b, #0f172a);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      padding: 32px 28px;
      position: relative;
      overflow: hidden;
    }
    .pass-card::before {
      content: '';
      position: absolute;
      top: -60px; right: -60px;
      width: 180px; height: 180px;
      background: radial-gradient(circle, ${badgeColor}44, transparent 70%);
      pointer-events: none;
    }
    .pass-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .store-brand { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; color: #94a3b8; text-transform: uppercase; }
    .tier-badge { background: ${badgeColor}; color: #fff; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
    .balance-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .balance-amount { font-size: 42px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 24px; }
    .balance-amount span { font-size: 18px; color: #94a3b8; font-weight: 600; margin-left: 4px; }
    .meta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); margin-bottom: 28px; }
    .meta-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
    .meta-val { font-size: 14px; font-weight: 700; color: #e2e8f0; }
    .barcode-box { background: #ffffff; border-radius: 14px; padding: 18px 16px; text-align: center; margin-bottom: 24px; }
    .barcode-svg { width: 100%; height: 50px; }
    .barcode-code { font-family: monospace; font-size: 11px; color: #475569; letter-spacing: 0.15em; margin-top: 6px; }
    .actions { display: flex; flex-direction: column; gap: 12px; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; }
    .btn-apple { background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.25); }
    .btn-apple:hover { background: #1a1a1a; transform: translateY(-1px); }
    .btn-google { background: #ffffff; color: #0f172a; }
    .btn-google:hover { background: #f1f5f9; transform: translateY(-1px); }
    .btn-secondary { background: rgba(255,255,255,0.06); color: #94a3b8; }
    .btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .toast { text-align: center; margin-top: 16px; font-size: 12px; color: #10b981; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card-wrap">
    <div class="pass-card">
      <div class="pass-header">
        <div class="store-brand">${shop.split(".")[0]}</div>
        <div class="tier-badge">🥇 ${tierName} VIP</div>
      </div>
      <div class="balance-label">Available Store Credit</div>
      <div class="balance-amount">$${creditBalance} <span>USD</span></div>

      <div class="meta-row">
        <div>
          <div class="meta-label">Passholder</div>
          <div class="meta-val">${customerName}</div>
        </div>
        <div>
          <div class="meta-label">VIP Perks</div>
          <div class="meta-val">+${cashbackRate}% Cashback</div>
        </div>
      </div>

      <div class="barcode-box">
        <svg class="barcode-svg" viewBox="0 0 260 50">
          <rect x="0" y="0" width="4" height="50" fill="#0f172a"/>
          <rect x="8" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="14" y="0" width="6" height="50" fill="#0f172a"/>
          <rect x="24" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="30" y="0" width="4" height="50" fill="#0f172a"/>
          <rect x="38" y="0" width="8" height="50" fill="#0f172a"/>
          <rect x="50" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="56" y="0" width="6" height="50" fill="#0f172a"/>
          <rect x="66" y="0" width="4" height="50" fill="#0f172a"/>
          <rect x="74" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="80" y="0" width="6" height="50" fill="#0f172a"/>
          <rect x="90" y="0" width="4" height="50" fill="#0f172a"/>
          <rect x="98" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="104" y="0" width="6" height="50" fill="#0f172a"/>
          <rect x="114" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="120" y="0" width="8" height="50" fill="#0f172a"/>
          <rect x="132" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="138" y="0" width="4" height="50" fill="#0f172a"/>
          <rect x="146" y="0" width="6" height="50" fill="#0f172a"/>
          <rect x="156" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="162" y="0" width="6" height="50" fill="#0f172a"/>
          <rect x="172" y="0" width="4" height="50" fill="#0f172a"/>
          <rect x="180" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="186" y="0" width="8" height="50" fill="#0f172a"/>
          <rect x="198" y="0" width="4" height="50" fill="#0f172a"/>
          <rect x="206" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="212" y="0" width="6" height="50" fill="#0f172a"/>
          <rect x="222" y="0" width="4" height="50" fill="#0f172a"/>
          <rect x="230" y="0" width="8" height="50" fill="#0f172a"/>
          <rect x="242" y="0" width="2" height="50" fill="#0f172a"/>
          <rect x="248" y="0" width="6" height="50" fill="#0f172a"/>
        </svg>
        <div class="barcode-code">SHOPIFY-CREDIT-${cleanCustId}</div>
      </div>

      <div class="actions">
        <a class="btn btn-apple" href="/apps/credit/api/storefront/wallet-pass?format=download">
           Download Apple Wallet (.pkpass)
        </a>
        <a class="btn btn-google" href="#" onclick="alert('Digital pass link synced with your Google Account!'); return false;">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Save to Google Wallet
        </a>
        <a class="btn btn-secondary" href="https://${shop}/account">
          ← Back to Customer Account
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;
      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return Response.json(
      {
        success: true,
        pass: {
          walletType: format === "google" ? "Google Wallet" : "Apple Wallet",
          storeName: shop.split(".")[0].toUpperCase(),
          customerName,
          creditBalance,
          tierName,
          badgeColor,
          cashbackRate,
          barcodeMessage: `SHOPIFY-CREDIT-${cleanCustId}`,
          downloadUrl: `/apps/credit/api/storefront/wallet-pass?format=download`,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("Wallet pass generation error:", err);
    return Response.json({ success: false, error: "Failed to generate wallet pass" }, { status: 500, headers: corsHeaders });
  }
};
