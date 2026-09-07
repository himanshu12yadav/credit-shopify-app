import prisma from "../app/db.server.js";

async function checkFlowLoaderFallback() {
  const shop = "pdf-store-15eu7f4v.myshopify.com";
  const ledgerCusts = await prisma.creditLedger.findMany({
    where: { shop, customerEmail: { not: null } },
    select: { customerId: true, customerEmail: true, customerName: true },
    distinct: ["customerEmail"],
    take: 10,
  });
  console.log("Found ledger customers:", ledgerCusts);
}

checkFlowLoaderFallback().finally(() => process.exit());
