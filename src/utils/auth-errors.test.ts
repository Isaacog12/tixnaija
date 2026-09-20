import { describe, it, expect } from "vitest";
import { getAuthErrorMessage } from "./auth-errors";

describe("getAuthErrorMessage", () => {
  it("handles known Supabase auth error message patterns", () => {
    expect(getAuthErrorMessage(new Error("Invalid login credentials")))
      .toBe("Incorrect email or password. Please try again.");
      
    expect(getAuthErrorMessage({ message: "Email rate limit exceeded" }))
      .toBe("You're doing that too fast. Please wait a minute before trying again.");
      
    expect(getAuthErrorMessage(new Error("Too many requests from this IP")))
      .toBe("You're doing that too fast. Please wait a minute before trying again.");
      
    expect(getAuthErrorMessage("User already registered"))
      .toBe("An account with this email already exists. Try signing in.");
      
    expect(getAuthErrorMessage(new Error("Password should be at least 6 characters")))
      .toBe("Your password is too weak. Please use at least 6 characters.");
      
    expect(getAuthErrorMessage({ message: "The email link is invalid or has expired." }))
      .toBe("The sign-in link is invalid or has expired. Please request a new one.");
  });

  it("handles a generic Error instance with an arbitrary message", () => {
    const error = new Error("Something completely unexpected happened.");
    expect(getAuthErrorMessage(error)).toBe("Something completely unexpected happened.");
  });

  it("handles a plain string thrown as an error", () => {
    expect(getAuthErrorMessage("Just a plain string error"))
      .toBe("Just a plain string error");
  });

  it("returns a sensible default for null or undefined", () => {
    expect(getAuthErrorMessage(null)).toBe("An unknown error occurred.");
    expect(getAuthErrorMessage(undefined)).toBe("An unknown error occurred.");
  });

  it("handles an unrecognized/unexpected error shape by stringifying it", () => {
    // Number
    expect(getAuthErrorMessage(404)).toBe("404");
    
    // Object without a message property
    expect(getAuthErrorMessage({ code: 500, details: "Server Error" }))
      .toBe("[object Object]");
      
    // Array
    expect(getAuthErrorMessage(["error1", "error2"]))
      .toBe("error1,error2");
  });
});
