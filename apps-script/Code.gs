// ============================================
// CONFIG — single source of truth for capacity, scoring & admin auth
// ============================================
const CONFIG = {
  SHEET_NAME_CANDIDATES: ['Form Responses 1', 'Form responses 1'],

  ROOM_TYPES: {
    'Single Seated Room':  { key: 'single', seatsPerRoom: 1 },
    'Triple Seated Room':  { key: 'triple', seatsPerRoom: 3 },
    'Four-Seated Room':    { key: 'four',   seatsPerRoom: 4 }
  },

  INVENTORY: {
    Male:   { single: 38, triple: 54, four: 16, block: 'B' },
    Female: { single: 22, triple: 30, four: 16, block: 'G' }
  },

  FALLBACK_ORDER: ['triple', 'four', 'single'],

  SCORE: {
    distance: { 'More than 1000': 50, '500 km': 30, '200 km': 15 },
    medical:  { 'Wheelchair': 200, 'Medical': 150, 'Allergy': 100, 'Asthma': 100 },
    // Placeholder reservation-category weights — replace with your university's actual policy.
    category: { 'SC': 40, 'ST': 40, 'EWS': 25, 'OBC-NCL': 25 }
  },

  UNIVERSITY_NAME: 'Guru Gobind Singh Indraprastha University, East Delhi Campus',
  FINAL_ALLOCATION_DATE: 'August 30, 2026',

  // Students whose Distance field exactly matches this are local/day-scholars and
  // are not eligible for a hostel seat UNLESS they have a genuine special
  // accommodation need (see hasGenuineSpecialNeed_). This value must match your
  // Google Form's dropdown option text exactly.
  DAY_SCHOLAR_DISTANCE_LABEL: 'Less than 50 km (Day Scholar)'
};

// ============================================
// RUNTIME SETTINGS — admin-controlled availability & result release
// ============================================
const PROP_AVAILABLE_INVENTORY = 'AVAILABLE_INVENTORY';
const PROP_RESULTS_PUBLISHED = 'RESULTS_PUBLISHED';
const PROP_ROOM_TYPE_MAP = 'ROOM_TYPE_MAP';
const PROP_ALLOCATION_PREPARED = 'ALLOCATION_PREPARED';

function getTotalInventory_() {
  const out = {};
  for (const gender of ['Male', 'Female']) {
    out[gender] = {
      single: CONFIG.INVENTORY[gender].single,
      triple: CONFIG.INVENTORY[gender].triple,
      four: CONFIG.INVENTORY[gender].four
    };
  }
  return out;
}

function getAvailableInventory_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PROP_AVAILABLE_INVENTORY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { throw new Error('Available inventory configuration is invalid.'); }
}

function validateAvailableInventory_(inventory) {
  const total = getTotalInventory_();
  for (const gender of ['Male', 'Female']) {
    if (!inventory || !inventory[gender]) throw new Error('Missing inventory for ' + gender + '.');
    for (const typeKey of ['single', 'triple', 'four']) {
      const value = Number(inventory[gender][typeKey]);
      if (!Number.isInteger(value) || value < 0 || value > total[gender][typeKey]) {
        throw new Error(gender + ' ' + typeKey + ' available rooms must be an integer between 0 and ' + total[gender][typeKey] + '.');
      }
    }
  }
}

function isResultsPublished_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_RESULTS_PUBLISHED) === 'true';
}

function setResultsPublished_(published) {
  PropertiesService.getScriptProperties().setProperty(PROP_RESULTS_PUBLISHED, published ? 'true' : 'false');
}

// ============================================
// SHEET / HEADER HELPERS
// ============================================
function getResponseSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const name of CONFIG.SHEET_NAME_CANDIDATES) {
    const sh = ss.getSheetByName(name);
    if (sh) return sh;
  }
  const match = ss.getSheets().find(s => /form.*response/i.test(s.getName()));
  if (match) return match;
  throw new Error('Could not find the Form Responses sheet.');
}

function trimmedHeaders_(headerRow) {
  return headerRow.map(h => String(h || '').trim());
}

