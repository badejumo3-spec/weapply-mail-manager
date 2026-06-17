// ============================================================
// INTENT PHRASES
// Trigger words that indicate this is an authentication email
// Uses word-boundary regex for precise matching
// ============================================================
const INTENT_PHRASES = [
  "otp",
  "verification",
  "verify",
  "code",
  "one-time",
  "one time",
  "password reset",
  "reset link",
  "reset your password",
  "confirm your account",
  "confirm your email",
  "security code",
  "verification code",
  "authentication code",
  "login code",
  "sign in code",
  "passcode",
  "access code",
  "two-factor",
  "2fa",
  "enter the code",
  "use this code",
  "your code",
  "system code",
  "pin",
];

// ============================================================
// REJECT WORDS
// Signals that this is spam, marketing, or promotional
// Only include words that NEVER appear in legitimate auth emails
// ============================================================
const REJECT_WORDS = [
  "unsubscribe",
  "newsletter",
  "promotion",
  "promotional",
  "discount",
  "marketing",
  "% off",
  "limited time",
  "shop now",
  "buy now",
  "free shipping",
  "sale ends",
  "opt out",
  "manage preferences",
  "you are receiving this because",
  "you were subscribed",
];

// ============================================================
// KNOWN AUTH SENDER DOMAINS
// Bonus signal when sender is a known platform
// Checked against sender email, not body text
// ============================================================
const KNOWN_AUTH_DOMAINS = [
  "google.com",
  "github.com",
  "amazon.com",
  "amazonaws.com",
  "apple.com",
  "microsoft.com",
  "slack.com",
  "zoom.us",
  "stripe.com",
  "paypal.com",
  "auth0.com",
  "okta.com",
  "dropbox.com",
  "notion.so",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "coinbase.com",
  "binance.com",
  "discord.com",
  "shopify.com",
  "twilio.com",
  "sendgrid.com",
];

// ============================================================
// COMPILED REGEX
// Compile once at module load for performance
// ============================================================
const compiledIntentRegex = new RegExp(
  INTENT_PHRASES.map(
    (phrase) => `\\b${phrase.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\b`
  ).join("|"),
  "i"
);

const compiledRejectRegex = new RegExp(
  REJECT_WORDS.map(
    (word) => `\\b${word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\b`
  ).join("|"),
  "i"
);

// ============================================================
// YEAR / ZIPCODE GUARD
// Prevents extracting 2024, 2025, 2026, 90210 as OTP
// ============================================================
const FALSE_POSITIVE_PATTERN = /^(19\d{2}|20\d{2}|\d{5})$/;

// ============================================================
// EXPORT INTERFACE
// ============================================================
export interface ExtractionResult {
  otp_code: string | null;
  verification_link: string | null;
  classification_status: "auto_filtered" | "admin_only";
  visibility_level: "tier2_allowed" | "tier1_only";
}

