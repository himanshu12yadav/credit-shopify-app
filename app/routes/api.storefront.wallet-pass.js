import prisma from "../db.server";
import { getVipTiers } from "../services/tiers.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "pdf-store-15eu7f4v.myshopify.com";
  const customerId = url.searchParams.get("customerId");
  const format = url.searchParams.get("format") || "apple"; // "apple", "google", "download"

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (!customerId) {
    return new Response("Customer ID required", { status: 400, headers: corsHeaders });
  }

  try {
    const session = await prisma.session.findFirst({ where: { shop } });
    let customerName = "Valued Member";
    let creditBalance = "0.00";
    let tierName = "Bronze";
    let badgeColor = "#b45309";
    let cashbackRate = 5;

    if (session) {
      const fullGid = customerId.includes("gid://") ? customerId : `gid://shopify/Customer/${customerId}`;
      const queryResp = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({
          query: `
            query getPassCust($id: ID!) {
              customer(id: $id) {
                id
                displayName
                amountSpent { amount }
                storeCreditAccounts(first: 1) {
                  nodes {
                    balance { amount currencyCode }
                  }
                }
              }
            }
          `,
          variables: { id: fullGid },
        }),
      });

      const qJson = await queryResp.json();
      const c = qJson.data?.customer;
      if (c) {
        customerName = c.displayName || "Valued Member";
        creditBalance = c.storeCreditAccounts?.nodes?.[0]?.balance?.amount || "89.99";
        const tiers = await getVipTiers(shop);
        const spent = parseFloat(c.amountSpent?.amount || "1499.90");
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
    }

    if (format === "download") {
      // Simulate pkpass bundle download headers
      const passJson = JSON.stringify(
        {
          formatVersion: 1,
          passTypeIdentifier: "pass.com.shopify.creditapp",
          serialNumber: `CREDIT-${customerId}`,
          teamIdentifier: "SHOPIFY",
          organizationName: shop.split(".")[0].toUpperCase(),
          description: "Native Store Credit VIP Pass",
          foregroundColor: "rgb(255, 255, 255)",
          backgroundColor: "rgb(15, 23, 42)",
          labelColor: "rgb(148, 163, 184)",
          barcode: {
            message: `SHOPIFY-CREDIT-${customerId}`,
            format: "PKBarcodeFormatCode128",
            messageEncoding: "iso-8859-1",
          },
          storeCard: {
            headerFields: [
              {
                key: "tier",
                label: "VIP TIER",
                value: `${tierName} VIP`,
              },
            ],
            primaryFields: [
              {
                key: "balance",
                label: "AVAILABLE CREDIT",
                value: `$${creditBalance}`,
              },
            ],
            secondaryFields: [
              {
                key: "holder",
                label: "CARDHOLDER",
                value: customerName,
              },
              {
                key: "cashback",
                label: "CASHBACK RATE",
                value: `${cashbackRate}% Back`,
              },
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
          "Content-Disposition": `attachment; filename="store-credit-${customerId}.pkpass"`,
        },
      });
    }

    // Return JSON pass payload for client wallet apps
    return new Response(
      JSON.stringify({
        success: true,
        pass: {
          walletType: format === "google" ? "Google Wallet" : "Apple Wallet",
          storeName: shop.split(".")[0].toUpperCase(),
          customerName,
          creditBalance,
          tierName,
          badgeColor,
          cashbackRate,
          barcodeMessage: `SHOPIFY-CREDIT-${customerId}`,
          downloadUrl: `/api/storefront/wallet-pass?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(customerId)}&format=download`,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Wallet pass generation error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};
