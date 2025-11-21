const path = require('path');
const { google } = require('googleapis');
const {
  getAllReferrals,
  updateMessageProgress
} = require('./database');

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A:D';
const TEMPLATE_REFRESH_MS = Number(process.env.MESSAGE_TEMPLATE_REFRESH_MINUTES || 10) * 60 * 1000;
const WORKER_INTERVAL_MS = Number(process.env.MESSAGE_WORKER_INTERVAL_SECONDS || 60) * 1000;
const TEMPLATE_ERROR_COOLDOWN_MS = Number(process.env.MESSAGE_TEMPLATE_ERROR_COOLDOWN_SECONDS || 60) * 1000;

let templatesCache = [];
let templatesFetchedAt = 0;
let nextAllowedFetchAfterError = 0;
let sendMessageFn = null;
let workerHandle = null;

function parseDelayToHours(text) {
  if (!text) return 0;
  const normalized = String(text).replace(',', '.').trim().toLowerCase();
  const numeric = parseFloat(normalized.replace(/[^\d.-]/g, ''));
  if (isNaN(numeric)) return 0;
  if (normalized.includes('m') && !normalized.includes('h')) {
    return numeric / 60;
  }
  return numeric;
}

function extractHeaders(rows) {
  if (!rows.length) return { orderIdx: 0, delayIdx: 1, textIdx: 3 };
  const headers = rows[0].map((h) => (h || '').toString().trim().toLowerCase());
  const findIndex = (matcher, fallback) => {
    const idx = headers.findIndex((header) => matcher.test(header));
    return idx === -1 ? fallback : idx;
  };
  const orderIdx = findIndex(/số.*gửi|order|step/, 0);
  const delayIdx = findIndex(/thời gian|delay|hour/, 1);
  const textIdx = findIndex(/nội dung|message|content/, 3);
  return { orderIdx, delayIdx, textIdx };
}

async function loadTemplates(force = false) {
  const now = Date.now();
  if (!force && now < nextAllowedFetchAfterError) {
    return templatesCache;
  }
  const shouldRefresh = force || now - templatesFetchedAt > TEMPLATE_REFRESH_MS || !templatesCache.length;
  if (!shouldRefresh) return templatesCache;
  if (!SHEET_ID) {
    console.warn('[MessageScheduler] GOOGLE_SHEET_ID not configured; skip loading templates.');
    templatesCache = [];
    templatesFetchedAt = now;
    return templatesCache;
  }
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'bot.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE
    });
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      templatesCache = [];
      templatesFetchedAt = Date.now();
      return templatesCache;
    }
    const { orderIdx, delayIdx, textIdx } = extractHeaders(rows);
    templatesCache = rows.slice(1)
      .map((row) => ({
        order: Number(row[orderIdx]) || 0,
        delayHours: parseDelayToHours(row[delayIdx]),
        message: (row[textIdx] || '').toString().trim()
      }))
      .filter((tpl) => tpl.message.length > 0)
      .map((tpl, idx) => ({
        ...tpl,
        index: idx,
        delayMs: tpl.delayHours * 60 * 60 * 1000
      }));
    templatesFetchedAt = Date.now();
    nextAllowedFetchAfterError = 0;
    console.log(`[MessageScheduler] Loaded ${templatesCache.length} message templates from sheet.`);
    return templatesCache;
  } catch (error) {
    console.error('[MessageScheduler] Failed to load templates:', error);
    nextAllowedFetchAfterError = Date.now() + TEMPLATE_ERROR_COOLDOWN_MS;
    return templatesCache;
  }
}

function appendPsidToLink(link, psid) {
  if (!link) return link;
  if (!psid) return link;
  if (link.includes('psid=')) {
    return link.replace(/psid=[^&]*/i, `psid=${encodeURIComponent(psid)}`);
  }
  const separator = link.includes('?') ? '&' : '?';
  return `${link}${separator}psid=${encodeURIComponent(psid)}`;
}

function formatMessage(templateMessage, referral) {
  const baseLink = referral.referral_link || '';
  const finalLink = appendPsidToLink(baseLink, referral.PSID);
  return templateMessage
    .replace(/\[referral_link\]/gi, finalLink)
    .replace(/\{your_referral_link\}/gi, finalLink);
}

async function sendTemplateMessage(referral, template) {
  if (!sendMessageFn) {
    console.warn('[MessageScheduler] sendMessageFn not configured.');
    return false;
  }
  const messageText = formatMessage(template.message, referral);
  if (!messageText.trim()) {
    return false;
  }
  await sendMessageFn(referral.PSID, { text: messageText });
  await updateMessageProgress(referral.PSID, template.index + 1);
  return true;
}

function computeReferenceTime(referral) {
  if (referral.last_message_sent_at) {
    return new Date(referral.last_message_sent_at);
  }
  return new Date(referral.created_at);
}

async function processReferral(referral) {
  const templates = await loadTemplates();
  if (!templates.length) return false;
  const step = Number(referral.message_step) || 0;
  if (step >= templates.length) return false;
  const template = templates[step];
  const referenceTime = computeReferenceTime(referral);
  const dueTime = referenceTime.getTime() + template.delayMs;
  if (Date.now() < dueTime) return false;
  await sendTemplateMessage(referral, template);
  return true;
}

async function processPendingReferrals() {
  const templates = await loadTemplates();
  if (!templates.length) return;
  const referrals = await getAllReferrals();
  for (const referral of referrals) {
    try {
      await processReferral(referral);
    } catch (error) {
      console.error(`[MessageScheduler] Failed to process referral PSID ${referral.PSID}:`, error);
    }
  }
}

function startScheduler(sendFn) {
  sendMessageFn = sendFn;
  if (!SHEET_ID) {
    console.warn('[MessageScheduler] GOOGLE_SHEET_ID missing. Scheduler disabled.');
    return;
  }
  loadTemplates(true).catch((err) => console.error('Initial template load failed:', err));
  if (workerHandle) {
    clearInterval(workerHandle);
  }
  workerHandle = setInterval(() => {
    processPendingReferrals().catch((err) => console.error('Message worker error:', err));
  }, WORKER_INTERVAL_MS);
  console.log(`[MessageScheduler] Worker started (interval: ${WORKER_INTERVAL_MS / 1000}s).`);
}

async function handleImmediateReferral(referral) {
  try {
    await loadTemplates();
    return await processReferral(referral);
  } catch (error) {
    console.error('[MessageScheduler] handleImmediateReferral error:', error);
    return false;
  }
}

module.exports = {
  startFollowupScheduler: (sendFn) => startScheduler(sendFn),
  handleImmediateReferral,
  loadTemplates
};

