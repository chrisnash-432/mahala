/**
 * Mahala applications backend (standalone, owned by Chris).
 * The public site's Join the tribe form, its Join the camp form (for invited people) and its email sign-ups post here;
 * rows go into the "Mahala - Temple Builder Nominations & Applications" sheet, in its Tribe, Applications and Email list tabs.
 * Nominations are not touched: they keep their own backend inside the sheet.
 */
var SHEET_ID = '1xbxEWSTKn0ULESNiuAWGSng4OMkqXHOx8yt8crQq6Q0';
// who hears about each new camp application (comma separated)
var NOTIFY_EMAIL = 'bioharmonicpermaculture@gmail.com, wearemahala@gmail.com, hi@meredithdetko.com';
// who hears about each new tribe member: the camp inbox only (the stewards read the Tribe tab weekly)
var TRIBE_NOTIFY = 'wearemahala@gmail.com';

function doGet() {
  return ContentService.createTextOutput('Mahala applications backend is running.');
}

function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { p = {}; }
  var out = (p && p.type === 'tribe') ? submitTribe_(p) : (p && p.type === 'application') ? submitApplication_(p) : { ok: false };
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v) {
  v = (v === undefined || v === null) ? '' : String(v).trim();
  return /^[=+\-@]/.test(v) ? "'" + v : v;   // nothing that looks like a formula runs in the sheet
}

/* ================================================================ Applications
   The public site's forms post here as JSON with type "application":
     path "camp"  a full Join the camp application, one row in the "Applications" tab
     path "list"  someone leaving their name and email to hear more, one row in the "Email list" tab */

var APP_SHEET = 'Applications';
var APP_HEADERS = [
  'Timestamp', 'Application ID',
  'Name or playa name', 'Email', 'WhatsApp', 'Lives in', 'Travelling from',
  'Skills', 'Crew',
  'Currency', 'Place (working figure)', 'Big coil', 'Extra gift', 'Pay in', 'Total (working)', 'Coupon code',
  'Agreements signed', 'Welcome call: best times', 'Anything else',
  'Nominated by', 'From page',
  'Status', 'Lead notes'
];
var APP_STATUS = ['New', 'Call booked', 'Payment link sent', 'Paid', 'Hold', 'Not this year'];
var LIST_SHEET = 'Email list';
var LIST_HEADERS = ['Timestamp', 'Name', 'Email', 'Interested in', 'From page', 'Notes'];

function submitApplication_(p) {
  if (!p || p.hp) return { ok: false };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var now = new Date();
    if (p.path === 'list') {
      sheetFor_(LIST_SHEET, LIST_HEADERS, ['Notes'], null)
        .appendRow([now, clean_(p.name), clean_(p.email).toLowerCase(), clean_(p.interest), clean_(p.page), '']);
      return { ok: true, tab: LIST_SHEET };
    }
    var join = function (a) { return (a || []).map(clean_).join(', '); };
    sheetFor_(APP_SHEET, APP_HEADERS, ['Skills', 'Agreements signed', 'Anything else', 'Lead notes'], APP_STATUS).appendRow([
      now, clean_(p.id),
      clean_(p.name), clean_(p.email).toLowerCase(), clean_(p.whatsapp), clean_(p.livesIn), clean_(p.travelFrom),
      join(p.skills), clean_(p.crew),
      clean_(p.currency), clean_(p.place), p.bigCoil ? 'Yes' : 'No', clean_(p.gift), clean_(p.payIn), clean_(p.total), clean_(p.coupon),
      join(p.agreements), join(p.callTimes), clean_(p.message),
      clean_(p.nominatedBy), clean_(p.page),
      'New', ''
    ]);
    if (NOTIFY_EMAIL) notifyApplication_(p);
    return { ok: true, tab: APP_SHEET };
  } finally {
    lock.releaseLock();
  }
}

/** A short email to the camp leads for each application, with the answers and a link to the sheet. */
function notifyApplication_(p) {
  var who = clean_(p.name) || clean_(p.email) || 'Someone';
  var line = function (k, v) { return v ? k + ': ' + v + '\n' : ''; };
  var list = function (a) { return (a || []).join(', '); };
  var body = who + ' has applied to join Mahala camp.\n\n' +
    line('Name', clean_(p.name)) + line('Email', clean_(p.email)) + line('WhatsApp', clean_(p.whatsapp)) +
    line('Lives in', clean_(p.livesIn)) + line('Travelling from', clean_(p.travelFrom)) +
    line('Can bring', list(p.skills)) + line('Crew', clean_(p.crew)) +
    line('Total (working)', clean_(p.total) + (p.payIn ? ', ' + clean_(p.payIn) : '')) +
    line('Big coil', p.bigCoil ? 'Yes' : '') + line('Extra gift', p.gift && p.gift !== 'None' ? clean_(p.gift) : '') + line('Coupon', clean_(p.coupon)) +
    line('Welcome call, best times', list(p.callTimes)) + line('Anything else', clean_(p.message)) +
    '\nThe full row is in the Applications tab:\nhttps://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit\n';
  try {
    var mail = { to: NOTIFY_EMAIL, subject: 'Mahala camp application: ' + who, body: body, name: 'Mahala website' };
    if (/^[^\s@]+@[^\s@]+$/.test(clean_(p.email))) mail.replyTo = clean_(p.email);   // reply goes straight to the applicant
    MailApp.sendEmail(mail);
  } catch (err) { console.error('notify failed: ' + err); }   // a failed email never loses the application
}