function col_(headers, name) {
  const idx = headers.indexOf(name.trim());
  if (idx === -1) throw new Error('Column not found: "' + name + '"');
  return idx;
}

function scoreDistance_(distance) {
  distance = distance || '';
  for (const key in CONFIG.SCORE.distance) if (distance.includes(key)) return CONFIG.SCORE.distance[key];
  return 0;
}
function scoreMedical_(medical) {
  medical = medical || '';
  for (const key in CONFIG.SCORE.medical) if (medical.includes(key)) return CONFIG.SCORE.medical[key];
  return 0;
}
function scoreCategory_(category) {
  category = (category || '').trim();
  return CONFIG.SCORE.category[category] || 0;
}
function roomTypeKey_(preferredRoomType) {
  const entry = CONFIG.ROOM_TYPES[(preferredRoomType || '').trim()];
  return entry ? entry.key : 'triple';
}
function parseRoommateRolls_(raw) {
  if (!raw) return [];
  return String(raw).split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
}

// A day-scholar is still eligible if they have a documented special need —
// e.g. a mobility disability where living near campus matters more than
// living far from it. Treat anything meaningfully filled in as "genuine";
// tune this list if your form's "None" option is worded differently.
function hasGenuineSpecialNeed_(medical) {
  const val = String(medical || '').trim().toLowerCase();
  return val.length > 0 && !['none', 'n/a', 'na', 'no', 'nil'].includes(val);
}

// Automated eligibility check (PS explicitly asks for this step).
// Returns { eligible, reason } — reason is written to the sheet and used in the email.
function isEligible_(distance, medical) {
  const dist = String(distance || '').trim();
  if (dist === CONFIG.DAY_SCHOLAR_DISTANCE_LABEL) {
    if (hasGenuineSpecialNeed_(medical)) {
      return { eligible: true, reason: 'Day scholar, but flagged for special accommodation — kept eligible for manual review' };
    }
    return { eligible: false, reason: 'Day scholar (residence within 50km) — hostel accommodation not required per policy' };
  }
  return { eligible: true, reason: '' };
}

// Legacy room IDs (B-S001 / G-T014 / B-F003) remain readable.
// New allocations use neutral synthetic IDs such as B-001 / G-014 because the
// university has not supplied physical room numbers. These IDs are allocation
// identifiers, not claims about the hostel's real-world numbering.
function parseRoomTypeFromRoomNumber_(roomNumber) {
  const value = String(roomNumber || '').trim();
  const legacy = /^[A-Za-z]-([STF])/.exec(value);
  if (legacy) return { S: 'single', T: 'triple', F: 'four' }[legacy[1]] || null;
  return null;
}

function getRoomTypeMap_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PROP_ROOM_TYPE_MAP);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { throw new Error('Room ID configuration is invalid.'); }
}

function saveRoomTypeMap_(map) {
  PropertiesService.getScriptProperties().setProperty(PROP_ROOM_TYPE_MAP, JSON.stringify(map));
}

