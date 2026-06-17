import { ImapFlow } from "imapflow";

interface ParsedOtpResult {
  otpCode: string | null;
  verificationLink: string | null;
  source: string;
  sender: string;
  recipientEmail?: string | null;
  subject: string;
  snippet: string;
  timestamp?: string;
  fullBodyHtml?: string;
  fullBodyText?: string;
  classificationStatus: "auto_filtered" | "admin_only";
  visibilityLevel: "tier2_allowed" | "tier1_only";
}

// Extract OTP code and source brand or verification links from email envelope and content
export function extractOtpFromEmail(
  subject: string, 
  sender: string, 
  bodyText: string
): ParsedOtpResult {
  // 1. Identify Source Brand first
  let source = "External";
  const senderLower = sender.toLowerCase();
  const subjectLower = subject.toLowerCase();

  if (senderLower.includes("stripe") || subjectLower.includes("stripe")) {
    source = "Stripe";
  } else if (senderLower.includes("github") || subjectLower.includes("github")) {
    source = "GitHub";
  } else if (senderLower.includes("aws") || senderLower.includes("amazon") || subjectLower.includes("aws") || subjectLower.includes("amazon web services")) {
    source = "AWS";
  } else if (senderLower.includes("linkedin") || subjectLower.includes("linkedin")) {
    source = "LinkedIn";
  } else if (senderLower.includes("slack") || subjectLower.includes("slack")) {
    source = "Slack";
  } else if (senderLower.includes("zoom") || subjectLower.includes("zoom")) {
    source = "Zoom";
  } else if (senderLower.includes("google") || subjectLower.includes("google")) {
    source = "Google";
  } else if (senderLower.includes("microsoft") || subjectLower.includes("microsoft")) {
    source = "Microsoft";
  } else if (senderLower.includes("facebook") || subjectLower.includes("facebook")) {
    source = "Facebook";
  } else {
    // Try to deduce from domain name
    const match = senderLower.match(/@([a-z0-9-]+)\./);
    if (match && match[1]) {
      const brand = match[1];
      if (brand !== "gmail" && brand !== "outlook" && brand !== "hotmail" && brand !== "yahoo" && brand !== "mail" && brand !== "weapply4u") {
        source = brand.charAt(0).toUpperCase() + brand.slice(1);
      }
    }
  }

  // Strip styling and raw HTML tags for safe OTP regex parsing
  const bodyTextClean = bodyText
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // strip CSS block styling
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // strip scripts
    .replace(/<[^>]*>/g, " ") // strip tags
    .replace(/\s+/g, " ") // normalize spacing
    .trim();

  // Helper log function for defensive logging
  const logExtractionDecision = (value: string, type: "OTP" | "Link", accepted: boolean, contextPhrase: string) => {
    console.log(`[EXTRACTION LOG] Candidate ${type}: "${value}" | Context: "${contextPhrase}" | Result: ${accepted ? "ACCEPTED" : "REJECTED"}`);
  };

  // 2. Separate authentication detection from code extraction
  const normalizedText = (subject + " " + bodyText).toLowerCase();
  
  const authIntentKeywords = [
    "your verification code", "your security code", "login code", "sign in code", 
    "one-time password", "otp", "passcode", "enter the code", "use this code", 
    "reset your password", "password reset", "verify your email", "confirm your email", 
    "authentication code"
  ];
  
  const hasAuthIntent = authIntentKeywords.some(kw => normalizedText.includes(kw));

  // 3. Extract Verification Links
  const hrefRegex = /href=["'](https?:\/\/[^"'\s<>]+)["']/gi;
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
  const candidateUrls: string[] = [];

  let hrefMatch;
  while ((hrefMatch = hrefRegex.exec(bodyText)) !== null) {
    candidateUrls.push(hrefMatch[1]);
  }

  let urlMatch;
  while ((urlMatch = urlRegex.exec(bodyText)) !== null) {
    candidateUrls.push(urlMatch[1]);
  }

  const uniqueUrls = Array.from(new Set(candidateUrls));
  
  const linkKeywords = ["reset", "verify", "confirm", "login", "authenticate", "token"];
  const linkContextKeywords = ["reset your password", "verify your email", "confirm your email"];
  const badLinkKeywords = [
      "unsubscribe", "blog", "help", "support", "faq", "twitter.com", 
      "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "google.com/maps", 
      "privacy", "terms", "newsletter"
  ];

  let matchedLink: string | null = null;

  if (hasAuthIntent) {
    for (const url of uniqueUrls) {
      const urlLower = url.toLowerCase();
      
      const hasBadWord = badLinkKeywords.some(kw => urlLower.includes(kw));
      if (hasBadWord) continue;

      let accepted = linkKeywords.some(kw => urlLower.includes(kw));
      
      if (!accepted) {
        const pos = bodyText.indexOf(url);
        if (pos !== -1) {
          const start = Math.max(0, pos - 120);
          const end = Math.min(bodyText.length, pos + url.length + 120);
          const surroundingText = bodyText.slice(start, end).toLowerCase();
          accepted = linkContextKeywords.some(kw => surroundingText.includes(kw));
        }
      }

      if (accepted) {
        matchedLink = url.replace(/&amp;/g, "&");
        console.log(`[EXTRACTION LOG] Accepted Link: "${matchedLink}"`);
        break;
      }
    }
  }

  // 4. Extract Alphanumeric/Numeric OTP Code
  let otpCode: string | null = null;
  
  if (hasAuthIntent) {
    const otpRegex = /(?:verification code|security code|login code|one-time password|passcode|OTP|enter the code|use this code)[\s\S]{0,100}?([A-Za-z0-9]{4,10})/i;
    const bodyMatch = bodyTextClean.match(otpRegex);
    
    if (bodyMatch) {
      const candidateCode = bodyMatch[1];
      
      // Exclusion Context check
      const exclusionWords = [
        "street", "st.", "road", "rd", "avenue", "ave", "boulevard", "suite", 
        "zip", "united states", "unsubscribe", "newsletter", "blog", "help center", 
        "privacy", "terms", "copyright", "inc.", "llc"
      ];
      
      const pos = bodyTextClean.indexOf(candidateCode);
      const start = Math.max(0, pos - 150);
      const end = Math.min(bodyTextClean.length, pos + candidateCode.length + 150);
      const context = bodyTextClean.slice(start, end).toLowerCase();
      
      const hasExclusion = exclusionWords.some(word => context.includes(word));
      
      if (!hasExclusion) {
        otpCode = candidateCode;
        console.log(`[EXTRACTION LOG] Accepted OTP: "${otpCode}"`);
      } else {
        console.log(`[EXTRACTION LOG] Rejected OTP candidate "${candidateCode}" due to nearby exclusion words.`);
      }
    }
  } else {
    console.log(`[EXTRACTION LOG] No authentication intent detected. Skipping OTP extraction.`);
  }

  // 5. Classification
  const classificationStatus = (otpCode || matchedLink) ? "auto_filtered" : "admin_only";
  const visibilityLevel = (otpCode || matchedLink) ? "tier2_allowed" : "tier1_only";

  // 5. Generate snippet around otpCode or verification link
  let snippet = bodyTextClean;
  const highlight = otpCode || matchedLink;
  if (highlight) {
    const hlIndex = bodyTextClean.indexOf(highlight);
    if (hlIndex !== -1) {
      const start = Math.max(0, hlIndex - 60);
      const end = Math.min(bodyTextClean.length, hlIndex + highlight.length + 60);
      snippet = bodyTextClean.slice(start, end).trim();
      if (start > 0) snippet = "..." + snippet;
      if (end < bodyTextClean.length) snippet = snippet + "...";
    } else {
      snippet = bodyTextClean.slice(0, 140);
    }
  } else {
    snippet = bodyTextClean.slice(0, 140);
  }

  snippet = snippet.replace(/\s+/g, " ").trim();

  return {
    otpCode: otpCode || null,
    verificationLink: matchedLink || null,
    source,
    sender,
    subject,
    snippet,
    classificationStatus,
    visibilityLevel
  };
}

