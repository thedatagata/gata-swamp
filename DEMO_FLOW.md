# Demo User Flow Documentation

## Overview

The demo user flow allows you to create demo access credentials via the admin panel, and those users
can then experience the complete signup process including plan selection, add-ons, account creation,
and mock checkout.

## Complete Flow

### 1. **Admin Creates Demo Access**

- Location: `/admin/users` (Admin Panel)
- Admin creates demo credentials with:
  - Email
  - Password
  - Model tier assignment (3b or 7b)
- These credentials are stored in Deno KV via the `demo_access` model

### 2. **Demo User Logs In**

- Location: Landing page → "Demo Access" button
- Demo user enters email and password
- Backend validates credentials against stored demo access records
- On success:
  - Sets `demo_access_token` cookie
  - Redirects to `/demo/setup`

### 3. **Plan Selection**

- Location: `/demo/setup` (Step 1 of 4)
- User chooses between:
  - **Starter Dashboard** ($9.99/mo)
    - Manual table selection
    - Basic SQL generation
    - Observable Plot visualizations
  - **Smarter Dashboard** ($49.99/mo)
    - AI-powered semantic analytics
    - Natural language queries
    - Automatic chart generation

### 4. **Add-ons Selection**

- Location: `/demo/setup` (Step 2 of 4)
- Available add-ons based on selected plan:
  - **For Starter Plan:**
    - AI SQL Generation (+$9.00/mo)
  - **For Smarter Plan:**
    - AI Assistant Analyst (+$19.00/mo)
- Shows running total

### 5. **Account Creation**

- Location: `/demo/setup` (Step 3 of 4)
- User enters:
  - Username (any string)
  - Password (any string)
- These are temporary demo credentials for experiencing the app
- Placeholders suggest "any_username" and "any_password"

### 6. **Mock Checkout**

- Location: `/demo/setup` (Step 4 of 4)
- Displays order summary:
  - Selected plan with price
  - Selected add-ons with prices
  - Total amount
- Shows warning: "This is a mock checkout. No real payment will be processed."
- On "Pay" button click:
  1. Creates user account in Deno KV with selected plan/add-ons
  2. Simulates payment processing (1.5s delay)
  3. Creates session cookie
  4. Redirects to `/app/dashboard`

### 7. **Dashboard Experience**

- User is now logged in with their demo account
- They experience the dashboard based on their selected plan:
  - Free plan with add-ons, or
  - Premium plan (Smarter) with optional add-ons
- All data about their plan and add-ons is stored in the User model

## Key Files

### Frontend (Islands)

- `islands/demo/DemoSetup.tsx` - Complete 4-step demo flow
- `islands/admin/DemoUserManagement.tsx` - Admin UI for managing demo access

### Backend (Routes & API)

- `routes/demo/setup.tsx` - Demo setup page (checks for demo_access_token cookie)
- `routes/api/demo/access.ts` - Validates demo login credentials
- `routes/api/demo/create-account.ts` - Creates user account after checkout
- `routes/admin/users.tsx` - Admin panel for creating demo access

### Models

- `utils/models/demo_access.ts` - Manages demo access credentials
- `utils/models/user.ts` - User accounts with plan/addon info
- `utils/models/session.ts` - User sessions

## User Model Structure

```typescript
interface User {
  username: string;
  passwordHash: string;
  plan_tier: "free" | "premium"; // Based on plan selection
  ai_addon_unlocked: boolean; // AI SQL addon
  ai_analyst_unlocked: boolean; // AI Analyst addon
  preferred_model_tier?: "3b" | "7b"; // AI model tier
  motherDuckToken?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Security Flow

1. Demo access is password-protected (admin sets passwords)
2. LaunchDarkly allowlist provides secondary validation
3. Demo users create separate "user" accounts (stored separately)
4. Session cookies manage authentication
5. All passwords are bcrypt hashed

## Notes

- Demo users can create multiple test accounts
- Each test account gets its own session
- Plans and add-ons determine feature access in the dashboard
- The checkout is completely mock - no real payment processing
