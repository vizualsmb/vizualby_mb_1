// Development-only login bypass. Both conditions are required, and NODE_ENV is
// "production" for `next build`/`next start` and every Vercel deployment, so this
// can never open the admin outside your local `next dev`.
export const devBypass = () => process.env.NODE_ENV === "development" && process.env.ADMIN_DEV_BYPASS === "true";
