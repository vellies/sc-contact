const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX =
  /(?:\+?91[\-\s]*)?[6-9]\d[\d\s\-]{7,13}\d|\b0\d{2,4}[\-\s]?\d{6,8}\b|\b1800[\-\s]?\d{3}[\-\s]?\d{3,4}\b|(?:\+?91[\s\-]+)\d[\d\s\-]{8,14}\d/g;

// ==================== URL NORMALIZE ====================
function normalizeUrl(url) {
  url = url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return "https://" + url;
  }
  return url;
}

// ==================== FETCH HTML ====================
async function fetchHTML(url) {
  const response = await axios.get(url, {
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
    timeout: 15000,
  });
  return response.data;
}

// ==================== CLEAN EMAIL ====================
function cleanEmail(email) {
  email = email.toLowerCase().trim();
  if (
    email.includes("example") ||
    email.includes("test") ||
    email.includes("dummy") ||
    email.endsWith(".png") ||
    email.endsWith(".jpg") ||
    email.endsWith(".gif")
  )
    return null;
  return email;
}

// ==================== CLEAN PHONE ====================
function cleanPhone(phone) {
  const digits = phone.replace(/\D/g, "");

  // Toll free
  if (digits.startsWith("1800") && digits.length >= 10 && digits.length <= 13) {
    return digits;
  }

  // Landline (starts with 0)
  if (digits.startsWith("0")) {
    if (digits.length >= 10 && digits.length <= 12) {
      return digits;
    }
  }

  // Landline via +91 prefix
  if (digits.startsWith("91") && digits.length >= 11 && digits.length <= 13) {
    const withoutPrefix = digits.slice(2);
    if (!/^[6-9]/.test(withoutPrefix)) {
      return "0" + withoutPrefix;
    }
  }

  // Mobile 10 digits
  if (digits.length === 10) {
    if (/[6-9]/.test(digits[0])) {
      return "+91" + digits;
    }
  }

  // Mobile 12 digits (91 + 10)
  if (digits.length === 12 && digits.startsWith("91")) {
    return "+" + digits;
  }

  // Extract last 10 digit mobile
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    if (/[6-9]/.test(last10[0])) {
      return "+91" + last10;
    }
  }

  return null;
}