function buildRoomPools_() {
  const available = getAvailableInventory_();
  if (!available) {
    throw new Error('Available room inventory has not been configured. Open the admin dashboard, enter the currently available room counts, and save them before running allocation.');
  }
  validateAvailableInventory_(available);

  const storedMap = getRoomTypeMap_();
  const pools = {};
  for (const gender of ['Male', 'Female']) {
    const block = CONFIG.INVENTORY[gender].block;
    pools[gender] = { single: [], triple: [], four: [] };
    if (!storedMap[gender]) storedMap[gender] = {};

    // Preserve existing B-001/G-001 style IDs and only add new IDs when the
    // admin increases the available room count for a type.
    for (const typeKey of ['single', 'triple', 'four']) {
      const desired = available[gender][typeKey];
      const existingIds = Object.keys(storedMap[gender]).filter(id => storedMap[gender][id] === typeKey);
      let nextNumber = 1;
      while (existingIds.length < desired) {
        const id = block + '-' + String(nextNumber++).padStart(3, '0');
        if (!storedMap[gender][id]) {
          storedMap[gender][id] = typeKey;
          existingIds.push(id);
        }
      }
      const idsForType = Object.keys(storedMap[gender]).filter(id => storedMap[gender][id] === typeKey).slice(0, desired);
      const capacity = typeKey === 'single' ? 1 : (typeKey === 'triple' ? 3 : 4);
      for (const id of idsForType) pools[gender][typeKey].push({ roomNumber: id, capacity, occupants: [] });
    }
  }
  saveRoomTypeMap_(storedMap);
  return pools;
}
function addExistingRoomToPools_(pools, gender, roomNumber, typeKey) {
  if (!pools[gender] || !pools[gender][typeKey]) return null;
  let room = pools[gender][typeKey].find(r => r.roomNumber === roomNumber);
  if (room) return room;
  const capacity = typeKey === 'single' ? 1 : (typeKey === 'triple' ? 3 : 4);
  room = { roomNumber: String(roomNumber).trim(), capacity, occupants: [] };
  pools[gender][typeKey].push(room);
  return room;
}

function buildRoomTypeMap_(pools) {
  const map = {};
  for (const gender of ['Male', 'Female']) {
    for (const typeKey of ['single', 'triple', 'four']) {
      for (const room of pools[gender][typeKey]) map[room.roomNumber] = typeKey;
    }
  }
  return map;
}

// Finds both possible email columns once per sheet-read...
function getEmailColumns_(headers) {
  let uniEmailCol = -1, altEmailCol = -1;
  try { uniEmailCol = col_(headers, 'University Email ID'); } catch (e) { /* column missing entirely */ }
  try { altEmailCol = col_(headers, 'Email address'); } catch (e) { /* column missing entirely */ }
  return { uniEmailCol, altEmailCol };
}

// ...then resolves PER ROW: prefer University Email ID only if that specific
// student's cell is actually filled in, otherwise fall back to the personal
// Gmail address Google auto-captured on form submission. This matters for you
// right now specifically because 1st years don't have university emails yet —
// without the per-row fallback, real students with a blank University Email ID
// cell would silently get no email at all.
function resolveEmail_(row, emailCols) {
  if (emailCols.uniEmailCol !== -1 && row[emailCols.uniEmailCol] && String(row[emailCols.uniEmailCol]).trim()) {
    return row[emailCols.uniEmailCol];
  }
  if (emailCols.altEmailCol !== -1 && row[emailCols.altEmailCol] && String(row[emailCols.altEmailCol]).trim()) {
    return row[emailCols.altEmailCol];
  }
  return '';
}

// ============================================
// EMAIL NOTIFICATIONS
// ============================================
// Tracks the last status we emailed each roll number for, so we never spam
// the same email twice, but DO email again if their status changes
// (e.g. Waitlisted -> Allotted after a transfer/cancellation frees a seat).
function getNotifiedMap_() {
  const raw = PropertiesService.getScriptProperties().getProperty('NOTIFIED_MAP');
  return raw ? JSON.parse(raw) : {};
}
function saveNotifiedMap_(map) {
  PropertiesService.getScriptProperties().setProperty('NOTIFIED_MAP', JSON.stringify(map));
}

