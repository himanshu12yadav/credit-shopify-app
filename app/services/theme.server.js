/**
 * Service to inspect active theme configuration and detect whether app embeds
 * or theme blocks from our extension are enabled.
 * Requires `read_themes` scope.
 */

export async function getThemeAppEmbedStatus({ admin, session }) {
  if (!admin || !session || !session.shop || !session.accessToken) {
    return { active: false, error: "MISSING_SESSION" };
  }

  try {
    // 1. Fetch the active/main published theme
    const themeGql = await admin.graphql(`
      query getActiveTheme {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            id
            name
          }
        }
      }
    `);

    const themeRes = await themeGql.json();
    const mainTheme = themeRes?.data?.themes?.nodes?.[0];
    if (!mainTheme?.id) {
      return { active: false, error: "NO_MAIN_THEME" };
    }

    const numericThemeId = mainTheme.id.split("/").pop();

    // 2. Fetch config/settings_data.json via Theme REST Asset API
    const assetUrl = `https://${session.shop}/admin/api/2026-01/themes/${numericThemeId}/assets.json?asset[key]=config/settings_data.json`;
    const assetResponse = await fetch(assetUrl, {
      headers: {
        "X-Shopify-Access-Token": session.accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!assetResponse.ok) {
      // 403 means read_themes scope hasn't been re-authorized by the merchant yet
      return { active: false, error: `HTTP_${assetResponse.status}`, themeName: mainTheme.name };
    }

    const assetData = await assetResponse.json();
    const rawValue = assetData?.asset?.value;
    if (!rawValue) {
      return { active: false, error: "EMPTY_SETTINGS", themeName: mainTheme.name };
    }

    const settings = JSON.parse(rawValue);
    const current = settings?.current || {};

    // 3. Check App Embeds (stored in current.blocks in OS 2.0)
    const blocks = current.blocks || {};
    for (const blockId of Object.keys(blocks)) {
      const block = blocks[blockId];
      const blockType = typeof block?.type === "string" ? block.type : "";

      // Match our extension handles or blocks
      if (
        blockType.includes("scratch-card-modal") ||
        blockType.includes("credit-storefront") ||
        blockType.includes("native-store-credit")
      ) {
        if (!block.disabled) {
          return { active: true, themeName: mainTheme.name, source: "APP_EMBED", blockType };
        }
      }
    }

    // 4. Check Section Blocks in current.sections (e.g. Cashback badge or VIP Tier progress)
    const sections = current.sections || {};
    for (const secKey of Object.keys(sections)) {
      const sec = sections[secKey];
      const secBlocks = sec?.blocks || {};
      for (const sbId of Object.keys(secBlocks)) {
        const sb = secBlocks[sbId];
        const sbType = typeof sb?.type === "string" ? sb.type : "";
        if (
          sbType.includes("cashback-badge") ||
          sbType.includes("vip-tier-progress") ||
          sbType.includes("scratch-card-modal") ||
          sbType.includes("credit-storefront") ||
          sbType.includes("native-store-credit")
        ) {
          if (!sb.disabled) {
            return { active: true, themeName: mainTheme.name, source: "THEME_BLOCK", blockType: sbType };
          }
        }
      }
    }

    // 5. Check templates/product.json for Product page app blocks (e.g. Earn Store Credit)
    try {
      const productTemplateUrl = `https://${session.shop}/admin/api/2026-01/themes/${numericThemeId}/assets.json?asset[key]=templates/product.json`;
      const prodRes = await fetch(productTemplateUrl, {
        headers: {
          "X-Shopify-Access-Token": session.accessToken,
          "Content-Type": "application/json",
        },
      });
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const prodRaw = prodData?.asset?.value;
        if (prodRaw) {
          const prodJson = JSON.parse(prodRaw);
          const pSections = prodJson?.sections || {};
          for (const sKey of Object.keys(pSections)) {
            const pBlocks = pSections[sKey]?.blocks || {};
            for (const pbId of Object.keys(pBlocks)) {
              const pb = pBlocks[pbId];
              const pbType = typeof pb?.type === "string" ? pb.type : "";
              if (
                pbType.includes("cashback-badge") ||
                pbType.includes("scratch-card-modal") ||
                pbType.includes("credit-storefront") ||
                pbType.includes("native-store-credit")
              ) {
                if (!pb.disabled) {
                  return { active: true, themeName: mainTheme.name, source: "PRODUCT_TEMPLATE", blockType: pbType };
                }
              }
            }
          }
        }
      }
    } catch {
      // ignore product template fetch error
    }

    return { active: false, themeName: mainTheme.name };
  } catch (err) {
    console.warn("Theme app embed check failed:", err.message);
    return { active: false, error: err.message };
  }
}
