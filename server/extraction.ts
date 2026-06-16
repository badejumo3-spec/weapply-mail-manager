const INTENT_PHRASES = [
  "otp",
  "verification",
  "verify",
  "code",
  "one-time",
  "password reset",
  "reset link",
  "confirm your account",
  "security code",
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

const KNOWN_AUTH_DOMAINS = [
  "amazon.com",
  "google.com",
  "github.com",
  "slack.com",
  "microsoft.com",
  "apple.com",
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "linkedin.com",
  "dropbox.com",
  "zoom.us",
  "stripe.com",
  "paypal.com",
  "auth0.com",
  "okta.com",
];

// ✅ Compile intent phrases into strict regex with word boundaries
const compiledIntentRegex = new RegExp(
  INTENT_PHRASES.map(phrase => `\\b${phrase.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`).join('|'),
  'i'
);

// ✅ Reject words regex with word boundaries
const compiledRejectRegex = new RegExp(
  REJECT_WORDS.map(word => `\\b${word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`).join('|'),
  'i'
);

// ✅ OTP candidate validation - reject years and zipcodes
const isCommonYearOrZip = /^\b(19\d{2}|20\d{2}|\d{5})\b$/;

export interface ExtractionResult {
  otp_code: string | null;
  verification_link: string | null;
  classification_status: "auto_filtered" | "admin_only";
  visibility_level: "tier2_allowed" | "tier1_only";
}

export function extractAuthArtifacts(subject: string, text: string): ExtractionResult {
  const normalizedSubject = subject.toLowerCase();
  const normalizedText = text.toLowerCase();

  // ✅ SCORING SYSTEM - Start at 0
  let score = 0;

  // 1. Check for authentication intent using word-boundary regex (+2 points)
  const hasIntent = compiledIntentRegex.test(normalizedSubject) || compiledIntentRegex.test(normalizedText);
  if (hasIntent) {
    score += 2;
  }

  // 2. Check for reject words (-3 points)
  const hasRejectWords = compiledRejectRegex.test(normalizedText);
  if (hasRejectWords) {
    score -= 3;
  }

  // 3. Check for known auth domains (+1 point)
  const hasKnownDomain = KNOWN_AUTH_DOMAINS.some(domain => normalizedText.includes(domain));
  if (hasKnownDomain) {
    score += 1;
  }

  // 4. Extract OTP Code with validation (+3 points if valid)
  let extractedOtp: string | null = null;
  const otpRegex = /(?:verification code|security code|login code|one-time password|passcode|OTP|enter the code|use this code|authentication code|2FA code|PIN is|code is)[\s\S]{0,100}?([A-Za-z0-9]{4,10})/gi;
  
  let match;
  while ((match = otpRegex.exec(text)) !== null) {
    const candidate = match[1];
    const matchStart = match.index;
    const matchEnd = otpRegex.lastIndex;

    // ✅ Validate OTP - reject years and zipcodes
    if (isCommonYearOrZip.test(candidate)) {
      continue;
    }

    // Check nearby text for rejection
    const startWindow = Math.max(0, matchStart - 150);
    const endWindow = Math.min(text.length, matchEnd + 150);
    const surroundingText = text.substring(startWindow, endWindow).toLowerCase();

    const isRejected = compiledRejectRegex.test(surroundingText);
    if (!isRejected && !candidate.match(/^(http|www)/i)) {
      extractedOtp = candidate;
      score += 3; // ✅ Add points for valid OTP
      break;
    }
  }

  // 5. Extract Verification Link
  let extractedLink: string | null = null;
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const urlMatches = text.match(urlRegex) || [];

  for (const url of urlMatches) {
    const normalizedUrl = url.toLowerCase();
    
    // Skip common non-auth domains
    if (normalizedUrl.includes("unsubscribe") || 
        normalizedUrl.includes("marketing") || 
        normalizedUrl.includes("blog")) {
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

  // ✅ 6. Gate promotion based on score threshold (>= 3 points for Tier 2)
  const isTier2Allowed = score >= 3 && (extractedOtp || extractedLink);

  if (isTier2Allowed) {
    return {
      otp_code: extractedOtp,
      verification_link: extractedLink,
      classification_status: "auto_filtered",
      visibility_level: "tier2_allowed",
    };
  }

  return {
    otp_code: extractedOtp,
    verification_link: extractedLink,
    classification_status: "admin_only",
    visibility_level: "tier1_only",
  };
}