function sendStatusEmail_(toEmail, name, roll, status, roomNumber) {
  if (!toEmail) return false;
  let subject, body;
  if (status === 'Allotted') {
    subject = 'Hostel Allocation Confirmed – Room ' + roomNumber;
    body =
      'Dear ' + (name || 'Student') + ',\n\n' +
      'Congratulations! Your hostel application (Roll No: ' + roll + ') has been ALLOTTED.\n\n' +
      'Allocated Room Number: ' + roomNumber + '\n\n' +
      'Please report to the Chief Warden\'s office with your ID card and fee receipt to collect your room keys.\n\n' +
      'Regards,\n' + CONFIG.UNIVERSITY_NAME;
  } else if (status === 'Waitlisted') {
    subject = 'Hostel Application Update – Waitlisted';
    body =
      'Dear ' + (name || 'Student') + ',\n\n' +
      'Your hostel application (Roll No: ' + roll + ') is currently WAITLISTED.\n\n' +
      'The final hostel results will be published by the administration on ' + CONFIG.FINAL_ALLOCATION_DATE + '.\n\n' +
      'Regards,\n' + CONFIG.UNIVERSITY_NAME;
  } else if (status === 'Not Eligible') {
    subject = 'Hostel Application – Not Eligible';
    body =
      'Dear ' + (name || 'Student') + ',\n\n' +
      'Your hostel application (Roll No: ' + roll + ') has been marked NOT ELIGIBLE: your registered residence ' +
      'is within 50 km of the university, so hostel accommodation is not required under current policy.\n\n' +
      'If you believe this is incorrect (e.g. you have a documented special accommodation need), please contact ' +
      'the Chief Warden\'s office to request a manual review.\n\n' +
      'Regards,\n' + CONFIG.UNIVERSITY_NAME;
  } else if (status === 'Rejected') {
    subject = 'Hostel Application Update – Rejected';
    body =
      'Dear ' + (name || 'Student') + ',\n\n' +
      'Your hostel application (Roll No: ' + roll + ') has been marked REJECTED. Please contact the Chief Warden\'s office if you believe this requires a review.\n\n' +
      'Regards,\n' + CONFIG.UNIVERSITY_NAME;
  } else {
    return false;
  }

  // Safety valve for demo/rehearsal: if a TEST_EMAIL_REDIRECT script property is set,
  // every email is sent to that address instead of the real recipient (with the real
  // recipient noted in the subject), so you can safely run the full flow against
  // synthetic/dummy rows without emailing addresses you don't control.
  const testRedirect = PropertiesService.getScriptProperties().getProperty('TEST_EMAIL_REDIRECT');
  const actualRecipient = testRedirect || toEmail;
  if (testRedirect) subject = '[TEST → ' + toEmail + '] ' + subject;

  MailApp.sendEmail(actualRecipient, subject, body);
  return true;
}

function maybeNotify_(roll, status, toEmail, name, roomNumber) {
  const map = getNotifiedMap_();
  if (map[roll] === status) return false; // already emailed for this exact status
  const sent = sendStatusEmail_(toEmail, name, roll, status, roomNumber);
  if (sent) {
    map[roll] = status;
    saveNotifiedMap_(map);
  }
  return sent;
}

// ============================================
// AUDIT LOG
// ============================================
function getOrCreateAuditSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Audit Log');
  if (!sh) {
    sh = ss.insertSheet('Audit Log');
    sh.appendRow(['Timestamp', 'Actor', 'Action', 'Details']);
  }
  return sh;
}
function logAudit_(actor, action, details) {
  getOrCreateAuditSheet_().appendRow([new Date(), actor, action, details]);
}

// ============================================
// 1. ALLOCATION ALGORITHM (now also sends emails + logs audit entry)
// ============================================
function runHostelAllocationAlgorithm() {
  if (!getAvailableInventory_()) throw new Error('Set the available room inventory before running allocation.');
  const result = runAllocationCore_('Manual run (script editor)');
  SpreadsheetApp.getUi().alert(
    '✅ Allocation Complete!\n\n' +
    'Boys Allotted (this run): ' + result.allottedCount.Male + '  |  Waitlisted: ' + result.waitlistedCount.Male + '  |  Not Eligible: ' + result.ineligibleCount.Male + '\n' +
    'Girls Allotted (this run): ' + result.allottedCount.Female + '  |  Waitlisted: ' + result.waitlistedCount.Female + '  |  Not Eligible: ' + result.ineligibleCount.Female + '\n\n' +
    'Already-allotted students from previous runs were left untouched.\n' +
    'Results remain hidden until the administrator publishes them.'
  );
}

