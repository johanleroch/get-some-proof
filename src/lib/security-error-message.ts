type SecurityError = {
  code?: string;
  status?: number;
} | null;

/** Use documented error codes, never raw server messages or internal details. */
export function securityErrorMessage(error: SecurityError, fallback: string) {
  const code = error?.code;
  // Check specific codes before HTTP status: a wrong code can also be a 401.
  if (code === "INVALID_PASSWORD") {
    return {
      message:
        "That password is incorrect. Enter your current account password and try again.",
      needsSignIn: false,
    };
  }
  if (code === "INVALID_CODE" || code === "OTP_HAS_EXPIRED") {
    return {
      message:
        "That code is incorrect or has expired. Enter the latest code from your authenticator app.",
      needsSignIn: false,
    };
  }
  if (
    error?.status === 429 ||
    code === "ACCOUNT_TEMPORARILY_LOCKED" ||
    code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"
  ) {
    return {
      message: "Too many attempts. Wait a few minutes before trying again.",
      needsSignIn: false,
    };
  }
  if (
    code === "SESSION_NOT_FRESH" ||
    code === "INVALID_TWO_FACTOR_COOKIE" ||
    error?.status === 401
  ) {
    return {
      message:
        "Sign in again to continue. This security action needs a recent sign-in.",
      needsSignIn: true,
    };
  }
  return { message: fallback, needsSignIn: false };
}
