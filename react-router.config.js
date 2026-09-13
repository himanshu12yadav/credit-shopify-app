/** @type {import('@react-router/dev/config').Config} */
export default {
  ssr: true,
  // Whitelist Shopify Admin iframe origins for React Router v7 CSRF singleFetch protection
  allowedActionOrigins: [
    "admin.shopify.com",
    "*.myshopify.com",
    "*.shopify.com",
    "*.onrender.com",
    "credit-shopify-app.onrender.com",
    "*.trycloudflare.com",
    "*.spin.dev",
    "localhost:*",
    "127.0.0.1:*",
  ],
};