/* ================================================================ The tribe
   Join the tribe posts JSON with type "tribe": one row per new member in the "Tribe" tab. Until member accounts open,
   this tab is the tribe's front door; each row later becomes an invitation to claim that account. Answers to "What do
   you want more of in your life this year?" are for the stewards only: never copy that column anywhere members see. */

var TRIBE_SHEET = 'Tribe';
var TRIBE_HEADERS = [
  'Timestamp', 'Member ID',
  'Name they go by', 'Email', 'Town or city', 'Country', 'How they found Mahala', 'Brought by', '18 or over',
  'What draws them', 'What matters most', 'What they bring', 'Something else they bring', 'What lights them up',
  'Creating, or longing to create', 'More of in their life (stewards only)', 'The world they dream of',
  'Mahala news by email', 'WhatsApp Community', 'WhatsApp', 'Share answers with members', 'Would love to come in 2027',
  'Letter ref', 'From page',
  'Status', 'Lead notes'
];
var TRIBE_STATUS = ['New', 'Welcomed', 'Invited', 'Not this year'];

function submitTribe_(p) {
  if (!p || p.hp || !p.adult) return { ok: false };
  var email = clean_(p.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var join = function (a) { return (a || []).map(clean_).join(', '); };
    var yes = function (b) { return b ? 'Yes' : 'No'; };
    sheetFor_(TRIBE_SHEET, TRIBE_HEADERS, ['What draws them', 'Creating, or longing to create', 'More of in their life (stewards only)', 'The world they dream of', 'Lead notes'], TRIBE_STATUS).appendRow([
      new Date(), clean_(p.id),
      clean_(p.name), email, clean_(p.town), clean_(p.country), clean_(p.found), clean_(p.broughtBy), 'Yes',
      clean_(p.draws), join(p.values), join(p.skills), clean_(p.other), join(p.passions),
      clean_(p.creating), clean_(p.more), clean_(p.world),
      yes(p.news), yes(p.whatsappCommunity), clean_(p.whatsapp), yes(p.share), yes(p.loveToCome),
      clean_(p.ref), clean_(p.page),
      'New', ''
    ]);
    if (TRIBE_NOTIFY) notifyTribe_(p, email);
    return { ok: true, tab: TRIBE_SHEET };
  } finally {
    lock.releaseLock();
  }
}

/** A short note to the camp inbox for each new tribe member: who, where from, and what draws them. No private answers. */
function notifyTribe_(p, email) {
  var who = clean_(p.name) || email || 'Someone';
  var body = who + ' has joined the tribe' + (p.loveToCome ? ', and would love to come to the camp in 2027' : '') + '.\n\n' +
    'Lives in: ' + [clean_(p.town), clean_(p.country)].filter(String).join(', ') + '\n' +
    'Found Mahala: ' + clean_(p.found) + (p.broughtBy ? ' (' + clean_(p.broughtBy) + ')' : '') + '\n\n' +
    'What draws them:\n' + clean_(p.draws) + '\n' +
    '\nThe full row is in the Tribe tab:\nhttps://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit\n';
  try {
    MailApp.sendEmail({ to: TRIBE_NOTIFY, subject: 'New in the tribe: ' + who, body: body, name: 'Mahala website' });
  } catch (err) { console.error('notify failed: ' + err); }   // a failed email never loses the row
}

/** The tab, made with its header row the first time it is used. */
function sheetFor_(name, headers, wide, statuses) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#3b2f26').setFontColor('#f3e6cf');
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(3);
    (wide || []).forEach(function (h) { sheet.setColumnWidth(headers.indexOf(h) + 1, 300); });
    sheet.getRange(2, 1, 1000, headers.length).setWrap(true).setVerticalAlignment('top');
    if (statuses) {
      var rule = SpreadsheetApp.newDataValidation().requireValueInList(statuses, true).build();
      sheet.getRange(2, headers.indexOf('Status') + 1, 1000, 1).setDataValidation(rule);
    }
  }
  return sheet;
}

/** Run once from the editor to make the tabs with their headers. */
function setupApplications() {
  sheetFor_(TRIBE_SHEET, TRIBE_HEADERS, ['What draws them', 'Creating, or longing to create', 'More of in their life (stewards only)', 'The world they dream of', 'Lead notes'], TRIBE_STATUS);
  sheetFor_(APP_SHEET, APP_HEADERS, ['Skills', 'Agreements signed', 'Anything else', 'Lead notes'], APP_STATUS);
  sheetFor_(LIST_SHEET, LIST_HEADERS, ['Notes'], null);
}
