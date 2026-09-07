import prisma from "../db.server";

export const action = async ({ request }) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { shop, email = "himanshuyadav.12jan@gmail.com", amount = 10.0 } = body;

    const session = await prisma.session.findFirst({ where: { shop } });
    if (!session) {
      return new Response(JSON.stringify({ success: false, error: "Shop inactive" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days urgency

    const entry = await prisma.creditLedger.create({
      data: {
        shop,
        customerId: "gid://shopify/Customer/26024363524177",
        customerEmail: email,
        customerName: "Himanshu Yadav",
        amount: parseFloat(amount),
        currency: "USD",
        action: "CREDIT",
        source: "BIRTHDAY_REWARD",
        note: `🎂 Happy Birthday! $${parseFloat(amount).toFixed(2)} Birthday Gift Credit (Expires in 14 Days)`,
        expiresAt,
        status: "COMPLETED",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully deposited $${parseFloat(amount).toFixed(2)} Birthday Perk!`,
        ledgerId: entry.id,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const loader = async () => {
  return new Response(JSON.stringify({ status: "birthday cron listening" }), {
    headers: { "Content-Type": "application/json" },
  });
};
