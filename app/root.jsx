import { useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";
import { initPostHog } from "./services/posthog.client";

export const loader = async () => {
  return {
    posthogKey: process.env.POSTHOG_API_KEY || "phc_kJhukHhKhpy7L3bFGqPHHsuC2wDBVAj4LfmFDULhEsHG",
    posthogHost: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
  };
};

export default function App() {
  const { posthogKey, posthogHost } = useLoaderData();

  useEffect(() => {
    if (posthogKey) {
      initPostHog(posthogKey, posthogHost);
    }
  }, [posthogKey, posthogHost]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
        <style dangerouslySetInnerHTML={{ __html: `
          s-banner {
            display: block;
            margin-top: 18px !important;
            margin-bottom: 22px !important;
          }
          s-section {
            display: block;
            margin-top: 24px !important;
            margin-bottom: 24px !important;
          }
          s-page {
            display: block;
            padding-bottom: 60px !important;
          }
        ` }} />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
