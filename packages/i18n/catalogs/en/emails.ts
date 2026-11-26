export const emails = {
  greeting: "Hello {name},",
  verify_email: "Verify your email address",
  verify_emailBody:
    "Confirm your email address for ideaproxima. This link is valid for 48 hours. If you did not request this, ignore this message.",
  reset_password: "Reset your password",
  reset_passwordBody:
    "Choose a new password for ideaproxima within one hour. If you did not request a reset, ignore this message.",
  change_email: "Confirm your new email address",
  change_emailBody: "Confirm this address for your ideaproxima account within 24 hours.",
  password_changed: "Your password was reset",
  password_changedBody:
    "Your ideaproxima password was reset and all sessions were signed out. If this was unexpected, request a new reset.",
  email_change_notice: "A change of email address was requested",
  email_change_noticeBody:
    "Someone entered the current password to change your ideaproxima email address. If this was unexpected, reset your password.",
  existing_account: "You already have an account",
  existing_accountBody:
    "Someone tried to sign up for ideaproxima using this address. You can sign in or request a password reset.",
} as const;
