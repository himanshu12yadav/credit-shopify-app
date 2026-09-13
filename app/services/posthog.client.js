import posthog from "posthog-js";

export function initPostHog(apiKey, apiHost = "https://us.i.posthog.com") {
  if (typeof window === "undefined" || !apiKey) return;
  if (posthog.__loaded) return;

  posthog.init(apiKey, {
    api_host: apiHost,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: {
        password: true,
      },
    },
  });
}

export { posthog };
