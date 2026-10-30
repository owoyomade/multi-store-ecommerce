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
