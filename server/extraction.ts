const INTENT_PHRASES = [
  "your verification code",
  "your security code",
  "login code",
  "one-time password",
  "passcode",
  "reset your password",
  "verify your email",
  "confirm your email",
  "authentication code",
  "sign in code",
  "account verification",
  "two-factor",
  "2FA code",
  "verification PIN",
];

const REJECT_WORDS = [
  "street",
  "suite",
  "unsubscribe",
  "blog",
  "help center",
  "privacy",
  "terms",
  "copyright",
  "inc.",
  "llc",
  "newsletter",
  "promotion",
  "offer",
  "discount",
  "marketing",
];

export interface ExtractionResult {
  otp_code: string | null;
  verification_link: string | null;
  classification_status: "auto_filtered" | "admin_only";
  visibility_level: "tier2_allowed" | "tier1_only";
}

export function extractAuthArtifacts(subject: string, text: string): ExtractionResult {
  const normalizedSubject = subject.toLowerCase();
  const normalizedText = text.toLowerCase();

  // 1. Check for authentication intent
  const hasIntent = INTENT_PHRASES.some(
    (phrase) => normalizedSubject.includes(phrase) || normalizedText.includes(phrase)
  );

  if (!hasIntent) {
    return {
      otp_code: null,
      verification_link: null,
      classification_status: "admin_only",
      visibility_level: "tier1_only",
    };
  }

  // 2. Extract OTP Code (improved regex)
  let extractedOtp: string | null = null;
  const otpRegex = /(?:verification code|security code|login code|one-time password|passcode|OTP|enter the code|use this code|authentication code|2FA code|PIN is)[\s\S]{0,100}?([A-Za-z0-9]{4,10})/gi;
  
  let match;
  while ((match = otpRegex.exec(text)) !== null) {
    const candidate = match[1];
    const matchStart = match.index;
    const matchEnd = otpRegex.lastIndex;

    // Check nearby text rejection
    const startWindow = Math.max(0, matchStart - 150);
    const endWindow = Math.min(text.length, matchEnd + 150);
    const surroundingText = text.substring(startWindow, endWindow).toLowerCase();

    const isRejected = REJECT_WORDS.some((word) => surroundingText.includes(word));
    if (!isRejected && !candidate.match(/^(http|www)/i)) {
      extractedOtp = candidate;
      break;
    }
  }

  // 3. Extract Verification Link (improved)
  let extractedLink: string | null = null;
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const urlMatches = text.match(urlRegex) || [];

  for (const url of urlMatches) {
    const normalizedUrl = url.toLowerCase();
    
    // Skip common non-auth domains
    if (normalizedUrl.includes("unsubscribe") || 
        normalizedUrl.includes("marketing") || 
        normalizedUrl.includes("blog") ||
        normalizedUrl.includes("facebook.com") ||
        normalizedUrl.includes("twitter.com") ||
        normalizedUrl.includes("linkedin.com")) {
      continue;
    }
    
    // Check if the URL contains auth keywords
    const urlMatchesKeywords = /reset|verify|confirm|login|authenticate|token|auth|security/i.test(normalizedUrl);
    
    if (urlMatchesKeywords) {
      extractedLink = url;
      break;
    }

    // Check surrounding text
    const urlIndex = text.indexOf(url);
    if (urlIndex !== -1) {
      const startWindow = Math.max(0, urlIndex - 100);
      const endWindow = Math.min(text.length, urlIndex + url.length + 100);
      const surroundingText = text.substring(startWindow, endWindow).toLowerCase();

      const surroundingMatchesKeywords = /reset|verify|confirm|login|security|code|auth/i.test(surroundingText);
      if (surroundingMatchesKeywords) {
        extractedLink = url;
        break;
      }
    }
  }

  // 4. Assign classification
  if (extractedOtp || extractedLink) {
    return {
      otp_code: extractedOtp,
      verification_link: extractedLink,
      classification_status: "auto_filtered",
      visibility_level: "tier2_allowed",
    };
  }

  return {
    otp_code: null,
    verification_link: null,
    classification_status: "admin_only",
    visibility_level: "tier1_only",
  };
}