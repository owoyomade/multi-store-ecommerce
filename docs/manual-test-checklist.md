# Manual test checklist

Run through this after setup (see README). Each item says what to do and what you should see.

## Phase 1 — Foundation

### Accounts

- [ ] **Sign up.** Go to http://localhost:3210/sign-up and create an account with a made-up `@example.test` email. You land on "Check your email".
- [ ] **Verify email.** Open Mailpit (http://localhost:8030), open "Verify your email address", click the button. You land on "Your stores", signed in.
- [ ] **Unverified sign-in is blocked.** Sign up a second account but don't verify it. Try to sign in: you see "Please verify your email first" and a fresh email arrives in Mailpit.
- [ ] **Wrong password.** Sign in with a wrong password: "Email or password is incorrect." (the same message for an unknown email).
- [ ] **Rate limit.** Submit a wrong password several times quickly: you see "Too many attempts".
- [ ] **Password reset.** Click "Forgot password?", enter your email, open the email in Mailpit, choose a new password. The old password no longer works; the new one does. Opening the same reset link again shows it is invalid.
- [ ] **Sign out.** Click "Sign out": you're back on sign-in, and visiting http://localhost:3210/dashboard redirects you to sign-in.

### Stores

- [ ] **Empty state.** A brand-new account sees "You don't have a store yet".
- [ ] **Create a store.** Click "Create your first store". Typing a name fills in the store address automatically. The branding preview changes as you pick colours. Submit: you land on the store overview marked "Draft", with "Create your store" ticked.
- [ ] **Taken address.** Create another store with the address `northbrew`: the address field shows "That store address is already taken" and your other inputs are kept.
- [ ] **Invalid address.** Try `My Store!` or `admin` as the address: you get a clear error.
- [ ] **Edit settings.** Open Settings, change the name and colours, save: "Settings saved." and the sidebar shows the new name.

### Roles and tenant isolation (use the seeded accounts)

- [ ] **Multiple stores, different roles.** Sign in as `sam@example.test`: you see Northbrew Coffee (Manager) and Lumen Studio Apparel (Fulfillment agent).
- [ ] **Role-limited settings.** As Sam, open Lumen: there is no Settings link. Visit `/dashboard/lumen/settings` directly: "Only the store owner can change settings."
- [ ] **Other merchants' stores are invisible.** As Sam, visit `/dashboard/<a store you created>`: "Page not found". As your own account, visit `/dashboard/northbrew` and `/dashboard/lumen/settings`: "Page not found".
- [ ] **Owners see everything in their store.** Sign in as `maya@northbrew.example.test`: Northbrew shows Overview and Settings.

## Phase 2 — Catalog and storefront

### Storefronts (signed out is fine)

- [ ] **Two different looks.** Open http://localhost:3210/s/northbrew and http://localhost:3210/s/lumen. Northbrew (Classic) opens with its label card over a photograph of roasted beans, which shrinks to a corner stub as you scroll on desktop, then a featured coffee, a printed price list and the founder's letter. Lumen (Bold) is split in two on desktop: a still, slowly crossfading picture on the right while the left scrolls through a striped card, the featured tee, the letter and large collection names. Every picture has a caption, and all credits are in each footer.
- [ ] **Drafts stay hidden.** Neither store lists "Holiday Spice Blend" or "Archive Sample Jacket". Visiting `/s/northbrew/products/holiday-blend` shows "Page not found".
- [ ] **Browse.** Click a collection in the header, then a product. Pick options: the price and stock message update (e.g. Ethiopia Yirgacheffe 1 kg costs more than 250 g).
- [ ] **Sold out.** Kenya Nyeri / Espresso and Swiss Water Decaf show as sold out, and "Add to cart" is disabled.
- [ ] **Search, filter, sort.** On "Shop all", search for `tee`, set a price range, tick "In stock only", sort by price. The URL changes, so results can be shared.
- [ ] **Cart.** Add two different items. The header shows the count. On the cart page, change a quantity (the total updates) and remove an item. Try a quantity above the stock of Burr Hand Grinder (4): you get "Only 4 left in stock."
- [ ] **Separate carts per store.** Items added at Northbrew don't appear in Lumen's cart.
- [ ] **Subdomains.** Open http://lumen.localhost:3210. Links stay on the subdomain (`/products/...`, without `/s/lumen`).
- [ ] **Phone size.** Make the window narrow: the "Menu" button opens search and collections, and nothing scrolls sideways.

### Dashboard (sign in as `maya@northbrew.example.test`)

- [ ] **Product list.** Products shows each product's status, stock and price. Search and the status filter work.
- [ ] **Create a product.** Add product → enter a title (URL and SKU fill in automatically), a price, and an option such as Size `500 ml, 1 L`. Enter a compare-at price lower than the price: you get an error, and everything you typed is still there. Fix it and create the product.
- [ ] **Variants.** On the product page, change one variant's price and stock and save. Stock changes are recorded in the ledger (`inventory_movements` table).
- [ ] **Images.** Upload a JPEG or PNG: it appears. Rename a text file to `.png` and upload it: "That file isn't a valid image."
- [ ] **Publish.** Set Visibility to Published, save, then "View on storefront".
- [ ] **Collections.** Create a collection, tick it on a product's page, and check it appears in the storefront header.
- [ ] **Publish the store.** Create a new store: its storefront is a preview only you can see (amber banner). Click "Publish store" on the overview; signed out, the storefront is now visible.
- [ ] **Roles.** Sign in as `sam@example.test`: at Lumen (fulfillment agent) there are no Products or Collections links, and `/dashboard/lumen/products` says your role doesn't include managing products.

## Phase 3 — Checkout and orders

### Without Stripe keys

- [ ] **Checkout page.** Add items, click "Check out". The page shows your items, subtotal, shipping (free above the store's threshold), demo tax and total, and says payments aren't set up; "Continue to payment" is disabled.
- [ ] **Account.** Click "Account" in a store header. Signed out, you get sign-in and create-account buttons that bring you back afterwards. Signed in, you see orders and saved addresses for this store only.

### With Stripe test keys (see README → Payments)

- [ ] **Successful purchase.** Check out as a guest with card 4242 4242 4242 4242. You return to "Thank you for your order", the cart is empty, and an order confirmation email is in Mailpit.
- [ ] **Stock.** The product's stock in the dashboard dropped by the quantity bought.
- [ ] **Merchant view.** Dashboard → Orders shows the order as Paid; its page shows items, address, the Stripe payment and the history (Awaiting payment → Paid).
- [ ] **Cancel.** Start a checkout, then click the back arrow on Stripe's page. You return to your cart with "Checkout cancelled", and the order shows as Cancelled.
- [ ] **Declined card.** Use 4000 0000 0000 0002: Stripe shows the decline and no order is marked paid.
- [ ] **Signed-in shopper.** Sign in, check out with "Save this address" ticked. The order appears under Account, and the address is offered at your next checkout.

### Automated checks

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

All four should finish without errors.
