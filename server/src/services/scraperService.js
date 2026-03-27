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
    // Generic class names
    ".phone", ".telephone", ".mobile", ".call", ".contact-phone",
    ".phone-number", ".tel-number", ".mobile-number", ".contact-number",
    ".phone-link", ".call-link", ".phone-info", ".phone-text",

    // Font Awesome 4.x
    "i.fa-phone", "i.fa-phone-square", "i.fa-mobile", "i.fa-mobile-phone",

    // Font Awesome 5.x / 6.x
    "i.fas.fa-phone", "i.fas.fa-phone-alt", "i.fas.fa-phone-square",
    "i.fas.fa-phone-square-alt", "i.fas.fa-phone-volume",
    "i.fas.fa-mobile", "i.fas.fa-mobile-alt",
    "i.far.fa-phone", "i.fal.fa-phone",
    "svg.fa-phone", "svg.fa-mobile",

    // Bootstrap Icons
    "i.bi-telephone", "i.bi-telephone-fill", "i.bi-telephone-forward",
    "i.bi-telephone-inbound", "i.bi-telephone-outbound",
    "i.bi-phone", "i.bi-phone-fill", "i.bi-phone-vibrate",

    // Material Icons
    ".material-icons[data-icon='phone']", ".material-icons[data-icon='call']",
    ".material-icons[data-icon='phone_android']",
    ".material-icons[data-icon='phone_iphone']",
    ".material-icons[data-icon='smartphone']",

    // Ionicons
    "ion-icon[name='call']", "ion-icon[name='call-outline']",
    "ion-icon[name='phone-portrait']", "ion-icon[name='phone-portrait-outline']",

    // Feather Icons
    "[data-feather='phone']", "[data-feather='phone-call']",
    "[data-feather='smartphone']", ".feather-phone",

    // Tabler Icons
    "i.ti-phone", "i.ti-phone-call", "i.ti-device-mobile",

    // Remix Icons
    "i.ri-phone-line", "i.ri-phone-fill",
    "i.ri-smartphone-line", "i.ri-smartphone-fill",
    "i.ri-cellphone-line", "i.ri-cellphone-fill",

    // Lineicons / Themify / Simple Line
    "i.lni-phone", "i.lni-mobile", "i.icon-phone", "i.icon-call-end",

    // Wildcard
    "[class*='fa-phone']", "[class*='bi-telephone']", "[class*='bi-phone']",
    "[class*='icon-phone']", "[class*='icon-call']",
    "[class*='phone-icon']", "[class*='call-icon']",
    "[class*='ico-phone']", "[class*='ico-call']",

    // SVG / img
    "img[alt*='phone' i]", "img[alt*='call' i]", "img[src*='phone']",
    "svg[aria-label*='phone' i]", "svg[aria-label*='call' i]",

    // Aria / data
    "[aria-label*='phone' i]", "[aria-label*='call' i]",
    "[title*='phone' i]", "[title*='call' i]",
    "[data-icon*='phone']", "[data-icon*='call']",
    "[data-type='phone']", "[data-type='tel']",

    // tel links
    "a[href^='tel:']",
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
    // Generic class names
    ".email", ".mail", ".e-mail", ".email-id", ".contact-email",
    ".email-address", ".mail-address", ".email-link", ".mail-link",
    ".email-contact", ".contact-mail", ".user-email", ".member-email",
    ".profile-email", ".team-email", ".business-email", ".work-email",
    ".email-info", ".info-email", ".email-text", ".email-label",
    ".email-wrapper", ".email-container", ".email-field", ".email-value",

    // Font Awesome 4.x
    "i.fa-envelope", "i.fa-envelope-o", "i.fa-at",
    "i.fa-inbox", "i.fa-send", "i.fa-paper-plane", "i.fa-paper-plane-o",

    // Font Awesome 5.x / 6.x
    "i.fas.fa-envelope", "i.far.fa-envelope", "i.fal.fa-envelope",
    "i.fad.fa-envelope", "i.fab.fa-envelope",
    "i.fas.fa-envelope-open", "i.far.fa-envelope-open",
    "i.fas.fa-envelope-square", "i.fas.fa-at",
    "i.fas.fa-paper-plane", "i.far.fa-paper-plane",
    "i.fas.fa-inbox", "i.fas.fa-mailbox",
    "svg.fa-envelope", "svg.fa-at",

    // Bootstrap Icons
    "i.bi-envelope", "i.bi-envelope-fill", "i.bi-envelope-open",
    "i.bi-envelope-open-fill", "i.bi-envelope-check", "i.bi-envelope-check-fill",
    "i.bi-envelope-dash", "i.bi-envelope-dash-fill",
    "i.bi-envelope-exclamation", "i.bi-envelope-x", "i.bi-envelope-x-fill",
    "i.bi-at", "i.bi-mailbox", "i.bi-mailbox2",
    "i.bi-send", "i.bi-send-fill",

    // Material Icons
    ".material-icons[data-icon='email']", ".material-icons[data-icon='mail']",
    ".material-icons[data-icon='mail_outline']",
    ".material-icons[data-icon='contact_mail']",
    ".material-icons[data-icon='forward_to_inbox']",
    "span.material-symbols-outlined",

    // Ionicons
    "ion-icon[name='mail']", "ion-icon[name='mail-outline']",
    "ion-icon[name='mail-open']", "ion-icon[name='mail-open-outline']",
    "ion-icon[name='send']", "ion-icon[name='at']",

    // Feather Icons
    "[data-feather='mail']", "[data-feather='send']", "[data-feather='at-sign']",
    ".feather-mail", ".feather-send",

    // Tabler Icons
    "i.ti-mail", "i.ti-mailbox", "i.ti-send", "i.ti-at",

    // Remix Icons
    "i.ri-mail-line", "i.ri-mail-fill",
    "i.ri-mail-open-line", "i.ri-mail-open-fill",
    "i.ri-mail-send-line", "i.ri-mail-send-fill",
    "i.ri-at-line", "i.ri-at-fill",
    "i.ri-send-plane-line", "i.ri-send-plane-fill",
    "i.ri-inbox-line", "i.ri-inbox-fill",

    // Lineicons / Themify / Simple Line
    "i.lni-envelope", "i.lni-email", "i.lni-inbox",
    "i.ti-email", "i.icon-envelope", "i.icon-envelope-open",

    // Wildcard
    "[class*='fa-envelope']", "[class*='bi-envelope']",
    "[class*='icon-mail']", "[class*='icon-email']",
    "[class*='email-icon']", "[class*='mail-icon']",
    "[class*='ico-mail']", "[class*='ico-email']",
    "[class*='envelope']",

    // SVG / img
    "img[alt*='email' i]", "img[alt*='mail' i]",
    "img[src*='email']", "img[src*='mail']", "img[src*='envelope']",
    "svg[aria-label*='email' i]", "svg[aria-label*='mail' i]",

    // Aria / data
    "[aria-label*='email' i]", "[aria-label*='mail' i]",
    "[title*='email' i]", "[title*='mail' i]",
    "[data-icon*='email']", "[data-icon*='mail']", "[data-icon*='envelope']",
    "[data-type='email']",

    // mailto fallback
    "a[href^='mailto:']",
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