// ==================== EXTRACT CONTACTS ====================
function extractContacts(html) {
  const $ = cheerio.load(html);

  const emailsSet = new Set();
  const phonesSet = new Set();

  // mailto links
  $("a[href^='mailto:']").each((_, el) => {
    const email = $(el).attr("href").replace("mailto:", "").split("?")[0].trim();
    const clean = cleanEmail(email);
    if (clean) emailsSet.add(clean);
  });

  // tel links
  $("a[href^='tel:'], a[href^='tell:']").each((_, el) => {
    const phone = $(el).attr("href").replace(/^tel+:/, "").trim();
    const clean = cleanPhone(phone);
    if (clean) phonesSet.add(clean);
  });

  // Phone icon selectors
  const phoneIconSelectors = [
    "i.fa-phone", "i.fa-phone-square", "i.fa-phone-alt",
    "i.fa-mobile", "i.fa-mobile-alt",
    "i.bi-telephone", "i.bi-telephone-fill", "i.bi-phone",
    "[class*='fa-phone']", "[class*='bi-telephone']", "[class*='bi-phone']",
    "[class*='icon-phone']", "[class*='icon-call']",
    "[class*='phone-icon']", "[class*='call-icon']",
  ];

  $(phoneIconSelectors.join(", ")).each((_, el) => {
    const targets = [
      $(el).parent(),
      $(el).parent().parent(),
      $(el).next(),
      $(el).parent().next(),
    ];
    targets.forEach((target) => {
      if (!target.length) return;
      const txt = target.text().trim();
      if (!txt) return;
      const matches = txt.match(PHONE_REGEX) || [];
      matches.forEach((p) => {
        const clean = cleanPhone(p);
        if (clean) phonesSet.add(clean);
      });
    });
  });

  // Email icon selectors
  const emailIconSelectors = [
    ".email", ".mail", ".e-mail", ".email-id", ".contact-email",
    "i.fa-envelope", "i.fa-envelope-o", "i.fa-at",
    "i.bi-envelope", "i.bi-envelope-fill",
    "[class*='fa-envelope']", "[class*='bi-envelope']",
    "[class*='icon-mail']", "[class*='icon-email']",
  ];

  $(emailIconSelectors.join(", ")).each((_, el) => {
    const targets = [
      $(el).parent(),
      $(el).parent().parent(),
      $(el).next(),
      $(el).parent().next(),
    ];
    targets.forEach((target) => {
      if (!target.length) return;
      const txt = target.text().trim();
      if (!txt) return;
      const matches = txt.match(EMAIL_REGEX) || [];
      matches.forEach((e) => {
        const clean = cleanEmail(e);
        if (clean) emailsSet.add(clean);
      });
    });
  });

  // Class-based scanning
  $("li, span, div, p").each((_, el) => {
    const classAttr = ($(el).attr("class") || "").toLowerCase();

    if (
      classAttr.includes("phone") ||
      classAttr.includes("call") ||
      classAttr.includes("mobile") ||
      classAttr.includes("tel")
    ) {
      const txt = $(el).text().trim();
      (txt.match(PHONE_REGEX) || []).forEach((p) => {
        const clean = cleanPhone(p);
        if (clean) phonesSet.add(clean);
      });
    }

    if (
      classAttr.includes("mail") ||
      classAttr.includes("email") ||
      classAttr.includes("envelope")
    ) {
      const txt = $(el).text().trim();
      (txt.match(EMAIL_REGEX) || []).forEach((e) => {
        const clean = cleanEmail(e);
        if (clean) emailsSet.add(clean);
      });
    }
  });

  // Full body + header + footer scan
  const text = `${$("header").text()} ${$("footer").text()} ${$("body").text()}`;

  (text.match(EMAIL_REGEX) || []).forEach((e) => {
    const clean = cleanEmail(e);
    if (clean) emailsSet.add(clean);
  });

  (text.match(PHONE_REGEX) || []).forEach((p) => {
    const clean = cleanPhone(p);
    if (clean) phonesSet.add(clean);
  });

  // Meta tags
  $("meta").each((_, el) => {
    const content = $(el).attr("content") || "";
    (content.match(EMAIL_REGEX) || []).forEach((e) => {
      const clean = cleanEmail(e);
      if (clean) emailsSet.add(clean);
    });
    (content.match(PHONE_REGEX) || []).forEach((p) => {
      const clean = cleanPhone(p);
      if (clean) phonesSet.add(clean);
    });
  });

  return {
    emails: Array.from(emailsSet),
    phones: Array.from(phonesSet),
  };
}

// ==================== FIND CONTACT PAGE ====================
function findContactPage(html, baseUrl) {
  const $ = cheerio.load(html);
  let contactUrl = null;

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const text = $(el).text().toLowerCase();
    const hrefLower = href.toLowerCase();

    if (text.includes("contact") || hrefLower.includes("contact")) {
      if (
        !hrefLower.startsWith("http") &&
        !hrefLower.startsWith("mailto:") &&
        !hrefLower.startsWith("tel:") &&
        !hrefLower.startsWith("javascript:")
      ) {
        try {
          contactUrl = new URL(href, baseUrl).href;
        } catch {}
      } else if (
        hrefLower.startsWith("http") &&
        hrefLower.includes(new URL(baseUrl).hostname)
      ) {
        contactUrl = href;
      }
    }
  });

  return contactUrl;
}

// ==================== MAIN SCRAPER ====================
async function scrapeWebsite(inputUrl) {
  try {
    const url = normalizeUrl(inputUrl);
    console.log(`[Scraper] Fetching: ${url}`);

    const html = await fetchHTML(url);
    const mainContacts = extractContacts(html);

    const allEmails = new Set(mainContacts.emails);
    const allPhones = new Set(mainContacts.phones);

    // Try contact page too
    const contactUrl = findContactPage(html, url);
    if (contactUrl && contactUrl !== url) {
      console.log(`[Scraper] Found contact page: ${contactUrl}`);
      try {
        const contactHtml = await fetchHTML(contactUrl);
        const subContacts = extractContacts(contactHtml);
        subContacts.emails.forEach((e) => allEmails.add(e));
        subContacts.phones.forEach((p) => allPhones.add(p));
      } catch (err) {
        console.log(`[Scraper] Contact page failed: ${err.message}`);
      }
    }

    return {
      website: url,
      emails: Array.from(allEmails),
      phones: Array.from(allPhones),
      error: null,
    };
  } catch (err) {
    return {
      website: inputUrl,
      emails: [],
      phones: [],
      error: err.message,
    };
  }
}

module.exports = {
  scrapeWebsite,
};