// ============================================================
// MAIN EXTRACTION FUNCTION
// ============================================================
export function extractAuthArtifacts(
  subject: string,
  text: string,
  senderEmail?: string
): ExtractionResult {
  const normalizedSubject = subject.toLowerCase();
  const normalizedText = text.toLowerCase();
  const normalizedSender = (senderEmail || "").toLowerCase();

  // ============================================================
  // STEP 1 - INTENT CHECK
  // Must have at least one intent signal to proceed
  // ============================================================
  const subjectHasIntent = compiledIntentRegex.test(normalizedSubject);
  const bodyHasIntent = compiledIntentRegex.test(normalizedText);

  if (!subjectHasIntent && !bodyHasIntent) {
    // No authentication intent at all - hard admin only
    return {
      otp_code: null,
      verification_link: null,
      classification_status: "admin_only",
      visibility_level: "tier1_only",
    };
  }

  // ============================================================
  // STEP 2 - SCORING (used for link-only emails)
  // OTP emails bypass score gating entirely (see Step 5)
  // ============================================================
  let score = 0;

  // +2 for subject intent (stronger signal)
  if (subjectHasIntent) score += 2;

  // +1 for body intent
  if (bodyHasIntent) score += 1;

  // +1 for known sender domain
  const senderIsKnown = KNOWN_AUTH_DOMAINS.some((domain) =>
    normalizedSender.includes(domain)
  );
  if (senderIsKnown) score += 1;

  // -3 for marketing/spam signals
  const hasRejectWords = compiledRejectRegex.test(normalizedText);
  if (hasRejectWords) score -= 3;

  // ============================================================
  // STEP 3 - EXTRACT NUMERIC OTP
  // Strictly numeric (4-8 digits) to prevent word extraction
  // Requires proximity to an intent trigger phrase
  // ============================================================
  let extractedOtp: string | null = null;

  // Primary: OTP immediately after a trigger phrase
  const otpTriggerRegex =
    /(?:verification code|security code|login code|one-time password|one time password|passcode|otp|enter the code|use this code|authentication code|2fa code|pin is|code is|system code|your code|code:|pin:)[\s:.\-–—]*(\d{4,8})/gi;

  let match: RegExpExecArray | null;

  while ((match = otpTriggerRegex.exec(text)) !== null) {
    const candidate = match[1];

    // Reject years and zipcodes
    if (FALSE_POSITIVE_PATTERN.test(candidate)) continue;

    extractedOtp = candidate;
    console.log(`[Extraction] OTP found via trigger: ${candidate}`);
    break;
  }

  // Fallback: standalone numeric code (4-8 digits) near intent phrase
  if (!extractedOtp) {
    const standaloneNumericRegex = /\b(\d{4,8})\b/g;

    while ((match = standaloneNumericRegex.exec(text)) !== null) {
      const candidate = match[1];

      // Reject years and zipcodes
      if (FALSE_POSITIVE_PATTERN.test(candidate)) continue;

      // Only accept if surrounded by intent context
      const matchStart = match.index;
      const startWindow = Math.max(0, matchStart - 300);
      const endWindow = Math.min(text.length, matchStart + 300);
      const surrounding = text.substring(startWindow, endWindow).toLowerCase();

      if (compiledIntentRegex.test(surrounding)) {
        extractedOtp = candidate;
        console.log(`[Extraction] OTP found via standalone numeric: ${candidate}`);
        break;
      }
    }
  }

  // ============================================================
  // STEP 4 - EXTRACT VERIFICATION LINK
  // Auth URL path keywords are the primary signal
  // Surrounding text intent is the fallback signal
  // ============================================================
  let extractedLink: string | null = null;

  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const urlMatches = text.match(urlRegex) || [];

  const authUrlRegex =
    /reset|verify|confirm|login|authenticate|token|auth|activate|validation|signup|secure/i;

  const skipUrlPatterns = [
    "unsubscribe",
    "marketing",
    "blog",
    "facebook.com/sharer",
    "twitter.com/intent",
    "linkedin.com/share",
  ];

  for (const url of urlMatches) {
    const normalizedUrl = url.toLowerCase();

    // Skip known non-auth URL patterns
    if (skipUrlPatterns.some((pattern) => normalizedUrl.includes(pattern))) {
      continue;
    }

    // Strong signal: auth keyword in URL path
    if (authUrlRegex.test(normalizedUrl)) {
      extractedLink = url;
      console.log(`[Extraction] Link found via URL keyword: ${url}`);
      break;
    }

    // Weaker signal: intent phrase in surrounding text near this URL
    const urlIndex = text.indexOf(url);
    if (urlIndex !== -1) {
      const startWindow = Math.max(0, urlIndex - 200);
      const endWindow = Math.min(text.length, urlIndex + url.length + 200);
      const surrounding = text.substring(startWindow, endWindow).toLowerCase();

      if (compiledIntentRegex.test(surrounding)) {
        extractedLink = url;
        console.log(`[Extraction] Link found via surrounding intent: ${url}`);
        break;
      }
    }
  }

  // ============================================================
  // STEP 5 - CLASSIFICATION
  //
  // RULE 1: Numeric OTP extracted → ALWAYS Tier 2
  //   Rationale: OTP has already passed 4 layers of validation:
  //   - Intent phrase required nearby
  //   - Strictly numeric (no words)
  //   - Year/zipcode guard applied
  //   - 4-8 digit length required
  //   Score penalties should NOT override a valid OTP.
  //
  // RULE 2: Link only → requires score >= 3
  //   Rationale: Links are easier to fake in marketing emails.
  //   Score acts as second filter for link-only classification.
  //
  // RULE 3: No artifact → Admin only
  //   Rationale: Nothing useful was extracted.
  // ============================================================

  // ✅ RULE 1: OTP always wins
  if (extractedOtp) {
    console.log(`[Extraction] RULE 1 - OTP present → tier2_allowed (score: ${score})`);
    return {
      otp_code: extractedOtp,
      verification_link: extractedLink,
      classification_status: "auto_filtered",
      visibility_level: "tier2_allowed",
    };
  }

  // ✅ RULE 2: Link only - needs score
  if (extractedLink && score >= 3) {
    console.log(`[Extraction] RULE 2 - Link only, score ${score} >= 3 → tier2_allowed`);
    return {
      otp_code: null,
      verification_link: extractedLink,
      classification_status: "auto_filtered",
      visibility_level: "tier2_allowed",
    };
  }

  // ✅ RULE 3: Admin only
  console.log(`[Extraction] RULE 3 - No valid artifact or score too low (score: ${score}) → admin_only`);
  return {
    otp_code: extractedOtp,
    verification_link: extractedLink,
    classification_status: "admin_only",
    visibility_level: "tier1_only",
  };
}