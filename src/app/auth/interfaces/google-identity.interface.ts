// Identity proven by a Google ID token, as far as the sign-in check needs it.
export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
}
