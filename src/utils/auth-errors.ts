/**
 * Translates raw Supabase auth errors into user-friendly messages.
 */
export function getAuthErrorMessage(err: unknown): string {
  if (!err) return "An unknown error occurred.";

  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);

  if (message.includes("Invalid login credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (
    message.includes("Email rate limit exceeded") ||
    message.includes("Too many requests")
  ) {
    return "You're doing that too fast. Please wait a minute before trying again.";
  }
  if (message.includes("User already registered")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (message.includes("Password should be at least")) {
    return "Your password is too weak. Please use at least 6 characters.";
  }
  if (message.includes("email link is invalid or has expired")) {
    return "The sign-in link is invalid or has expired. Please request a new one.";
  }

  return message;
}