// Core logic factored out so both the manual menu run AND the admin dashboard
// "Run Allocation" button call the exact same code path.
function runAllocationCore_(actor) {
  const sheet = getResponseSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = trimmedHeaders_(data[0]);

  const rollCol   = col_(headers, 'Roll Number / Registration Number');
  const nameCol   = col_(headers, 'Full Name (as per University Records)');
  const genderCol = col_(headers, 'Gender');
  const distCol   = col_(headers, 'Distance from Residence to University');
  const medCol    = col_(headers, 'Special Accommodation Requirements');
  const catCol    = col_(headers, 'Category');
  const roomTypeCol = col_(headers, 'Preferred Room Type');
  const roommateCol = col_(headers, 'Preferred Roommate(s) - Roll Numbers');
  const statusCol = col_(headers, 'Status');
  const roomCol   = col_(headers, 'Room Number');
  const scoreCol  = col_(headers, 'Priority Score');

  const emailCols = getEmailColumns_(headers);

  const pools = buildRoomPools_();
  const roomTypeMap = buildRoomTypeMap_(pools);

  const rollToRoom = {};
  const candidates = [];
  const ineligibleCount = { Male: 0, Female: 0 };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const roll = String(row[rollCol] || '').trim();
    if (!roll) continue;

    const status = row[statusCol];
    if (status === 'Rejected') continue;

    if (status === 'Allotted' && row[roomCol] && String(row[roomCol]).trim() && String(row[roomCol]).trim().toUpperCase() !== 'N/A') {
      const gender = row[genderCol];
      const roomNumber = String(row[roomCol]).trim();
      const typeKey = roomTypeMap[roomNumber] || parseRoomTypeFromRoomNumber_(roomNumber);
      if (gender && typeKey && pools[gender] && pools[gender][typeKey]) {
        const room = addExistingRoomToPools_(pools, gender, roomNumber, typeKey);
        if (room.occupants.length < room.capacity) {
          room.occupants.push(roll);
          rollToRoom[roll] = room;
          continue;
        }
      }
      // Invalid/unrecognized room: treat this student as needing allocation again.
    }

    // Automated eligibility check — day scholars within 50km don't need a seat,
    // unless they have a genuine special accommodation need (see isEligible_).
    const eligibility = isEligible_(row[distCol], row[medCol]);
    if (!eligibility.eligible) {
      sheet.getRange(i + 1, statusCol + 1).setValue('Not Eligible');
      sheet.getRange(i + 1, roomCol + 1).setValue('N/A');
      ineligibleCount[row[genderCol]] = (ineligibleCount[row[genderCol]] || 0) + 1;
      continue; // never scored, never placed
    }

    const score = scoreDistance_(row[distCol]) + scoreMedical_(row[medCol]) + scoreCategory_(row[catCol]);
    sheet.getRange(i + 1, scoreCol + 1).setValue(score);

    candidates.push({
      rowIndex: i,
      roll: roll,
      name: row[nameCol],
      gender: row[genderCol],
      email: resolveEmail_(row, emailCols),
      score: score,
      preferredType: roomTypeKey_(row[roomTypeCol]),
      roommateRequests: parseRoommateRolls_(row[roommateCol])
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const allottedCount = { Male: 0, Female: 0 };
  const waitlistedCount = { Male: 0, Female: 0 };

  for (const student of candidates) {
    const genderPools = pools[student.gender];
    if (!genderPools) {
      sheet.getRange(student.rowIndex + 1, statusCol + 1).setValue('Waitlisted');
      sheet.getRange(student.rowIndex + 1, roomCol + 1).setValue('N/A');
      continue;
    }

    let placedRoom = null;
    for (const reqRoll of student.roommateRequests) {
      const candidateRoom = rollToRoom[reqRoll];
      if (candidateRoom && candidateRoom.occupants.length < candidateRoom.capacity) { placedRoom = candidateRoom; break; }
    }
    if (!placedRoom) {
      const typesToTry = [student.preferredType, ...CONFIG.FALLBACK_ORDER.filter(t => t !== student.preferredType)];
      for (const typeKey of typesToTry) {
        const room = genderPools[typeKey].find(r => r.occupants.length < r.capacity);
        if (room) { placedRoom = room; break; }
      }
    }

    if (placedRoom) {
      placedRoom.occupants.push(student.roll);
      rollToRoom[student.roll] = placedRoom;
      sheet.getRange(student.rowIndex + 1, statusCol + 1).setValue('Allotted');
      sheet.getRange(student.rowIndex + 1, roomCol + 1).setValue(placedRoom.roomNumber);
      allottedCount[student.gender]++;
    } else {
      sheet.getRange(student.rowIndex + 1, statusCol + 1).setValue('Waitlisted');
      sheet.getRange(student.rowIndex + 1, roomCol + 1).setValue('N/A');
      waitlistedCount[student.gender]++;
    }
  }

  PropertiesService.getScriptProperties().setProperty(PROP_ALLOCATION_PREPARED, 'true');
  logAudit_(actor || 'System', 'Run Allocation',
    'Allotted B:' + allottedCount.Male + ' G:' + allottedCount.Female +
    ' | Waitlisted B:' + waitlistedCount.Male + ' G:' + waitlistedCount.Female +
    ' | Not Eligible B:' + ineligibleCount.Male + ' G:' + ineligibleCount.Female);

  return { allottedCount, waitlistedCount, ineligibleCount };
}

// ============================================
// 2. API FOR WEBPAGE (Status Check + Room Availability) + Admin page router
// ============================================
function doGet(e) {
  const page = e.parameter && e.parameter.page;
  if (page === 'admin') {
    return HtmlService.createHtmlOutputFromFile('AdminDashboard')
      .setTitle('Hostel Allocation – Admin Dashboard')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  const action = (e.parameter && e.parameter.action) || 'status';
  const sheet = getResponseSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = trimmedHeaders_(data[0]);
  const genderCol = col_(headers, 'Gender');
  const statusCol = col_(headers, 'Status');

  if (action === 'rooms') {
    const available = getAvailableInventory_();
    const total = getTotalInventory_();
    if (!available) {
      return ContentService.createTextOutput(JSON.stringify({ configured: false, total, message: 'Available room inventory has not been configured yet.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    validateAvailableInventory_(available);

    const byType = {};
    for (const gender of ['Male', 'Female']) {
      byType[gender] = {};
      for (const typeKey of ['single', 'triple', 'four']) {
        const seatsPerRoom = CONFIG.ROOM_TYPES[Object.keys(CONFIG.ROOM_TYPES).find(k => CONFIG.ROOM_TYPES[k].key === typeKey)].seatsPerRoom;
        const roomCount = available[gender][typeKey];
        byType[gender][typeKey] = {
          rooms: roomCount,
          total: roomCount * seatsPerRoom,
          allotted: 0,
          available: roomCount * seatsPerRoom
        };
      }
    }

    const storedRoomTypeMap = getRoomTypeMap_();
    const roomTypeMap = Object.assign({}, storedRoomTypeMap.Male || {}, storedRoomTypeMap.Female || {});
    const roomCol = col_(headers, 'Room Number');
    let boysAllotted = 0, girlsAllotted = 0;
    const published = isResultsPublished_();
    if (published) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][statusCol] === 'Allotted') {
          const gender = data[i][genderCol];
          if (gender === 'Male') boysAllotted++;
          else if (gender === 'Female') girlsAllotted++;
          const roomNumber = String(data[i][roomCol] || '').trim();
          const typeKey = roomTypeMap[roomNumber] || parseRoomTypeFromRoomNumber_(roomNumber);
          if (typeKey && byType[gender] && byType[gender][typeKey]) {
            byType[gender][typeKey].allotted++;
            byType[gender][typeKey].available = Math.max(0, byType[gender][typeKey].available - 1);
          }
        }
      }
    }

    const boysTotal = available.Male.single + available.Male.triple * 3 + available.Male.four * 4;
    const girlsTotal = available.Female.single + available.Female.triple * 3 + available.Female.four * 4;
    return ContentService.createTextOutput(JSON.stringify({
      configured: true, published,
      boys: { total: boysTotal, allotted: boysAllotted, available: Math.max(0, boysTotal - boysAllotted), byType: byType.Male },
      girls: { total: girlsTotal, allotted: girlsAllotted, available: Math.max(0, girlsTotal - girlsAllotted), byType: byType.Female }
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const rollNumber = e.parameter && e.parameter.roll;
  if (!rollNumber || !String(rollNumber).trim()) {
    return ContentService.createTextOutput(JSON.stringify({ found: false, error: 'No roll number provided' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const rollCol = col_(headers, 'Roll Number / Registration Number');
  const nameCol = col_(headers, 'Full Name (as per University Records)');
  const roomCol = col_(headers, 'Room Number');
  const needle = String(rollNumber).toLowerCase().trim();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[rollCol] && String(row[rollCol]).toLowerCase().trim() === needle) {
      if (!isResultsPublished_()) {
        const pendingResult = {
          found: true, name: row[nameCol], roll: row[rollCol], gender: row[genderCol],
          status: 'Results Pending', room: '-', submittedDate: row[0]
        };
        return ContentService.createTextOutput(JSON.stringify(pendingResult)).setMimeType(ContentService.MimeType.JSON);
      }
      const result = {
        found: true, name: row[nameCol], roll: row[rollCol], gender: row[genderCol],
        status: row[statusCol] || 'Pending', room: row[roomCol] || '-', submittedDate: row[0]
      };
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ found: false })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 3. ADMIN DASHBOARD SERVER FUNCTIONS
//    (called via google.script.run from AdminDashboard.html)
//
//    Auth: set an ADMIN_PASSWORD script property once before deploying —
//    Project Settings > Script Properties > Add property.
//    Every admin call is stateless: password is checked on every request.
// ============================================
function checkAdminPassword_(password) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!real) throw new Error('No ADMIN_PASSWORD script property set. Set one in Project Settings before using the admin dashboard.');
  return password === real;
}

function adminLogin(password) {
  return checkAdminPassword_(password);
}

function adminGetAllApplications(password) {
  if (!checkAdminPassword_(password)) throw new Error('Invalid admin password.');
  const sheet = getResponseSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = trimmedHeaders_(data[0]);
  const idx = {
    roll: col_(headers, 'Roll Number / Registration Number'),
    name: col_(headers, 'Full Name (as per University Records)'),
    gender: col_(headers, 'Gender'),
    programme: col_(headers, 'Programme Name'),
    category: col_(headers, 'Category'),
    roomType: col_(headers, 'Preferred Room Type'),
    status: col_(headers, 'Status'),
    room: col_(headers, 'Room Number'),
    score: col_(headers, 'Priority Score')
  };
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[idx.roll]) continue;
    rows.push({
      rowNum: i + 1,
      roll: row[idx.roll], name: row[idx.name], gender: row[idx.gender],
      programme: row[idx.programme], category: row[idx.category], roomType: row[idx.roomType],
      status: row[idx.status] || 'Pending', room: row[idx.room] || '-', score: row[idx.score] || 0
    });
  }
  return rows;
}

function adminUpdateStatus(password, rowNum, newStatus, newRoom) {
  if (!checkAdminPassword_(password)) throw new Error('Invalid admin password.');
  const sheet = getResponseSheet_();
  const headers = trimmedHeaders_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const statusCol = col_(headers, 'Status');
  const roomCol = col_(headers, 'Room Number');
  const rollCol = col_(headers, 'Roll Number / Registration Number');

  if (!['Allotted', 'Waitlisted', 'Pending', 'Not Eligible', 'Rejected'].includes(newStatus)) {
    throw new Error('Invalid status.');
  }
  if (newStatus === 'Allotted' && (!newRoom || !String(newRoom).trim() || String(newRoom).trim().toUpperCase() === 'N/A')) {
    throw new Error('An Allotted student must have a room ID.');
  }

  sheet.getRange(rowNum, statusCol + 1).setValue(newStatus);
  sheet.getRange(rowNum, roomCol + 1).setValue(newStatus === 'Allotted' ? String(newRoom).trim() : 'N/A');

  const rowVals = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  logAudit_('Admin', 'Manual Status Override', 'Roll ' + rowVals[rollCol] + ' -> ' + newStatus + (newStatus === 'Allotted' ? ' / Room ' + String(newRoom).trim() : ''));
  return true;
}

function adminGetInventoryConfig(password) {
  if (!checkAdminPassword_(password)) throw new Error('Invalid admin password.');
  return { total: getTotalInventory_(), available: getAvailableInventory_() };
}

function adminSetAvailableInventory(password, inventory) {
  if (!checkAdminPassword_(password)) throw new Error('Invalid admin password.');
  if (isResultsPublished_()) throw new Error('Hide the published results before changing available inventory.');
  validateAvailableInventory_(inventory);
  PropertiesService.getScriptProperties().setProperty(PROP_AVAILABLE_INVENTORY, JSON.stringify(inventory));
  buildRoomPools_();
  PropertiesService.getScriptProperties().setProperty(PROP_ALLOCATION_PREPARED, 'false');
  logAudit_('Admin', 'Inventory Updated', JSON.stringify(inventory));
  return inventory;
}

function adminGetPublicationState(password) {
  if (!checkAdminPassword_(password)) throw new Error('Invalid admin password.');
  return { published: isResultsPublished_() };
}

function adminRunAllocation(password) {
  if (!checkAdminPassword_(password)) throw new Error('Invalid admin password.');
  if (isResultsPublished_()) throw new Error('Results are already published. Hide the results before recalculating.');
  if (!getAvailableInventory_()) throw new Error('Set the available room inventory before running allocation.');
  const result = runAllocationCore_('Admin (dashboard)');
  logAudit_('Admin', 'Allocation Prepared', 'Results calculated but not published.');
  return result;
}

function adminPublishResults(password) {
  if (!checkAdminPassword_(password)) throw new Error('Invalid admin password.');
  if (isResultsPublished_()) throw new Error('Results are already published.');
  if (PropertiesService.getScriptProperties().getProperty(PROP_ALLOCATION_PREPARED) !== 'true') {
    throw new Error('Run Calculate Allocation first.');
  }
  const sheet = getResponseSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = trimmedHeaders_(data[0]);
  const rollCol = col_(headers, 'Roll Number / Registration Number');
  const nameCol = col_(headers, 'Full Name (as per University Records)');
  const statusCol = col_(headers, 'Status');
  const roomCol = col_(headers, 'Room Number');
  const emailCols = getEmailColumns_(headers);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusCol];
    if (status === 'Allotted' && (!row[roomCol] || String(row[roomCol]).trim().toUpperCase() === 'N/A')) {
      throw new Error('Cannot publish: Roll ' + row[rollCol] + ' is Allotted but has no room ID.');
    }
  }

  let sentCount = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusCol];
    if (['Allotted', 'Waitlisted', 'Not Eligible', 'Rejected'].includes(status)) {
      const sent = maybeNotify_(row[rollCol], status, resolveEmail_(row, emailCols), row[nameCol], row[roomCol]);
      if (sent) sentCount++;
    }
  }
  setResultsPublished_(true);
  logAudit_('Admin', 'Publish Results', sentCount + ' notification emails sent.');
  return { published: true, sentCount };
}

function adminUnpublishResults(password) {
  if (!checkAdminPassword_(password)) throw new Error('Invalid admin password.');
  setResultsPublished_(false);
  logAudit_('Admin', 'Unpublish Results', 'Student-facing results hidden.');
  return { published: false };
}

// Testing helper: clears the notification tracker without changing allocation results.
function resetNotificationTracker() {
  PropertiesService.getScriptProperties().deleteProperty('NOTIFIED_MAP');
}

function adminGetAuditLog(password) {
  if (!checkAdminPassword_(password)) throw new Error('Invalid admin password.');
  const sheet = getOrCreateAuditSheet_();
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1).map(r => ({ timestamp: r[0], actor: r[1], action: r[2], details: r[3] }));
  return rows.reverse().slice(0, 25); // most recent 25
}
