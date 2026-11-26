import type { RegistrationChallenge } from "@ideaproxima/contracts";

// Work stays in a same-origin module worker. Only the public puzzle crosses this boundary.
self.onmessage = async ({ data }: MessageEvent<RegistrationChallenge>) => {
  const encoder = new TextEncoder();
  const target = Uint8Array.from(data.challenge.match(/../g)!, (hex) => parseInt(hex, 16));
  try {
    for (let number = 0; number <= data.maxNumber; number++) {
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data.salt + number));
      const bytes = new Uint8Array(hash);
      if (target.every((value, i) => bytes[i] === value)) {
        self.postMessage(number);
        return;
      }
    }
  } catch {
    // The form uses its normal retryable error path if Web Crypto is unavailable.
  }
  self.postMessage(null);
};
