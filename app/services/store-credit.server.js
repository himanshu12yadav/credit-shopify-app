import { prisma, prismaRead } from "../db.server";
import { assertValidCreditAmount, isDuplicateIdempotencyError } from "./credit-validation.server";

/**
 * GraphQL Queries and Mutations for Shopify Native Store Credit
 */

export const STORE_CREDIT_CREDIT_MUTATION = `#graphql
  mutation storeCreditAccountCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
    storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
      storeCreditAccountTransaction {
        amount {
          amount
          currencyCode
        }
        account {
          id
          balance {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const STORE_CREDIT_DEBIT_MUTATION = `#graphql
  mutation storeCreditAccountDebit($id: ID!, $debitInput: StoreCreditAccountDebitInput!) {
    storeCreditAccountDebit(id: $id, debitInput: $debitInput) {
      storeCreditAccountTransaction {
        amount {
          amount
          currencyCode
        }
        account {
          id
          balance {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const GET_CUSTOMER_STORE_CREDIT_QUERY = `#graphql
  query getCustomerStoreCredit($id: ID!) {
    customer(id: $id) {
      id
      displayName
      email
      phone
      numberOfOrders
      amountSpent {
        amount
        currencyCode
      }
      storeCreditAccounts(first: 5) {
        edges {
          node {
            id
            balance {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

export const SEARCH_CUSTOMERS_QUERY = `#graphql
  query searchCustomers($query: String!) {
    customers(first: 25, query: $query) {
      edges {
        node {
          id
          displayName
          email
          phone
          numberOfOrders
          amountSpent {
            amount
            currencyCode
          }
          storeCreditAccounts(first: 3) {
            edges {
              node {
                id
                balance {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Credit a customer's native Shopify store credit balance and record in local ledger
 */
export async function creditCustomer({
  admin,
  shop,
  customerId,
  customerEmail,
  customerName,
  orderId,
  amount,
  currencyCode = "USD",
  expiresAt = null,
  notify = true, // eslint-disable-line no-unused-vars -- accepted for callers; customer notification isn't implemented yet
  source = "MANUAL",
  ruleId = null,
  note = "Store credit issued",
  metadata = null,
  idempotencyKey = null,
  maxAmount = null,
}) {
  const numericAmount = assertValidCreditAmount(amount, { max: maxAmount, source });

  // If this exact issuance was already recorded (webhook redelivery, client
  // retry, etc.), return the existing ledger entry instead of crediting twice.
  if (idempotencyKey) {
    const existing = await prisma.creditLedger.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return {
        success: existing.status !== "FAILED",
        ledgerEntry: existing,
        shopifyTxId: existing.shopifyTransactionId,
        shopifyAccount: null,
        apiError: null,
        duplicate: true,
      };
    }
  }

  const formattedAmount = numericAmount.toFixed(2);
  let shopifyTxId = null;
  let shopifyAccount = null;
  let status = "COMPLETED";
  let apiError = null;

  try {
    const response = await admin.graphql(STORE_CREDIT_CREDIT_MUTATION, {
      variables: {
        id: customerId,
        creditInput: {
          creditAmount: {
            amount: formattedAmount,
            currencyCode: currencyCode.toUpperCase(),
          },
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        },
      },
    });

    const responseJson = await response.json();
    const userErrors = responseJson.data?.storeCreditAccountCredit?.userErrors || [];

    if (userErrors.length > 0) {
      apiError = userErrors.map((e) => e.message).join(", ");
      console.warn("Shopify storeCreditAccountCredit user error:", apiError);
      status = "PENDING_SYNC";
    } else {
      const tx = responseJson.data?.storeCreditAccountCredit?.storeCreditAccountTransaction;
      shopifyTxId = tx?.account?.id || null;
      shopifyAccount = tx?.account || null;
    }
  } catch (err) {
    console.error("Error executing storeCreditAccountCredit GraphQL:", err);
    apiError = err.message;
    status = "LOCAL_ONLY";
  }

  // Record in audit ledger
  let ledgerEntry;
  try {
    ledgerEntry = await prisma.creditLedger.create({
      data: {
        shop,
        customerId,
        customerEmail: customerEmail || null,
        customerName: customerName || null,
        orderId: orderId ? String(orderId) : null,
        amount: numericAmount,
        currency: currencyCode.toUpperCase(),
        action: "CREDIT",
        source,
        ruleId: ruleId || null,
        shopifyTransactionId: shopifyTxId,
        note: apiError ? `${note} (Notice: ${apiError})` : note,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        metadata: metadata ? (typeof metadata === "string" ? metadata : JSON.stringify(metadata)) : null,
        status,
        idempotencyKey: idempotencyKey || null,
      },
    });
  } catch (err) {
    if (isDuplicateIdempotencyError(err)) {
      const existing = await prisma.creditLedger.findUnique({ where: { idempotencyKey } });
      return {
        success: existing?.status !== "FAILED",
        ledgerEntry: existing,
        shopifyTxId: existing?.shopifyTransactionId || shopifyTxId,
        shopifyAccount,
        apiError: null,
        duplicate: true,
      };
    }
    throw err;
  }

  return {
    success: status !== "FAILED",
    ledgerEntry,
    shopifyTxId,
    shopifyAccount,
    apiError,
  };
}

/**
 * Debit a customer's native Shopify store credit balance
 */
export async function debitCustomer({
  admin,
  shop,
  customerId,
  customerEmail,
  customerName,
  amount,
  currencyCode = "USD",
  source = "MANUAL",
  note = "Manual balance adjustment",
  maxAmount = null,
}) {
  const numericAmount = assertValidCreditAmount(amount, { max: maxAmount, source });

  const formattedAmount = numericAmount.toFixed(2);
  let shopifyTxId = null;
  let status = "COMPLETED";
  let apiError = null;

  try {
    let accountId = customerId;

    // If ID is a customer GID, resolve the customer's StoreCreditAccount ID for the requested currency
    if (customerId.startsWith("gid://shopify/Customer/")) {
      const custRes = await admin.graphql(GET_CUSTOMER_STORE_CREDIT_QUERY, {
        variables: { id: customerId },
      });
      const custData = await custRes.json();
      const accounts = custData.data?.customer?.storeCreditAccounts?.edges?.map((e) => e.node) || [];
      const match = accounts.find(
        (a) => a.balance.currencyCode === currencyCode.toUpperCase()
      ) || accounts[0];

      if (!match) {
        throw new Error(`Customer does not have a store credit account in ${currencyCode} to deduct from.`);
      }
      accountId = match.id;
    }

    const response = await admin.graphql(STORE_CREDIT_DEBIT_MUTATION, {
      variables: {
        id: accountId,
        debitInput: {
          debitAmount: {
            amount: formattedAmount,
            currencyCode: currencyCode.toUpperCase(),
          },
        },
      },
    });

    const responseJson = await response.json();
    const userErrors = responseJson.data?.storeCreditAccountDebit?.userErrors || [];

    if (userErrors.length > 0) {
      apiError = userErrors.map((e) => e.message).join(", ");
      console.warn("Shopify storeCreditAccountDebit user error:", apiError);
      status = "FAILED";
    } else {
      const tx = responseJson.data?.storeCreditAccountDebit?.storeCreditAccountTransaction;
      shopifyTxId = tx?.account?.id || null;
    }
  } catch (err) {
    console.error("Error executing storeCreditAccountDebit GraphQL:", err);
    apiError = err.message;
    status = "FAILED";
  }

  const ledgerEntry = await prisma.creditLedger.create({
    data: {
      shop,
      customerId,
      customerEmail: customerEmail || null,
      customerName: customerName || null,
      amount: -numericAmount,
      currency: currencyCode.toUpperCase(),
      action: "DEBIT",
      source,
      shopifyTransactionId: shopifyTxId,
      note: apiError ? `${note} (Notice: ${apiError})` : note,
      status,
    },
  });

  return {
    success: status !== "FAILED",
    ledgerEntry,
    shopifyTxId,
    apiError,
  };
}

/**
 * Fetch a customer's details and native store credit accounts
 */
export async function getCustomerCredit({ admin, customerId }) {
  try {
    const response = await admin.graphql(GET_CUSTOMER_STORE_CREDIT_QUERY, {
      variables: { id: customerId },
    });
    const json = await response.json();
    return json.data?.customer || null;
  } catch (err) {
    console.error("Error fetching customer store credit:", err);
    return null;
  }
}

/**
 * Search customers in the merchant's store
 */
// In-memory short TTL cache for customer searches (30s) to avoid Shopify GraphQL cost throttling
const CUSTOMER_SEARCH_CACHE = new Map();
const SEARCH_CACHE_TTL_MS = 30 * 1000;

export async function searchCustomers(arg1, arg2 = "") {
  let admin;
  let query = "";
  if (arg1 && arg1.admin) {
    admin = arg1.admin;
    query = arg1.query || "";
  } else {
    admin = arg1;
    query = typeof arg2 === "string" ? arg2 : "";
  }

  const cacheKey = query.trim().toLowerCase();
  const cached = CUSTOMER_SEARCH_CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const response = await admin.graphql(SEARCH_CUSTOMERS_QUERY, {
      variables: { query: query.trim() },
    });
    const json = await response.json();
    const rawCustomers = json.data?.customers?.edges?.map((e) => e.node) || [];

    const mapped = rawCustomers.map((c) => {
      const accounts = c.storeCreditAccounts?.edges?.map((edge) => edge.node) || [];
      const primaryAccount = accounts[0] || null;
      const primaryBalance = primaryAccount
        ? `${primaryAccount.balance.currencyCode} ${parseFloat(primaryAccount.balance.amount).toFixed(2)}`
        : "USD 0.00";

      return {
        id: c.id,
        displayName: c.displayName || "Customer",
        email: c.email || "No email",
        phone: c.phone || "No phone",
        ordersCount: c.numberOfOrders || 0,
        totalSpent: c.amountSpent ? `${c.amountSpent.currencyCode} ${c.amountSpent.amount}` : "USD 0.00",
        creditBalance: primaryBalance,
        accounts,
      };
    });

    CUSTOMER_SEARCH_CACHE.set(cacheKey, { data: mapped, expiresAt: now + SEARCH_CACHE_TTL_MS });
    return mapped;
  } catch (err) {
    console.error("Error searching customers:", err);
    if (cached) return cached.data;
    return [];
  }
}

/**
 * Get aggregated analytics and summary for dashboard
 */
export async function getStoreCreditAnalytics({ shop }) {
  const db = prismaRead || prisma;

  const [
    totalIssuedResult,
    totalDebitedResult,
    recentLedger,
    ledgerCount,
    activeRulesCount,
    activeCampaignsCount,
  ] = await Promise.all([
    db.creditLedger.aggregate({
      where: { shop, action: "CREDIT" },
      _sum: { amount: true },
    }),
    db.creditLedger.aggregate({
      where: { shop, action: "DEBIT" },
      _sum: { amount: true },
    }),
    db.creditLedger.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.creditLedger.count({ where: { shop } }),
    db.creditRule.count({ where: { shop, isActive: true } }),
    db.campaign.count({ where: { shop, isActive: true } }),
  ]);

  const totalIssued = totalIssuedResult._sum.amount || 0;
  const totalDebited = Math.abs(totalDebitedResult._sum.amount || 0);
  const outstandingLiability = Math.max(0, totalIssued - totalDebited);

  return {
    totalIssued: totalIssued.toFixed(2),
    totalDebited: totalDebited.toFixed(2),
    outstandingLiability: outstandingLiability.toFixed(2),
    ledgerCount,
    activeRulesCount,
    activeCampaignsCount,
    recentLedger,
  };
}

/**
 * Checks whether the merchant's store has New Customer Accounts or Classic accounts enabled
 */
export async function getCustomerAccountVersion(admin) {
  try {
    const response = await admin.graphql(`
      query getCustomerAccountsVersion {
        shop {
          customerAccountsV2 {
            customerAccountsVersion
          }
        }
      }
    `);
    const json = await response.json();
    return json?.data?.shop?.customerAccountsV2?.customerAccountsVersion || "CLASSIC";
  } catch (err) {
    console.warn("Could not query customerAccountsV2:", err);
    return "CLASSIC";
  }
}

