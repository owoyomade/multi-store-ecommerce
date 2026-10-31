/**
 * The Content-Security-Policy header: a list of where the browser may load
 * scripts, styles, images and so on from. If an attacker ever manages to slip
 * a <script> into a page (say, in a product description), the browser
 * refuses to run it because it doesn't carry this request's nonce.
 */
export function buildContentSecurityPolicy(options: {
  nonce: string;
  isDev: boolean;
  /** Only when the site is served over HTTPS; on http it would break every asset. */
  upgradeInsecureRequests: boolean;
}): string {
  const { nonce, isDev, upgradeInsecureRequests } = options;
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' lets Next's own nonce-tagged scripts load the chunks
    // they need. React needs eval only in development, for error overlays.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes carry each store's brand colours. Styles can't
    // run code, so allowing them is a small, deliberate trade-off.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Checkout forms hand the shopper over to Stripe's hosted payment page.
    "form-action 'self' https://checkout.stripe.com",
    // Nobody may show our pages inside a frame (stops "clickjacking").
    "frame-ancestors 'none'",
    ...(upgradeInsecureRequests ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}
