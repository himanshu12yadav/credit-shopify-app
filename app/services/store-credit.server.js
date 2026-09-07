import prisma from "../db.server";

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
  notify = true,
  source = "MANUAL",
  ruleId = null,
  note = "Store credit issued",
  metadata = null,
}) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("Credit amount must be greater than 0");
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
  const ledgerEntry = await prisma.creditLedger.create({
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
    },
  });

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
}) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("Debit amount must be greater than 0");
  }

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

  try {
    const response = await admin.graphql(SEARCH_CUSTOMERS_QUERY, {
      variables: { query: query.trim() },
    });
    const json = await response.json();
    const rawCustomers = json.data?.customers?.edges?.map((e) => e.node) || [];

    return rawCustomers.map((c) => {
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
  } catch (err) {
    console.error("Error searching customers:", err);
    return [];
  }
}

/**
 * Get aggregated analytics and summary for dashboard
 */
export async function getStoreCreditAnalytics({ shop }) {
  const [
    totalIssuedResult,
    totalDebitedResult,
    recentLedger,
    ledgerCount,
    activeRulesCount,
    activeCampaignsCount,
  ] = await Promise.all([
    prisma.creditLedger.aggregate({
      where: { shop, action: "CREDIT" },
      _sum: { amount: true },
    }),
    prisma.creditLedger.aggregate({
      where: { shop, action: "DEBIT" },
      _sum: { amount: true },
    }),
    prisma.creditLedger.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.creditLedger.count({ where: { shop } }),
    prisma.creditRule.count({ where: { shop, isActive: true } }),
    prisma.campaign.count({ where: { shop, isActive: true } }),
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