// Connect to inbox and fetch outstanding unread OTP candidates
export async function pollImapInbox(
  host: string,
  port: number,
  user: string,
  pass: string
): Promise<ParsedOtpResult[]> {
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: {
      user,
      pass
    },
    logger: false,
    emitLogs: false
  });

  const extractedOtps: ParsedOtpResult[] = [];

  try {
    await client.connect();
    
    // Lock reading from INBOX
    const lock = await client.getMailboxLock("INBOX");
    
    try {
      // Find unread (SEEN = false) emails
      const uids = await client.search({ seen: false });
      const uidList = Array.isArray(uids) ? uids : [];
      
      for (const uid of uidList) {
        // Fetch envelope headers AND raw message body structure
        const message = await client.fetchOne(uid, {
          envelope: true,
          source: true
        });

        if (message && message.envelope) {
          // Limit to emails received in last 1 hour
          const msgDate = message.envelope.date ? new Date(message.envelope.date) : null;
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (msgDate && msgDate < oneHourAgo) {
            continue;
          }

          const subject = message.envelope.subject || "No Subject";
          const fromAddressObj = message.envelope.from?.[0];
          const sender = fromAddressObj 
            ? `${fromAddressObj.name || ""} <${fromAddressObj.address || ""}>`.trim()
            : "Unknown Sender";
          
          const toAddressObj = message.envelope.to?.[0];
          const recipientEmail = toAddressObj ? toAddressObj.address || "" : "";
          
          const rawBody = message.source ? message.source.toString("utf8") : "";
          
          // Basic clean of raw email body (remove MIME boundaries/headers if present)
          // Keep text decoding human-readable
          let bodyText = rawBody;
          
          // Strip MIME envelopes and headers
          const headerSplit = rawBody.indexOf("\r\n\r\n");
          if (headerSplit !== -1) {
            bodyText = rawBody.slice(headerSplit + 4);
          }

          // Strip simple html/mime noise
          bodyText = bodyText
            .replace(/=[0-9A-F]{2}/gi, "") // clean quoted-printable
            .replace(/&nbsp;/gi, " ");

          const parsed = extractOtpFromEmail(subject, sender, bodyText);
          parsed.recipientEmail = recipientEmail;
          parsed.timestamp = message.envelope.date
            ? new Date(message.envelope.date).toISOString()
            : new Date().toISOString();
          parsed.fullBodyHtml = bodyText.includes("<div") || bodyText.includes("<html") || bodyText.includes("<p>")
            ? bodyText
            : `<div>${bodyText.replace(/\n/g, "<br/>")}</div>`;
          parsed.fullBodyText = bodyText;

          extractedOtps.push(parsed);
          
          // Mark email as READ (Seen flag) to comply with "extract and mark read" rule
          await client.messageFlagsAdd(uid, ["\\Seen"]);
        }
      }
    } finally {
      // Always release lock
      lock.release();
    }
    
    await client.logout();
  } catch (error) {
    console.error(`IMAP connection failed for ${user} on ${host}:`, error);
    throw error;
  }

  return extractedOtps;
}
