/* ================================================================ Applications (added October 2026)
   The public site's forms post here as JSON with type "application":
     path "camp"  a full Join the camp application, one row in the "Applications" tab
     path "list"  someone leaving their name and email to hear more, one row in the "Email list" tab
   The nominations above are untouched: anything without type "application" still goes to submitNominations. */

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
    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL, 'Mahala: a camp application from ' + (clean_(p.name) || clean_(p.email)),
        (clean_(p.name) || 'Someone') + ' has applied to join the camp. See the Applications tab.');
    }
    return { ok: true, tab: APP_SHEET };
  } finally {
    lock.releaseLock();
  }
}

/** The tab, made with its header row the first time it is used. */
function sheetFor_(name, headers, wide, statuses) {
  var ss = SpreadsheetApp.getActive();
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

/** Run once from the editor to make both tabs with their headers. */
function setupApplications() {
  sheetFor_(APP_SHEET, APP_HEADERS, ['Skills', 'Agreements signed', 'Anything else', 'Lead notes'], APP_STATUS);
  sheetFor_(LIST_SHEET, LIST_HEADERS, ['Notes'], null);
}
