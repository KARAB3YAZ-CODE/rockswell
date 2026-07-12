/** Shared password policy for register / reset / change-password. */
export const MIN_PASSWORD_LENGTH = 8

export function assertPasswordPolicy(password: string): void {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır`)
  }
}

export function passwordPolicyHint(): string {
  return `En az ${MIN_PASSWORD_LENGTH} karakter`
}
