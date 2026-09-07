/**
 * Service to manage native Shopify Web Pixel activation and health
 */

export async function checkWebPixelStatus(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
        query GetWebPixels {
          webPixels(first: 5) {
            nodes {
              id
              settings
            }
          }
        }
      `
    );
    const json = await response.json();
    const pixels = json?.data?.webPixels?.nodes || [];
    return {
      active: pixels.length > 0,
      pixels,
    };
  } catch (error) {
    console.error("Failed to query web pixel status:", error);
    return { active: true, fallback: true };
  }
}

export async function registerWebPixel(admin, accountId = "native-rewards-pixel") {
  try {
    const response = await admin.graphql(
      `#graphql
        mutation CreateWebPixel($settings: JSON!) {
          webPixelCreate(webPixel: { settings: $settings }) {
            userErrors {
              code
              field
              message
            }
            webPixel {
              id
              settings
            }
          }
        }
      `,
      {
        variables: {
          settings: JSON.stringify({ accountID: accountId }),
        },
      }
    );
    const json = await response.json();
    return json?.data?.webPixelCreate;
  } catch (error) {
    console.error("Failed to register web pixel:", error);
    return { userErrors: [{ message: error.message }] };
  }
}
