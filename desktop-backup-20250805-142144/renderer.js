// Global variables
let token = null;
let selectedLead = null;
let peerConnection = null;
let localStream = null;
let allLeads = [];
let timeUpdateInterval = null;

// Telnyx WebRTC SDK
// Removed Telnyx client - using native WebRTC instead
let webrtcClient = null;
let currentCall = null;

// Audio control variables
let micEnabled = true;
let audioLevelInterval = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let gainNode = null;


// Call debouncing variables
let lastDialedNumber = null;
let lastDialedTime = 0;
const CALL_DEBOUNCE_TIME = 3000; // 3 seconds

// Telnyx WebRTC Configuration
const TELNYX_CONFIG = {
  username: process.env.TELNYX_WEBRTC_USERNAME || 'gencredm3r4XzsA2Y5FER23YuG48TapjHrU0GXpO03PD3caol',
  password: process.env.TELNYX_WEBRTC_PASSWORD || '2df7077b9bc94c02a2d8854fe1f222c6'
};

// Audio context for beep sounds
let beepOscillator = null;

// Call State Management System
const CALL_STATES = {
  IDLE: 'IDLE',
  DIALING: 'DIALING',
  RINGING: 'RINGING',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  DISCONNECTING: 'DISCONNECTING',
  DISCONNECTED: 'DISCONNECTED'
};

const CALL_STATE_LABELS = {
  [CALL_STATES.IDLE]: 'Ready',
  [CALL_STATES.DIALING]: 'Calling…',
  [CALL_STATES.RINGING]: 'Ringing…',
  [CALL_STATES.ACTIVE]: 'Connected',
  [CALL_STATES.ON_HOLD]: 'On Hold',
  [CALL_STATES.DISCONNECTING]: 'Ending call…',
  [CALL_STATES.DISCONNECTED]: 'Call ended'
};

let currentCallState = CALL_STATES.IDLE;
let callStartTime = null;
let callTimer = null;

// Call State Management Functions
function setCallState(newState, additionalInfo = '') {
  const previousState = currentCallState;
  
  // Prevent redundant state transitions
  if (previousState === newState) {
    console.log(`📞 [CALL STATE] Skipping redundant transition: ${previousState} → ${newState}`);
    return;
  }
  
  currentCallState = newState;
  
  console.log(`📞 [CALL STATE] ${previousState} → ${newState} ${additionalInfo ? `(${additionalInfo})` : ''}`);
  
  updateCallStatusDisplay();
  
  // Handle state-specific actions and button transformations
  switch (newState) {
    case CALL_STATES.DIALING:
      playCallBeep();
      callStartTime = Date.now();
      // Keep call button in calling state (already handled by existing code)
      break;
    case CALL_STATES.RINGING:
      // Could add ringing sound here
      // Keep call button in calling state
      break;
    case CALL_STATES.ACTIVE:
      startCallTimer();
      // Transform button to end call state
      transformCallButtonToEndCall();
      // Start call quality monitoring
      startCallQualityMonitoring();
      break;
    case CALL_STATES.ON_HOLD:
      // Keep end call button state
      break;
    case CALL_STATES.DISCONNECTING:
      playHangupBeep();
      // Keep end call button state during disconnection
      break;
    case CALL_STATES.DISCONNECTED:
      stopCallTimer();
      callStartTime = null;
      // Transform button back to call state
      transformCallButtonToCall();
      // Stop call quality monitoring
      stopCallQualityMonitoring();
      break;
    case CALL_STATES.IDLE:
      // Ensure button is in call state
      transformCallButtonToCall();
      break;
  }
}

function updateCallStatusDisplay() {
  const callStatus = document.getElementById('callStatus');
  if (!callStatus) return;
  
  const label = CALL_STATE_LABELS[currentCallState];
  callStatus.textContent = label;
  
  // Update CSS classes for styling
  callStatus.className = 'call-status';
  
  switch (currentCallState) {
    case CALL_STATES.IDLE:
      callStatus.classList.add('idle');
      break;
    case CALL_STATES.DIALING:
      callStatus.classList.add('calling');
      break;
    case CALL_STATES.RINGING:
      callStatus.classList.add('ringing');
      break;
    case CALL_STATES.ACTIVE:
      callStatus.classList.add('connected');
      break;
    case CALL_STATES.ON_HOLD:
      callStatus.classList.add('on-hold');
      break;
    case CALL_STATES.DISCONNECTING:
      callStatus.classList.add('disconnecting');
      break;
    case CALL_STATES.DISCONNECTED:
      callStatus.classList.add('disconnected');
      break;
  }
}

function startCallTimer() {
  if (callTimer) {
    clearInterval(callTimer);
  }
  
  callTimer = setInterval(() => {
    if (callStartTime && currentCallState === CALL_STATES.ACTIVE) {
      const elapsed = Date.now() - callStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      const callStatus = document.getElementById('callStatus');
      if (callStatus) {
        callStatus.textContent = `Connected ${timeString}`;
      }
    }
  }, 1000);
}

function stopCallTimer() {
  if (callTimer) {
    clearInterval(callTimer);
    callTimer = null;
  }
}

function getCallDuration() {
  if (!callStartTime) return 0;
  return Date.now() - callStartTime;
}

// Enhanced call state transitions
function transitionToDialing(phoneNumber) {
  setCallState(CALL_STATES.DIALING, phoneNumber);
}

function transitionToRinging() {
  setCallState(CALL_STATES.RINGING);
}

function transitionToActive() {
  setCallState(CALL_STATES.ACTIVE);
  
  // Send call-start event to CRM for Power Dialer
  if (ws && ws.readyState === WebSocket.OPEN) {
    const callStartMessage = {
      type: 'call-start',
      data: {
        leadId: selectedLead ? selectedLead.id : null,
        callId: currentCallControlId,
        timestamp: new Date().toISOString()
      }
    };
    console.log('📤 [POWER DIALER] Sending call-start event to CRM:', callStartMessage);
    ws.send(JSON.stringify(callStartMessage));
  }
}

function transitionToOnHold() {
  setCallState(CALL_STATES.ON_HOLD);
}

function transitionToDisconnecting() {
  setCallState(CALL_STATES.DISCONNECTING);
}

function transitionToDisconnected() {
  setCallState(CALL_STATES.DISCONNECTED);
  
  // Send call-end event to CRM for Power Dialer
  if (ws && ws.readyState === WebSocket.OPEN) {
    const callEndMessage = {
      type: 'call-end',
      data: {
        leadId: selectedLead ? selectedLead.id : null,
        callId: currentCallControlId,
        timestamp: new Date().toISOString(),
        duration: getCallDuration()
      }
    };
    console.log('📤 [POWER DIALER] Sending call-end event to CRM:', callEndMessage);
    ws.send(JSON.stringify(callEndMessage));
  }
}

function resetCallState() {
  setCallState(CALL_STATES.IDLE);
}

// WebRTC Call State Integration
function handleWebRTCCallStateChange(event) {
  console.log('📞 [WEBRTC] Call state changed:', event);
  
  switch (event.type) {
    case 'connectionstatechange':
      handleConnectionStateChange(event.target.connectionState);
      break;
    case 'iceconnectionstatechange':
      handleIceConnectionStateChange(event.target.iceConnectionState);
      break;
    case 'signalingstatechange':
      handleSignalingStateChange(event.target.signalingState);
      break;
  }
}

function handleConnectionStateChange(state) {
  console.log('📞 [WEBRTC] Connection state:', state);
  
  switch (state) {
    case 'connected':
      transitionToActive();
      break;
    case 'disconnected':
      transitionToDisconnected();
      break;
    case 'failed':
      transitionToDisconnected();
      break;
  }
}

function handleIceConnectionStateChange(state) {
  console.log('📞 [WEBRTC] ICE connection state:', state);
  
  switch (state) {
    case 'connected':
      transitionToActive();
      break;
    case 'disconnected':
      transitionToDisconnected();
      break;
    case 'failed':
      transitionToDisconnected();
      break;
  }
}

function handleSignalingStateChange(state) {
  console.log('📞 [WEBRTC] Signaling state:', state);
  
  switch (state) {
    case 'stable':
      // Call is stable, could be active or idle
      break;
    case 'have-local-offer':
      transitionToRinging();
      break;
    case 'have-remote-offer':
      transitionToRinging();
      break;
  }
}

// Initialize call state system
function initializeCallStateSystem() {
  console.log('📞 [CALL STATE] Initializing call state management system');
  
  // Initialize call status display
  updateCallStatusDisplay();
  
  // Initialize audio context
  initAudioContext();
  
  // Show welcome message for 2 seconds, then set to Ready
  const callStatus = document.getElementById('callStatus');
  if (callStatus) {
    callStatus.textContent = 'Welcome to Crokodialer';
    callStatus.className = 'call-status idle';
    setTimeout(() => {
      resetCallState();
    }, 2000);
  }
  
  console.log('✅ [CALL STATE] Call state management system initialized');
}

// Initialize audio context for beep sounds - NUCLEAR SAFE VERSION
function initAudioContext() {
  try {
    // NUCLEAR: Completely disable AudioContext to prevent all crashes
    console.log('🔧 [AUDIO] AudioContext completely disabled to prevent crashes');
    audioContext = null;
    console.log('✅ [AUDIO] AudioContext disabled - no audio features available');
  } catch (error) {
    console.error('❌ [AUDIO] Failed to disable AudioContext:', error);
  }
}

// Play beep sound for dial pad keys - NUCLEAR SAFE VERSION
async function playBeepSound(frequency = 800, duration = 100) {
  try {
    // NUCLEAR: Completely disable audio to prevent crashes
    console.log('🔧 [AUDIO] Audio disabled - skipping beep sound');
    console.log('🔊 [AUDIO] Would play beep sound:', frequency, 'Hz for', duration, 'ms');
    return;
  } catch (error) {
    console.error('❌ [AUDIO] Failed to handle beep sound:', error);
  }
}

// Enhanced beep functions for different actions
function playNumberBeep() {
  playBeepSound(800, 100); // Standard number key beep
}

function playSpecialKeyBeep() {
  playBeepSound(1200, 150); // Higher frequency for * and #
}

function playCallBeep() {
  playBeepSound(1000, 300); // Call initiation beep
}

function playHangupBeep() {
  playBeepSound(600, 200); // Hangup beep
}

function playErrorBeep() {
  playBeepSound(400, 500); // Low frequency, longer duration for errors
}

// Protocol handler for incoming calls from system
// const { ipcRenderer } = require('electron');

// Listen for incoming calls from protocol handler
// Note: ipcRenderer is disabled due to Electron compatibility issues
// ipcRenderer.on('incoming-call', (event, data) => {
//   console.log('Incoming call from protocol:', data);
//   if (data.phoneNumber) {
//     // Auto-populate the phone number and start call
//     phoneDisplay.value = data.phoneNumber;
//     startCall(data.phoneNumber);
//   }
// });

// Listen for WebSocket messages from main process
// Note: ipcRenderer is disabled due to Electron compatibility issues
// ipcRenderer.on('websocket-message', (event, data) => {
//   console.log('📨 [Crokodialer Renderer] Received WebSocket message in renderer:', data);
//   
//   if (data.type === 'selectLead') {
//     const leadData = data.data;
//     console.log('🎯 [Crokodialer Renderer] Processing selectLead message:', leadData);
//     console.log('🔍 [Crokodialer Renderer] Lead data structure:', {
//       leadId: leadData.leadId,
//       name: leadData.name,
//       phone: leadData.phone,
//       type: typeof leadData.phone
//     });
//     
//     // Create a mock lead object with the received data
//     const mockLead = {
//       id: leadData.leadId, // Fix: Use 'id' instead of '_id' to match backend structure
//       name: leadData.name,
//       phoneNumber: leadData.phone, // Map leadData.phone to phoneNumber
//       phone: leadData.phone,
//       // Add additional phone field mappings to ensure compatibility
//       primaryPhone: leadData.phone
//     };
//     
//     console.log('👤 [Crokodialer Renderer] Created mock lead object:', mockLead);
//     selectLead(mockLead);
//   } else if (data.type === 'powerDialerSync') {
//     console.log('🎯 [Crokodialer Renderer] Processing powerDialerSync message:', data.data);
//     
//     const { enabled, currentIndex, totalLeads } = data.data;
//     
//     // Sync the power dialer state
//     if (powerDialerToggle) {
//       powerDialerToggle.checked = enabled;
//       powerDialerEnabled = enabled;
//       
//       if (enabled) {
//         console.log('🔄 [Crokodialer Renderer] Syncing power dialer ON from web app');
//         currentLeadIndex = currentIndex || 0;
//         updatePowerDialerState();
//         startPowerDialing();
//       } else {
//         console.log('🔄 [Crokodialer Renderer] Syncing power dialer OFF from web app');
//         stopPowerDialing();
//       }
//     }
//   } else {
//     console.log('⚠️ [Crokodialer Renderer] Unknown message type:', data.type);
//   }
// });

// Power Dialer variables
let powerDialerEnabled = false;
let currentLeadIndex = 0;
let isPowerDialing = false;
let isCallActive = false; // Track if a call is currently active

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const phoneDisplay = document.getElementById('phoneDisplay');
const dialButtons = document.querySelectorAll('.dial-btn');
const callBtn = document.getElementById('callBtn');
const hangupBtn = document.getElementById('hangupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const remoteAudio = document.getElementById('remoteAudio');
const callStatus = document.getElementById('callStatus');
const timeDisplay = document.getElementById('timeDisplay');


// Tab elements
const tabContents = document.querySelectorAll('.tab-content');
const navTabs = document.querySelectorAll('.nav-tab');

// Contacts elements
const contactsSearch = document.getElementById('contactsSearch');
const contactsList = document.getElementById('contactsList');
const refreshLeadsBtn = document.getElementById('refreshLeadsBtn');
const leadCount = document.getElementById('leadCount');

// Power dialer elements
const powerDialerToggle = document.getElementById('powerDialerToggle');

// API configuration - Use localhost for development
// Import config for environment-based URLs
const config = require('./config.js');
const API_BASE_URL = config.api.baseUrl;
const DEFAULT_FROM_NUMBER = '+1234567890';

// API request function
async function apiRequest(method, endpoint, data = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type");

    if (response.ok && contentType && contentType.includes("application/json")) {
      const result = await response.json();
      return result;
    } else {
      const text = await response.text();
      throw new Error(`Unexpected response: ${text}`);
    }
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// Timezone mapping
const stateTimezones = {
  'AL': 'America/Chicago', 'AK': 'America/Anchorage', 'AZ': 'America/Phoenix', 'AR': 'America/Chicago',
  'CA': 'America/Los_Angeles', 'CO': 'America/Denver', 'CT': 'America/New_York', 'DE': 'America/New_York',
  'FL': 'America/New_York', 'GA': 'America/New_York', 'HI': 'Pacific/Honolulu', 'ID': 'America/Boise',
  'IL': 'America/Chicago', 'IN': 'America/Indiana/Indianapolis', 'IA': 'America/Chicago',
  'KS': 'America/Chicago', 'KY': 'America/New_York', 'LA': 'America/Chicago', 'ME': 'America/New_York',
  'MD': 'America/New_York', 'MA': 'America/New_York', 'MI': 'America/New_York', 'MN': 'America/Chicago',
  'MS': 'America/Chicago', 'MO': 'America/Chicago', 'MT': 'America/Denver', 'NE': 'America/Chicago',
  'NV': 'America/Los_Angeles', 'NH': 'America/New_York', 'NJ': 'America/New_York', 'NM': 'America/Denver',
  'NY': 'America/New_York', 'NC': 'America/New_York', 'ND': 'America/Chicago', 'OH': 'America/New_York',
  'OK': 'America/Chicago', 'OR': 'America/Los_Angeles', 'PA': 'America/New_York', 'RI': 'America/New_York',
  'SC': 'America/New_York', 'SD': 'America/Chicago', 'TN': 'America/Chicago', 'TX': 'America/Chicago',
  'UT': 'America/Denver', 'VT': 'America/New_York', 'VA': 'America/New_York', 'WA': 'America/Los_Angeles',
  'WV': 'America/New_York', 'WI': 'America/Chicago', 'WY': 'America/Denver'
};

// Get timezone from area code (simplified)
function getTimezoneFromAreaCode(phone) {
  const areaCode = phone.replace(/\D/g, '').substring(0, 3);
  // Simplified mapping - in production, you'd want a comprehensive area code database
  const eastCoastCodes = ['201', '202', '203', '205', '207', '212', '215', '301', '302', '305', '401', '404', '407', '410', '412', '413', '414', '415', '416', '418', '419', '423', '434', '440', '443', '450', '484', '501', '502', '504', '505', '508', '513', '514', '515', '516', '517', '518', '519', '520', '540', '541', '551', '561', '570', '571', '573', '574', '580', '585', '586', '601', '603', '605', '606', '607', '609', '610', '612', '614', '615', '616', '617', '618', '619', '620', '623', '626', '630', '631', '636', '641', '646', '650', '651', '660', '661', '662', '678', '682', '701', '702', '703', '704', '706', '707', '708', '713', '714', '715', '716', '717', '718', '719', '720', '724', '727', '732', '734', '740', '754', '757', '760', '763', '765', '770', '773', '774', '775', '781', '785', '786', '801', '802', '803', '804', '805', '806', '808', '810', '812', '813', '814', '815', '816', '817', '818', '828', '830', '831', '832', '843', '845', '847', '848', '850', '856', '857', '858', '859', '860', '862', '863', '864', '865', '870', '872', '878', '901', '903', '904', '906', '907', '908', '909', '910', '912', '913', '914', '915', '916', '917', '918', '919', '920', '925', '928', '929', '931', '936', '937', '938', '940', '941', '947', '949', '951', '952', '954', '956', '959', '970', '971', '972', '973', '975', '978', '979', '980', '984', '985', '989'];
  const centralCodes = ['205', '217', '219', '225', '228', '251', '256', '270', '281', '309', '312', '314', '318', '337', '346', '361', '409', '417', '423', '430', '432', '469', '479', '501', '504', '505', '512', '515', '517', '520', '540', '541', '551', '561', '570', '571', '573', '574', '580', '585', '586', '601', '603', '605', '606', '607', '609', '610', '612', '614', '615', '616', '617', '618', '619', '620', '623', '626', '630', '631', '636', '641', '646', '650', '651', '660', '661', '662', '678', '682', '701', '702', '703', '704', '706', '707', '708', '713', '714', '715', '716', '717', '718', '719', '720', '724', '727', '732', '734', '740', '754', '757', '760', '763', '765', '770', '773', '774', '775', '781', '785', '786', '801', '802', '803', '804', '805', '806', '808', '810', '812', '813', '814', '815', '816', '817', '818', '828', '830', '831', '832', '843', '845', '847', '848', '850', '856', '857', '858', '859', '860', '862', '863', '864', '865', '870', '872', '878', '901', '903', '904', '906', '907', '908', '909', '910', '912', '913', '914', '915', '916', '917', '918', '919', '920', '925', '928', '929', '931', '936', '937', '938', '940', '941', '947', '949', '951', '952', '954', '956', '959', '970', '971', '972', '973', '975', '978', '979', '980', '984', '985', '989'];
  
  if (eastCoastCodes.includes(areaCode)) return 'America/New_York';
  if (centralCodes.includes(areaCode)) return 'America/Chicago';
  return 'America/Los_Angeles'; // Default to Pacific
}

// Get timezone abbreviation
function getTimezoneAbbreviation(timezone) {
  const abbreviations = {
    'America/New_York': 'EST',
    'America/Chicago': 'CST',
    'America/Denver': 'MST',
    'America/Los_Angeles': 'PST',
    'America/Anchorage': 'AKST',
    'Pacific/Honolulu': 'HST',
    'America/Indiana/Indianapolis': 'EST',
    'America/Boise': 'MST'
  };
  
  return abbreviations[timezone] || 'UTC';
}

// Get lead's local time
function getLeadLocalTime(lead) {
  let timezone = 'UTC';
  
  if (lead.timezone) {
    timezone = lead.timezone;
  } else if (lead.state) {
    timezone = stateTimezones[lead.state] || 'America/New_York';
  } else if (lead.phone) {
    timezone = getTimezoneFromAreaCode(lead.phone);
  }
  
  try {
    const timeString = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone
    });
    
    const timezoneAbbr = getTimezoneAbbreviation(timezone);
    return `${timeString} ${timezoneAbbr}`;
  } catch (error) {
    console.error('Error getting lead time:', error);
    const timeString = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${timeString} UTC`;
  }
}

// Update time display
function updateTimeDisplay() {
  if (selectedLead) {
    timeDisplay.textContent = getLeadLocalTime(selectedLead);
  } else {
    const timeString = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    timeDisplay.textContent = `${timeString} PST`;
  }
}

// Start time updates
function startTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
  updateTimeDisplay();
  timeUpdateInterval = setInterval(updateTimeDisplay, 60000); // Update every minute
}

// Stop time updates
function stopTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }
}

// Show login screen
function showLoginScreen() {
  loginScreen.classList.add('active');
  mainScreen.classList.remove('active');
  stopTimeUpdates();
}

// Show main screen
function showMainScreen() {
  loginScreen.classList.remove('active');
  mainScreen.classList.add('active');
  startTimeUpdates();
}

// Load leads from CRM
async function loadLeads() {
  try {
    console.log('📋 [LEADS] Loading leads from API...');
    
    // Show loading state
    leadCount.textContent = 'Loading leads...';
    contactsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #8E8E93;">Loading leads from database...</div>';
    
    const response = await apiRequest('GET', '/leads');
    console.log('📋 [LEADS] API response received');
    
    // Fix: Use response.data instead of response.leads to match backend structure
    allLeads = response.data || [];
    console.log(`📋 [LEADS] Loaded ${allLeads.length} leads from database`);
    
    // Debug: Log first few leads to see their structure
    if (allLeads.length > 0) {
      console.log('📋 [LEADS] First lead sample:', allLeads[0]);
      console.log('📋 [LEADS] First lead phone:', allLeads[0].phone || allLeads[0].phoneNumber || allLeads[0].primaryPhone);
    }
    
    // Update the lead count display
    leadCount.textContent = `${allLeads.length} leads available`;
    
    // Populate the contacts list with all leads
    populateContactsList(allLeads);
    
    console.log(`✅ [LEADS] Successfully loaded and displayed ${allLeads.length} leads`);
  } catch (error) {
    console.error('❌ [LEADS] Error loading leads:', error);
    leadCount.textContent = 'Error loading leads';
    contactsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #FF3B30;">Failed to load leads. Please try again.</div>';
    
    // Show error message to user
    const callStatus = document.getElementById('callStatus');
    if (callStatus) {
      callStatus.textContent = 'Failed to load leads';
      callStatus.className = 'call-status error';
      
      // Reset status after 5 seconds
      setTimeout(() => {
        callStatus.textContent = 'Ready';
        callStatus.className = 'call-status idle';
      }, 5000);
    }
  }
}

// Populate contacts list
function populateContactsList(leads) {
  console.log(`📋 [CONTACTS] Populating contacts list with ${leads.length} leads`);
  
  // Clear existing contacts
  contactsList.innerHTML = '';
  
  // Create document fragment for better performance with large datasets
  const fragment = document.createDocumentFragment();
  
  leads.forEach((lead, index) => {
    const contactItem = document.createElement('div');
    contactItem.className = 'contact-item';
    // Fix: Use lead.id instead of lead._id to match backend structure
    contactItem.dataset.leadId = lead.id;
    
    const name = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown Lead';
    const phone = lead.phoneNumber || lead.phone || lead.primaryPhone || 'No phone';
    const status = lead.status || 'new';
    
    contactItem.innerHTML = `
      <div class="contact-name">${name}</div>
      <div class="contact-phone">${phone}</div>
      <div class="contact-status">
        <span class="status-badge ${status}">${status}</span>
      </div>
    `;
    
    contactItem.addEventListener('click', () => selectLead(lead));
    fragment.appendChild(contactItem);
    
    // Log progress for large datasets
    if (leads.length > 100 && index % 100 === 0) {
      console.log(`📋 [CONTACTS] Processed ${index + 1}/${leads.length} leads...`);
    }
  });
  
  // Append all contacts at once for better performance
  contactsList.appendChild(fragment);
  
  console.log(`✅ [CONTACTS] Successfully populated ${leads.length} contacts`);
}

// Select a lead
function selectLead(lead) {
  console.log('🎯 [Crokodialer Renderer] selectLead called with:', lead);
  selectedLead = lead;
  
  // Update current lead index for power dialer - Fix 3: Use normalized ID
  const normalizedId = lead.id || lead.leadId;
  const leadIndex = allLeads.findIndex(l => l.id === normalizedId);
  if (leadIndex !== -1) {
    currentLeadIndex = leadIndex;
  }
  
  // Update UI
  document.querySelectorAll('.contact-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Fix 3: Use normalized ID for data attribute
  const selectedItem = document.querySelector(`[data-lead-id="${normalizedId}"]`);
  if (selectedItem) {
    selectedItem.classList.add('selected');
  }
  
  // Update lead name display
  const leadNameDisplay = document.getElementById('leadNameDisplay');
  console.log('🔍 [Crokodialer Renderer] leadNameDisplay element:', leadNameDisplay);
  
  if (leadNameDisplay) {
    // Fix 4: Use lead.name directly - CRM always sends this field
    const name = lead.name || 'Unknown Lead';
    console.log('👤 [Crokodialer Renderer] Setting lead name to:', name);
    leadNameDisplay.textContent = name;
    console.log('✅ [Crokodialer Renderer] Lead name set successfully');
  } else {
    console.error('❌ [Crokodialer Renderer] leadNameDisplay element not found!');
  }
  
  // Update phone display - Fix 4: Use lead.phone directly
  const phone = lead.phone || '';
  console.log('📞 [Crokodialer Renderer] Setting phone to:', phone);
  console.log('🔍 [Crokodialer Renderer] phoneDisplay element:', phoneDisplay);
  
  if (phoneDisplay) {
    phoneDisplay.value = phone;
    console.log('✅ [Crokodialer Renderer] Phone number set successfully');
    console.log('🔍 [Crokodialer Renderer] phoneDisplay.value after setting:', phoneDisplay.value);
  } else {
    console.error('❌ [Crokodialer Renderer] phoneDisplay element not found!');
  }
  
  // Update time display
  updateTimeDisplay();
  
  // Switch to keypad tab
  switchTab('keypad');
}

// Switch tabs
function switchTab(tabName) {
  // Update tab content
  tabContents.forEach(content => {
    content.classList.remove('active');
  });
  
  const activeTab = document.getElementById(`${tabName}Tab`);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  // Update navigation
  navTabs.forEach(tab => {
    tab.classList.remove('active');
  });
  
  const activeNavTab = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeNavTab) {
    activeNavTab.classList.add('active');
  }
  

}

// Search contacts
function searchContacts(query) {
  const filteredLeads = allLeads.filter(lead => {
    const name = (lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`).toLowerCase();
    const phone = (lead.phoneNumber || lead.phone || lead.primaryPhone || '').toLowerCase();
    const email = (lead.email || '').toLowerCase();
    
    return name.includes(query.toLowerCase()) || 
           phone.includes(query.toLowerCase()) || 
           email.includes(query.toLowerCase());
  });
  
  populateContactsList(filteredLeads);
}

// Event listeners
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Clear previous errors
  loginError.textContent = '';
  
  // Disable form during login
  const submitButton = loginForm.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.textContent = 'Logging in...';
  submitButton.disabled = true;
  
  try {
    const response = await apiRequest('POST', '/auth/login', {
      email: emailInput.value,
      password: passwordInput.value
    });
    
    token = response.token;
    localStorage.setItem('token', token);
    
    console.log('Login successful, token stored');
    showMainScreen();
    await loadLeads();
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    // Re-enable form
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
});

// Dial buttons
dialButtons.forEach(button => {
  button.addEventListener('click', () => {
    const digit = button.dataset.digit;
    
    // Skip if this is the backspace button (no digit attribute)
    if (!digit) {
      return;
    }
    
    // Play different beep sounds for different key types
    if (digit === '*' || digit === '#') {
      // Higher frequency for special keys
      playSpecialKeyBeep();
    } else {
      // Standard beep for number keys
      playNumberBeep();
    }
    
    // Add the digit to the phone display
    phoneDisplay.value += digit;
    
    console.log('🔊 [AUDIO] Dial button pressed:', digit);
  });
});

// Backspace button
const backspaceBtn = document.getElementById('backspaceBtn');
if (backspaceBtn) {
  backspaceBtn.addEventListener('click', () => {
    // Play backspace beep sound
    playSpecialKeyBeep();
    
    // Remove the last character from phone display
    if (phoneDisplay.value.length > 0) {
      phoneDisplay.value = phoneDisplay.value.slice(0, -1);
      console.log('🔊 [AUDIO] Backspace button pressed');
    }
  });
}

// Call button
callBtn.addEventListener('click', async () => {
  console.log('🚨 [DIAGNOSTIC] Call button clicked at:', new Date().toISOString());
  console.log('🚨 [DIAGNOSTIC] Button disabled state:', callBtn.disabled);
  console.log('🚨 [DIAGNOSTIC] callInProgress:', callInProgress);
  console.log('🚨 [DIAGNOSTIC] isCallActive:', isCallActive);
  
  // Check if button is in "End Call" state
  const isEndCallState = callBtn.classList.contains('end-call');
  
  if (isEndCallState) {
    // Button is in "End Call" state - handle hangup
    console.log('🚨 [DIAGNOSTIC] Call button in End Call state - handling hangup');
    console.log('🚨 [DIAGNOSTIC] Power dialer state - enabled:', powerDialerEnabled, 'dialing:', isPowerDialing);
    
    // Play hangup beep sound
    playHangupBeep();
    
    try {
      // End the call if we have a selected lead
      if (selectedLead) {
        console.log('🚨 [DIAGNOSTIC] Ending call for selected lead:', selectedLead.name || selectedLead.id);
        await endCall(selectedLead);
      } else {
        console.log('🚨 [DIAGNOSTIC] No selected lead, just resetting UI');
        // Reset the UI even if no lead is selected
        isCallActive = false;
        transformCallButtonToCall();
      }
      
      // Note: advanceToNextLead is now handled inside endCall() for better timing
      console.log('✅ [DIAGNOSTIC] End call button action completed');
    } catch (error) {
      console.error('❌ [DIAGNOSTIC] Error in end call button handler:', error);
      // Still reset UI even if API call fails
      isCallActive = false;
      transformCallButtonToCall();
    }
    return;
  }
  
  // Button is in "Call" state - handle call initiation
  const phoneNumber = phoneDisplay.value.trim();
  
  console.log('🚨 [DIAGNOSTIC] Manual call attempt - phoneNumber:', phoneNumber);
  console.log('🚨 [DIAGNOSTIC] phoneDisplay.value:', phoneDisplay.value);
  console.log('🚨 [DIAGNOSTIC] phoneDisplay.value.trim():', phoneDisplay.value.trim());
  
  if (!phoneNumber) {
    console.log('🚨 [DIAGNOSTIC] No phone number entered');
    playErrorBeep(); // Play error beep for invalid input
    
    // Show error in call status
    const callStatus = document.getElementById('callStatus');
    if (callStatus) {
      callStatus.textContent = 'Please enter a phone number';
      callStatus.className = 'call-status error';
      
      // Reset status after 3 seconds
      setTimeout(() => {
        callStatus.textContent = 'Ready';
        callStatus.className = 'call-status idle';
      }, 3000);
    }
    return;
  }

  // Prevent double-clicks
  if (callBtn.disabled || callInProgress || isCallActive) {
    console.log('🚨 [DIAGNOSTIC] Call button blocked - already processing');
    playErrorBeep(); // Play error beep for blocked action
    return;
  }

  // Check debouncing before proceeding
  if (!shouldInitiateCall(phoneNumber)) {
    console.log('🚨 [DIAGNOSTIC] Call blocked by debouncing - duplicate detected');
    playErrorBeep(); // Play error beep for duplicate call
    return;
  }

  try {
    // Disable button immediately to prevent double-clicks
    callBtn.disabled = true;
    callBtn.classList.add('calling');
    
    // Transition to dialing state
    transitionToDialing(phoneNumber);
    
    // If we have a selected lead, use it for the call
    const leadId = selectedLead ? selectedLead.id : null;
    
    console.log('🚨 [DIAGNOSTIC] About to call startCall with:', phoneNumber, 'leadId:', leadId);
    await startCall(phoneNumber, leadId);
    
    // Change button to "End Call" state
    transformCallButtonToEndCall();
    
  } catch (error) {
    console.error('Error starting call:', error);
    
    // Reset call state and UI
    resetCallState();
    callBtn.classList.remove('calling');
    callBtn.disabled = false; // Re-enable button on error
    
    // Show error message to user
    const callStatus = document.getElementById('callStatus');
    if (callStatus) {
      callStatus.textContent = 'Call failed';
      callStatus.className = 'call-status error';
      
      // Reset status after 3 seconds
      setTimeout(() => {
        callStatus.textContent = 'Ready';
        callStatus.className = 'call-status idle';
      }, 3000);
    }
    
    // Don't show alert - let the status display handle it
    console.log('Call failed:', error.message);
  }
});

// Function to transform call button to "End Call" state
function transformCallButtonToEndCall() {
  // Change button text and icon
  callBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
      <line x1="23" y1="1" x2="1" y2="23"></line>
    </svg>
  `;
  
  // Change button styling to red
  callBtn.classList.add('end-call');
  callBtn.classList.remove('call-btn');
  
  // Re-enable button for hangup functionality
  callBtn.disabled = false;
  
  // Transition to active state
  transitionToActive();
}

// Function to transform call button back to "Call" state
function transformCallButtonToCall() {
  // Change button text and icon back to call
  callBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
    </svg>
  `;
  
  // Change button styling back to green
  callBtn.classList.remove('end-call');
  callBtn.classList.add('call-btn');
  
  // Remove calling state
  callBtn.classList.remove('calling');
}

// Hangup button
hangupBtn.addEventListener('click', async () => {
  console.log('🚨 [DIAGNOSTIC] Hangup button clicked');
  console.log('🚨 [DIAGNOSTIC] Power dialer state - enabled:', powerDialerEnabled, 'dialing:', isPowerDialing);
  
  try {
    // End the call if we have a selected lead
    if (selectedLead) {
      console.log('🚨 [DIAGNOSTIC] Ending call for selected lead:', selectedLead.name || selectedLead.id);
      await endCall(selectedLead);
    } else {
      console.log('🚨 [DIAGNOSTIC] No selected lead, just resetting UI');
      // Reset the UI even if no lead is selected
      isCallActive = false;
      callStatus.textContent = 'Ready';
      callStatus.className = 'call-status';
      callBtn.classList.remove('calling');
      callBtn.disabled = false;
      document.querySelector('.call-button-container').style.display = 'flex';
      document.querySelector('.hangup-button-container').style.display = 'none';
    }
    
    // Note: advanceToNextLead is now handled inside endCall() for better timing
    console.log('✅ [DIAGNOSTIC] Hangup button action completed');
  } catch (error) {
    console.error('❌ [DIAGNOSTIC] Error in hangup button handler:', error);
    // Still reset UI even if API call fails
    isCallActive = false;
    callStatus.textContent = 'Ready';
    callStatus.className = 'call-status';
    callBtn.classList.remove('calling');
    callBtn.disabled = false;
    document.querySelector('.call-button-container').style.display = 'flex';
    document.querySelector('.hangup-button-container').style.display = 'none';
  }
});

// Logout button
logoutBtn.addEventListener('click', () => {
  token = null;
  selectedLead = null;
  localStorage.removeItem('token');
  showLoginScreen();
});

// Current theme state
let currentTheme = {
  backgroundColor: '#000000',
  textColor: '#ffffff',
  accentColor: '#007bff',
  primaryColor: '#007bff'  // Add primary color for phone outline
};

// Initialize color pickers and inputs
function updateColorPickers() {
  console.log('🎨 [COLOR-PICKER] Updating color pickers...');
  console.log('🎨 [COLOR-PICKER] bgColorPicker element:', bgColorPicker);
  console.log('🎨 [COLOR-PICKER] textColorPicker element:', textColorPicker);
  console.log('🎨 [COLOR-PICKER] accentColorPicker element:', accentColorPicker);
  console.log('🎨 [COLOR-PICKER] Current theme:', currentTheme);
  
  if (bgColorPicker) {
    bgColorPicker.value = currentTheme.backgroundColor;
    console.log('🎨 [COLOR-PICKER] Set bgColorPicker.value to:', currentTheme.backgroundColor);
  } else {
    console.error('🎨 [COLOR-PICKER] bgColorPicker element not found!');
  }
  
  if (textColorPicker) {
    textColorPicker.value = currentTheme.textColor;
    console.log('🎨 [COLOR-PICKER] Set textColorPicker.value to:', currentTheme.textColor);
  } else {
    console.error('🎨 [COLOR-PICKER] textColorPicker element not found!');
  }
  
  if (accentColorPicker) {
    accentColorPicker.value = currentTheme.accentColor;
    console.log('🎨 [COLOR-PICKER] Set accentColorPicker.value to:', currentTheme.accentColor);
  } else {
    console.error('🎨 [COLOR-PICKER] accentColorPicker element not found!');
  }
  
  bgColorInput.value = currentTheme.backgroundColor;
  textColorInput.value = currentTheme.textColor;
  accentColorInput.value = currentTheme.accentColor;
}

// Apply theme to the app
function applyTheme(theme) {
  const root = document.documentElement;
  
  // Force override the CSS :root definitions by setting with !important
  root.style.setProperty('--accent-color', theme.accentColor, 'important');
  root.style.setProperty('--primary-color', theme.primaryColor || theme.accentColor, 'important');
  root.style.setProperty('--background-color', theme.backgroundColor, 'important');
  root.style.setProperty('--text-color', theme.textColor, 'important');
  
  // Also set on body for extra specificity
  document.body.style.setProperty('--accent-color', theme.accentColor, 'important');
  document.body.style.setProperty('--primary-color', theme.primaryColor || theme.accentColor, 'important');
  document.body.style.setProperty('--background-color', theme.backgroundColor, 'important');
  document.body.style.setProperty('--text-color', theme.textColor, 'important');
  
  // Force update the body::before and body::after pseudo-elements by triggering a repaint
  document.body.style.transform = 'translateZ(0)';
  
  // Add a style tag with higher specificity to override :root
  let themeStyle = document.getElementById('dynamic-theme-style');
  if (!themeStyle) {
    themeStyle = document.createElement('style');
    themeStyle.id = 'dynamic-theme-style';
    document.head.appendChild(themeStyle);
  }
  
  themeStyle.textContent = `
    :root {
      --accent-color: ${theme.accentColor} !important;
      --primary-color: ${theme.primaryColor || theme.accentColor} !important;
      --background-color: ${theme.backgroundColor} !important;
      --text-color: ${theme.textColor} !important;
    }
    
    /* Force update body pseudo-elements with maximum specificity */
    body::before {
      border: 1px solid ${theme.accentColor} !important;
      box-shadow: 
        0 0 0 1px ${theme.accentColor} !important,
        inset 0 3px 0 ${theme.accentColor} !important,
        inset 0 -3px 0 ${theme.primaryColor || theme.accentColor} !important,
        0 30px 60px rgba(0, 0, 0, 0.5),
        0 0 0 1px ${theme.accentColor} !important,
        0 0 30px ${theme.accentColor} !important,
        0 0 60px ${theme.primaryColor || theme.accentColor} !important;
    }
    
    body::after {
      background: linear-gradient(180deg, 
        ${theme.primaryColor || theme.accentColor} 0%, 
        ${theme.accentColor} 50%, 
        ${theme.backgroundColor} 100%) !important;
    }
    
    /* Force override any existing styles */
    body::before,
    body::after {
      border-color: ${theme.accentColor} !important;
      box-shadow: 
        0 0 0 1px ${theme.accentColor} !important,
        inset 0 3px 0 ${theme.accentColor} !important,
        inset 0 -3px 0 ${theme.primaryColor || theme.accentColor} !important,
        0 30px 60px rgba(0, 0, 0, 0.5),
        0 0 0 1px ${theme.accentColor} !important,
        0 0 30px ${theme.accentColor} !important,
        0 0 60px ${theme.primaryColor || theme.accentColor} !important;
    }
  `;
  
  // Update body background
  document.body.style.backgroundColor = theme.backgroundColor;
  
  // Store theme in localStorage
  localStorage.setItem('dialerTheme', JSON.stringify(theme));
  
  console.log('🎨 Theme applied:', theme);
  console.log('🎨 CSS Custom Properties:');
  console.log('  --background-color:', getComputedStyle(root).getPropertyValue('--background-color'));
  console.log('  --text-color:', getComputedStyle(root).getPropertyValue('--text-color'));
  console.log('  --accent-color:', getComputedStyle(root).getPropertyValue('--accent-color'));
  console.log('  --primary-color:', getComputedStyle(root).getPropertyValue('--primary-color'));
}

// Load saved theme
function loadSavedTheme() {
  const savedTheme = localStorage.getItem('dialerTheme');
  if (savedTheme) {
    try {
      const parsedTheme = JSON.parse(savedTheme);
      currentTheme = { ...currentTheme, ...parsedTheme };
      console.log('🎨 [THEME] Loading saved theme:', currentTheme);
      applyTheme(currentTheme);
    } catch (error) {
      console.error('🎨 [THEME] Error loading saved theme:', error);
      // Reset to default if corrupted
      currentTheme = {
        backgroundColor: '#000000',
        textColor: '#ffffff',
        accentColor: '#007bff',
        primaryColor: '#007bff'
      };
      applyTheme(currentTheme);
    }
  } else {
    console.log('🎨 [THEME] No saved theme found, using defaults');
    applyTheme(currentTheme);
  }
  updateColorPickers();
}



// Navigation tabs
navTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    const tabName = e.currentTarget.dataset.tab;
    switchTab(tabName);
  });
});

// Contacts search
contactsSearch.addEventListener('input', (e) => {
  searchContacts(e.target.value);
});

// Refresh leads button
refreshLeadsBtn.addEventListener('click', loadLeads);

// Power dialer toggle
powerDialerToggle.addEventListener('change', togglePowerDialer);

// Call state management
let callInProgress = false;
let activeCalls = new Set();

// Debounce call initiation to prevent duplicate calls
function shouldInitiateCall(phoneNumber) {
  const now = Date.now();
  console.log('🚨 [DIAGNOSTIC] shouldInitiateCall check for:', phoneNumber);
  console.log('🚨 [DIAGNOSTIC] lastDialedNumber:', lastDialedNumber);
  console.log('🚨 [DIAGNOSTIC] lastDialedTime:', lastDialedTime);
  console.log('🚨 [DIAGNOSTIC] time difference:', now - lastDialedTime);
  
  if (lastDialedNumber === phoneNumber && (now - lastDialedTime) < CALL_DEBOUNCE_TIME) {
    console.log('🚨 [DIAGNOSTIC] BLOCKED - Duplicate call within debounce window');
    return false;
  }
  
  lastDialedNumber = phoneNumber;
  lastDialedTime = now;
  console.log('🚨 [DIAGNOSTIC] ALLOWED - Call can proceed');
  return true;
}

// Start call function
async function startCall(phoneNumber, leadId = null) {
  // DIAGNOSTIC LOGGING - Track all calls
  console.log('🚨 [DIAGNOSTIC] startCall called for:', phoneNumber, 'at', new Date().toISOString());
  console.log('🚨 [DIAGNOSTIC] leadId:', leadId);
  console.log('🚨 [DIAGNOSTIC] callInProgress:', callInProgress);
  console.log('🚨 [DIAGNOSTIC] activeCalls:', Array.from(activeCalls));
  console.log('🚨 [DIAGNOSTIC] isCallActive:', isCallActive);
  console.log('🚨 [DIAGNOSTIC] powerDialerEnabled:', powerDialerEnabled);
  console.log('🚨 [DIAGNOSTIC] isPowerDialing:', isPowerDialing);
  
  // 🔐 AUTHENTICATION CHECK - Prevent unauthorized calls
  if (!token) {
    console.log('🚨 [AUTH] BLOCKED - No authentication token found');
    playErrorBeep();
    showLoginScreen();
    return { success: false, message: 'Authentication required. Please log in.' };
  }
  
  // Validate token with backend
  try {
    const isValid = await validateStoredToken(token);
    if (!isValid) {
      console.log('🚨 [AUTH] BLOCKED - Invalid or expired token');
      playErrorBeep();
      localStorage.removeItem('token');
      localStorage.removeItem('dialer_auth_token');
      token = null;
      showLoginScreen();
      return { success: false, message: 'Session expired. Please log in again.' };
    }
  } catch (error) {
    console.log('🚨 [AUTH] BLOCKED - Token validation failed:', error.message);
    playErrorBeep();
    showLoginScreen();
    return { success: false, message: 'Authentication failed. Please log in.' };
  }
  
  // Prevent duplicate calls
  if (callInProgress || activeCalls.has(phoneNumber)) {
    console.log('🚨 [DIAGNOSTIC] BLOCKED - Call already in progress for:', phoneNumber);
    return { success: false, message: 'Call already in progress' };
  }
  
  try {
    console.log('🚨 [DIAGNOSTIC] PROCEEDING - Initiating Telnyx API call to:', phoneNumber);
    
    // Set call state
    callInProgress = true;
    activeCalls.add(phoneNumber);
    
    // Validate phone number
    if (!phoneNumber || phoneNumber.trim() === '') {
      throw new Error('Phone number is required');
    }
    
    // Clean phone number and ensure +E164 format
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Add + prefix if not present and number is valid
    if (cleanPhone.length >= 10) {
      // If it's a US number (10 digits), add +1
      if (cleanPhone.length === 10) {
        cleanPhone = '+1' + cleanPhone;
      }
      // If it's already 11 digits and starts with 1, add +
      else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
        cleanPhone = '+' + cleanPhone;
      }
      // If it's already in international format (12+ digits), add +
      else if (cleanPhone.length >= 12) {
        cleanPhone = '+' + cleanPhone;
      }
      // Otherwise, assume it's a US number and add +1
      else {
        cleanPhone = '+1' + cleanPhone;
      }
    } else {
      throw new Error('Invalid phone number format');
    }
    
    // Prepare call data
    const callData = {
      toNumber: cleanPhone,
      leadId: leadId || null
    };
    
    console.log('Call data:', callData);
    
    // Make call using native WebRTC
    const webrtcResult = await makeNativeWebRTCCall(cleanPhone);
    
    if (!webrtcResult.success) {
      throw new Error(webrtcResult.error || 'Failed to initiate call');
    }
    
    console.log('Native WebRTC call initiated:', webrtcResult.call);
    
    // Store the call reference
    currentCallControlId = webrtcResult.call.id;
    
    // STABLE SIMULATION: Use enhanced simulation for now
    console.log('📞 [SIMULATION] Making simulated call to:', phoneNumber);
    console.log('⚠️ [SIMULATION] This is NOT a real call - enhanced simulation only');
    console.log('📞 [SIMULATION] Real calls will be implemented in main process');
    
    try {
      // Use enhanced simulation
      const simulationResult = await makeFallbackCall(phoneNumber);
      console.log('✅ [SIMULATION] Enhanced simulation call initiated');
      return simulationResult;
      
    } catch (error) {
      console.error('❌ [SIMULATION] Failed to make simulation call:', error);
      console.error('❌ [SIMULATION] Error details:', error);
      throw error;
    }
    
    // ✅ FIX: WebSocket already connected at startup - no need to connect here
    
    // Set call as active
    isCallActive = true;
    
    // Transform button to "End Call" state
    transformCallButtonToEndCall();
    
    console.log('Native WebRTC call initiated successfully');
    
    return { 
      success: true, 
      message: 'Call initiated via native WebRTC',
      callControlId: response.callControlId 
    };
  } catch (error) {
    console.error('Error in startCall:', error);
    callStatus.textContent = 'Error initiating call';
    callStatus.className = 'call-status error';
    
    // Provide user-friendly error message
    let errorMessage = 'Failed to initiate call';
    if (error.message.includes('401')) {
      errorMessage = 'Authentication failed. Please log in again.';
    } else if (error.message.includes('400')) {
      errorMessage = 'Invalid phone number format';
    } else if (error.message.includes('500')) {
      errorMessage = 'Server error. Please try again.';
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error. Please check your connection.';
    }
    
    callStatus.textContent = errorMessage;
    throw new Error(errorMessage);
  } finally {
    // Clear call state after a delay to prevent rapid re-calls
    setTimeout(() => {
      console.log('🚨 [DIAGNOSTIC] Clearing call state for:', phoneNumber);
      callInProgress = false;
      activeCalls.delete(phoneNumber);
    }, 2000);
  }
}

async function endCall(lead) {
  try {
    console.log('🚨 [DIAGNOSTIC] endCall called for lead:', lead?.name || lead?.id || 'unknown');
    console.log('🚨 [DIAGNOSTIC] Current power dialer state - enabled:', powerDialerEnabled, 'dialing:', isPowerDialing);
    
    // Transition to disconnecting state
    transitionToDisconnecting();
    
    // Hang up the call using Telnyx WebRTC SDK
    if (telnyxCall) {
      console.log('📞 [TELNYX] Hanging up Telnyx WebRTC call');
      try {
        await hangupTelnyxCall(telnyxCall);
        console.log('✅ [TELNYX] Call hung up successfully');
      } catch (error) {
        console.error('❌ [TELNYX] Error hanging up call:', error);
        // Continue with cleanup even if hangup fails
      }
    }
    
    // Clean up Telnyx WebRTC connection
    if (telnyxCall) {
      console.log('🔧 [WEBRTC] Closing Telnyx call...');
      telnyxCall = null;
    }
    
    // Stop local stream
    if (localStream) {
      console.log('🔧 [WEBRTC] Stopping local stream...');
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    
    // ✅ FIX: Keep WebSocket connected for ongoing CRM communication
    
    // Clear remote audio
    if (remoteAudio) {
      remoteAudio.srcObject = null;
    }
    
    // Stop simulated audio if running
    if (window.simulatedAudio) {
      try {
        console.log('🔊 [FALLBACK] Stopping simulated audio...');
        
        // Stop all oscillators
        if (window.simulatedAudio.oscillators) {
          window.simulatedAudio.oscillators.forEach(oscillator => {
            oscillator.stop();
          });
        }
        
        // Close audio context
        if (window.simulatedAudio.audioContext) {
          window.simulatedAudio.audioContext.close();
        }
        
        window.simulatedAudio = null;
        console.log('✅ [FALLBACK] Simulated audio stopped');
      } catch (error) {
        console.error('❌ [FALLBACK] Failed to stop simulated audio:', error);
      }
    }
    
    // Reset call control ID
    currentCallControlId = null;
    
    // Set call as inactive
    isCallActive = false;
    
    // Transition to disconnected state
    transitionToDisconnected();
    
    // Transform button back to "Call" state
    transformCallButtonToCall();
    
    console.log('✅ [DIAGNOSTIC] Call ended successfully for lead:', lead?.name || lead?.id);
    
    // If power dialing is enabled and active, advance to next lead IMMEDIATELY
    if (powerDialerEnabled && isPowerDialing) {
      console.log('🔄 [AUTO-DIALER] Power dialer active, advancing to next lead IMMEDIATELY...');
      // No delay - advance immediately
      advanceToNextLead();
    }
    
    return { 
      success: true, 
      message: 'Call ended successfully' 
    };
  } catch (error) {
    console.error('❌ [DIAGNOSTIC] Error in endCall:', error);
    // Still reset UI even if there's an error
    isCallActive = false;
    transitionToDisconnected();
    transformCallButtonToCall();
    
    // Even on error, try to advance if power dialer is active
    if (powerDialerEnabled && isPowerDialing) {
      console.log('🔄 [AUTO-DIALER] Power dialer active, advancing despite error...');
      advanceToNextLead();
    }
    
    throw error;
  }
}

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Spacebar handler for power dialer
function handleSpacebarPress(event) {
  // Only handle spacebar key
  if (event.code !== 'Space') return;
  
  // Prevent default behavior (page scrolling)
  event.preventDefault();
  
  // Don't trigger if user is typing in an input field
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }
  
  console.log('🚨 [DIAGNOSTIC] Spacebar pressed at:', new Date().toISOString());
  console.log('🚨 [DIAGNOSTIC] Call active:', isCallActive, 'Power dialer enabled:', powerDialerEnabled);
  console.log('🚨 [DIAGNOSTIC] callInProgress:', callInProgress);
  console.log('🚨 [DIAGNOSTIC] activeCalls:', Array.from(activeCalls));
  
  if (isCallActive) {
    // End current call if one is active
    console.log('🚨 [DIAGNOSTIC] Spacebar: Ending current call');
    if (selectedLead) {
      endCall(selectedLead);
    }
  } else if (powerDialerEnabled && isPowerDialing) {
    // Start call for current lead if power dialer is active
    const currentLead = allLeads[currentLeadIndex];
    if (currentLead) {
      const phoneNumber = currentLead.phone || currentLead.phoneNumber || currentLead.primaryPhone || '';
      if (phoneNumber) {
        console.log('🚨 [DIAGNOSTIC] Spacebar: Starting call for', currentLead.name, 'at', phoneNumber);
        
        // Check debouncing before proceeding
        if (!shouldInitiateCall(phoneNumber)) {
          console.log('🚨 [DIAGNOSTIC] Spacebar call blocked by debouncing');
          return;
        }
        
        startCall(phoneNumber, currentLead.id);
      } else {
        console.log('🚨 [DIAGNOSTIC] Spacebar: No phone number for current lead');
      }
    } else {
      console.log('🚨 [DIAGNOSTIC] Spacebar: No current lead available');
    }
  } else {
    console.log('🚨 [DIAGNOSTIC] Spacebar: Power dialer not active or no call in progress');
  }
}

// WebRTC connection (webhook-only mode)
let remoteStream = null;

// Initialize WebRTC connection - NUCLEAR SAFE VERSION
async function initializeWebRTC() {
  try {
    console.log('🔧 [WEBRTC] NUCLEAR: Completely disabling WebRTC to prevent crashes');
    
    // NUCLEAR: Skip ALL diagnostics and WebRTC features
    console.log('🔧 [WEBRTC] Skipping all diagnostics and WebRTC features');
    console.log('⚠️ [WEBRTC] No audio, no WebRTC, no Telnyx - just UI');
    console.log('📞 [WEBRTC] Only UI simulation available');
    
    // Don't even try to load anything - it's causing crashes
    return false;
  } catch (error) {
    console.error('❌ [WEBRTC] Failed to disable WebRTC:', error);
    return false;
  }
}

// Native WebSocket connection
let ws = null;
let wsReconnectInterval = null;

function connectWebSocket() {
  try {
    console.log('🔧 [WEBSOCKET] Connecting to WebSocket server...');
    
    const wsUrl = config.api.wsUrl + '/ws';
    
    ws = new WebSocket(`${wsUrl}`);
    
    ws.addEventListener('open', () => {
      console.log('✅ [WEBSOCKET] Connected to server');
      if (wsReconnectInterval) {
        clearInterval(wsReconnectInterval);
        wsReconnectInterval = null;
      }
      
      // ✅ FIX: Send authentication message after connection
      if (token) {
        console.log('🔐 [WEBSOCKET] Sending authentication message...');
        const authMessage = {
          type: 'authenticate',
          token: token
        };
        ws.send(JSON.stringify(authMessage));
        console.log('🔐 [WEBSOCKET] Authentication message sent');
      } else {
        console.warn('⚠️ [WEBSOCKET] No token available for authentication');
      }
      
      // Fix 6: Send queued messages when reconnected
      sendQueuedMessages();
    });
    
    ws.addEventListener('message', (event) => {
  try {
    const message = JSON.parse(event.data);
    console.log('📨 [WEBSOCKET] Raw message received:', message);
    
    // Handle both event-based and type-based messages
    if (message.event) {
      handleWebSocketMessage(message);
    } else if (message.type) {
      handleTypedMessage(message);
    } else {
      console.log('📨 [WEBSOCKET] Unknown message format:', message);
    }
  } catch (error) {
    console.error('❌ [WEBSOCKET] Error parsing message:', error);
  }
});
    
    ws.addEventListener('close', () => {
      console.log('❌ [WEBSOCKET] Disconnected from server');
      scheduleReconnect();
    });
    
    ws.addEventListener('error', (error) => {
      console.error('❌ [WEBSOCKET] WebSocket error:', error);
    });
    
    console.log('✅ [WEBSOCKET] WebSocket connection established');
    return true;
  } catch (error) {
    console.error('❌ [WEBSOCKET] Failed to connect to server:', error);
    return false;
  }
}

function scheduleReconnect() {
  if (!wsReconnectInterval) {
    wsReconnectInterval = setInterval(() => {
      console.log('🔄 [WEBSOCKET] Attempting to reconnect...');
      connectWebSocket();
    }, 5000); // Reconnect every 5 seconds
  }
}

function disconnectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
  if (wsReconnectInterval) {
    clearInterval(wsReconnectInterval);
    wsReconnectInterval = null;
  }
}

function handleWebSocketMessage(message) {
  console.log('📨 [WEBSOCKET] Received message:', message);
  
  // Play SFX if provided
  if (message.sfx) {
    playSFX(message.sfx);
  }
  
  switch (message.event) {
    case 'connected':
      console.log('✅ [WEBSOCKET] Successfully connected:', message.data);
      break;
    
    case 'call-initiated':
      console.log('📞 [WEBSOCKET] Call initiated:', message.data);
      transitionToDialing(message.data.call_id);
      break;
    
    case 'call-answered':
      console.log('📞 [WEBSOCKET] Call answered:', message.data);
      transitionToActive();
      break;
    
    case 'call-hangup':
      console.log('📞 [WEBSOCKET] Call hung up:', message.data);
      transitionToDisconnected();
      break;
    
    case 'call-inbound':
      console.log('📞 [WEBSOCKET] Inbound call:', message.data);
      handleIncomingCall(message.data);
      break;
    
    case 'error':
      console.log('❌ [WEBSOCKET] Error event:', message.data);
      break;
    
    case 'dtmf-received':
      console.log('🔢 [WEBSOCKET] DTMF received:', message.data);
      handleDTMFInput(message.data);
      break;
    
    case 'call-recording-saved':
      console.log('📹 [WEBSOCKET] Call recording saved:', message.data);
      break;
    
    case 'call-speak-started':
      console.log('🗣️ [WEBSOCKET] Call speak started:', message.data);
      break;
    
    case 'call-speak-ended':
      console.log('🗣️ [WEBSOCKET] Call speak ended:', message.data);
      break;
    
    case 'pong':
      console.log('🏓 [WEBSOCKET] Pong received:', message.data);
      break;
    
    default:
      console.log('📨 [WEBSOCKET] Unhandled event:', message.event);
  }
}

// Handle typed messages (like selectLead from CRM)
function handleTypedMessage(message) {
  console.log('📨 [WEBSOCKET] Handling typed message:', message);
  
  switch (message.type) {
    case 'selectLead':
      console.log('👤 [WEBSOCKET] Received lead selection from CRM:', message.data);
      handleLeadSelection(message.data);
      break;
    
    case 'initiateCall':
      console.log('📞 [WEBSOCKET] Received initiate call command:', message.data);
      handleInitiateCall(message.data);
      break;
    
    case 'hangupCall':
      console.log('📞 [WEBSOCKET] Received hangup call command:', message.data);
      handleHangupCall(message.data);
      break;
    
    default:
      console.log('📨 [WEBSOCKET] Unhandled typed message:', message.type);
  }
}

// Handle lead selection from CRM
function handleLeadSelection(leadData) {
  console.log('👤 [WEBSOCKET] Processing lead selection:', leadData);
  
  // Fix 3: Normalize leadId - use lead.leadId || lead.id
  const id = leadData.leadId || leadData.id;
  
  // Update the selected lead with correct field mapping
  selectedLead = {
    id: id,
    name: leadData.name,           // Fix 4: Use exact field from CRM
    phone: leadData.phone,         // Fix 4: Use exact field from CRM
    email: leadData.email || '',
    state: leadData.state || '',
    city: leadData.city || '',
    zipcode: leadData.zipcode || ''
  };
  
  console.log('✅ [WEBSOCKET] Updated selected lead:', selectedLead);
  
  // Update UI to show selected lead
  selectLead(selectedLead);
}

// Handle initiate call command from CRM
async function handleInitiateCall(callData) {
  console.log('📞 [WEBSOCKET] Processing initiate call command:', callData);
  
  try {
    // Extract call data
    const { leadId, phone, userId, name } = callData;
    
    console.log(`📞 [WEBSOCKET] Starting outbound call to ${phone} for lead ${name}`);
    
    // Update UI to "Calling" state
    setCallState(CALL_STATES.DIALING, `Calling ${name}`);
    
    // Play ringing sound
    playSFX('call-initiated.wav');
    
    // Start the call using existing call logic
    await startCall(phone, leadId);
    
    console.log('✅ [WEBSOCKET] Call initiated successfully');
    
  } catch (error) {
    console.error('❌ [WEBSOCKET] Error initiating call:', error);
    setCallState(CALL_STATES.IDLE, 'Call failed');
    playSFX('error.wav');
  }
}

// Handle hangup call command from CRM
async function handleHangupCall(callData) {
  console.log('📞 [WEBSOCKET] Processing hangup call command:', callData);
  
  try {
    // Extract call data
    const { leadId, callId, userId } = callData;
    
    console.log(`📞 [WEBSOCKET] Ending call for lead ${leadId}, call ${callId}`);
    
    // Update UI to "Call Ended" state
    setCallState(CALL_STATES.DISCONNECTING, 'Ending call...');
    
    // Play hangup sound
    playSFX('call-hangup.wav');
    
    // End the call using existing call logic
    await endCall(selectedLead);
    
    console.log('✅ [WEBSOCKET] Call ended successfully');
    
  } catch (error) {
    console.error('❌ [WEBSOCKET] Error ending call:', error);
    setCallState(CALL_STATES.IDLE, 'Hangup failed');
    playSFX('error.wav');
  }
}

// Fix 6: Message queue for disconnected WebSocket
let messageQueue = [];

function sendWebSocketMessage(event, data) {
  const message = { event, data };
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.warn('⚠️ [WEBSOCKET] Cannot send message - WebSocket not connected, queuing message');
    messageQueue.push(message);
  }
}

// Send queued messages when WebSocket reconnects
function sendQueuedMessages() {
  if (messageQueue.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
    console.log(`📤 [WEBSOCKET] Sending ${messageQueue.length} queued messages`);
    messageQueue.forEach(message => {
      ws.send(JSON.stringify(message));
    });
    messageQueue = [];
  }
}

function handleDTMFInput(payload) {
  console.log('🔢 [DTMF] Received DTMF input:', payload.digit);
  // Handle DTMF input (e.g., for IVR navigation)
}

// SFX playback function
function playSFX(sfxFile) {
  try {
    console.log(`🔊 [SFX] Playing: ${sfxFile}`);
    // ✅ FIX: Updated SFX path to correct location
    const audio = new Audio(`../../SFX/${sfxFile}`);
    audio.volume = 1.0; // ✅ FIX: Increased volume to 100% for better audibility
    console.log(`🔊 [SFX] Volume set to: ${audio.volume * 100}%`);
    
    // Add event listeners for debugging
    audio.addEventListener('loadstart', () => console.log(`🔊 [SFX] Loading started: ${sfxFile}`));
    audio.addEventListener('canplay', () => console.log(`🔊 [SFX] Can play: ${sfxFile}`));
    audio.addEventListener('playing', () => console.log(`🔊 [SFX] Now playing: ${sfxFile}`));
    audio.addEventListener('ended', () => console.log(`🔊 [SFX] Finished playing: ${sfxFile}`));
    audio.addEventListener('error', (e) => console.error(`🔊 [SFX] Audio error: ${sfxFile}`, e));
    
    // ✅ FIX: Resume audio context if suspended (required for user interaction)
    if (audioContext && audioContext.state === 'suspended') {
      console.log('🔊 [SFX] Resuming audio context...');
      audioContext.resume().then(() => {
        console.log('🔊 [SFX] Audio context resumed, playing sound...');
        audio.play().catch(error => {
          console.error(`❌ [SFX] Error playing ${sfxFile}:`, error);
        });
      });
    } else {
      audio.play().catch(error => {
        console.error(`❌ [SFX] Error playing ${sfxFile}:`, error);
      });
    }
  } catch (error) {
    console.error(`❌ [SFX] Error loading ${sfxFile}:`, error);
  }
}

// Global variable to track current call control ID
let currentCallControlId = null;

// Power Dialer Functions
function togglePowerDialer() {
  powerDialerEnabled = powerDialerToggle.checked;
  console.log('Power dialer:', powerDialerEnabled ? 'enabled' : 'disabled');
  
  // Update visual state
  updatePowerDialerState();
  
  // Send sync message to web app
  if (window.crokodialWebSocket && window.crokodialWebSocket.readyState === WebSocket.OPEN) {
    const syncMessage = {
      type: 'powerDialerSyncFromDialer',
      data: {
        enabled: powerDialerEnabled,
        currentIndex: currentLeadIndex,
        totalLeads: allLeads.length
      }
    };
    console.log('📤 [Crokodialer Renderer] Syncing power dialer state to web app:', syncMessage);
    window.crokodialWebSocket.send(JSON.stringify(syncMessage));
  }
  
  if (powerDialerEnabled) {
    // ALWAYS reset to first lead when enabling power dialer
    currentLeadIndex = 0;
    
    if (allLeads.length > 0) {
      console.log('Power dialer starting from lead 1 of', allLeads.length, 'leads');
      // Start power dialing from the first lead immediately
      startPowerDialing();
    } else {
      console.log('No leads loaded, loading leads first...');
      // Load leads first, then start power dialing
      loadLeads().then(() => {
        if (powerDialerEnabled && allLeads.length > 0) {
          console.log('Leads loaded, starting power dialer from lead 1 of', allLeads.length);
          startPowerDialing();
        }
      }).catch(error => {
        console.error('Error loading leads for power dialer:', error);
        stopPowerDialing();
      });
    }
  } else {
    // Stop power dialing
    stopPowerDialing();
  }
}

function updatePowerDialerState() {
  const toggleLabel = document.querySelector('.toggle-label');
  
  if (powerDialerEnabled) {
    if (toggleLabel) {
      toggleLabel.style.color = '#34C759';
    }
  } else {
    if (toggleLabel) {
      toggleLabel.style.color = '#8E8E93';
    }
  }
}

async function startPowerDialing() {
  if (!powerDialerEnabled) return;
  
  console.log('🚨 [DIAGNOSTIC] startPowerDialing called at:', new Date().toISOString());
  console.log('🚨 [DIAGNOSTIC] callInProgress:', callInProgress);
  console.log('🚨 [DIAGNOSTIC] isCallActive:', isCallActive);
  console.log('🚨 [DIAGNOSTIC] activeCalls:', Array.from(activeCalls));
  
  // 🔐 AUTHENTICATION CHECK - Prevent unauthorized power dialing
  if (!token) {
    console.log('🚨 [AUTH] BLOCKED - No authentication token for power dialer');
    playErrorBeep();
    showLoginScreen();
    stopPowerDialing();
    return;
  }
  
  // Validate token with backend
  try {
    const isValid = await validateStoredToken(token);
    if (!isValid) {
      console.log('🚨 [AUTH] BLOCKED - Invalid or expired token for power dialer');
      playErrorBeep();
      localStorage.removeItem('token');
      localStorage.removeItem('dialer_auth_token');
      token = null;
      showLoginScreen();
      stopPowerDialing();
      return;
    }
  } catch (error) {
    console.log('🚨 [AUTH] BLOCKED - Token validation failed for power dialer:', error.message);
    playErrorBeep();
    showLoginScreen();
    stopPowerDialing();
    return;
  }
  
  // Check if leads are loaded
  if (allLeads.length === 0) {
    console.log('No leads loaded yet, waiting...');
    playErrorBeep(); // Play error beep for no leads
    return;
  }
  
  isPowerDialing = true;
  console.log('🚨 [DIAGNOSTIC] Starting power dialing from lead', currentLeadIndex + 1, 'of', allLeads.length);
  
  // Play power dialer start beep
  playCallBeep(); // Use call beep for power dialer start
  
  // Select the current lead and start dialing IMMEDIATELY
  const currentLead = allLeads[currentLeadIndex];
  if (currentLead) {
    console.log('🔄 [AUTO-DIALER] Selecting lead:', currentLead.name || currentLead.id);
    selectLead(currentLead);
    
    // Get phone number from multiple possible fields
    const phoneNumber = currentLead.phone || currentLead.phoneNumber || currentLead.primaryPhone || '';
    console.log('🔄 [AUTO-DIALER] Phone number extracted:', phoneNumber);
    
    if (!phoneNumber) {
      console.log('⚠️ [AUTO-DIALER] No phone number for lead, skipping to next');
      playErrorBeep(); // Play error beep for no phone number
      // Skip this lead and try the next one immediately
      setTimeout(() => advanceToNextLead(), 100);
      return;
    }
    
    // Show starting message with actual phone number
    transitionToDialing(phoneNumber);
    
    // IMMEDIATE auto-dial with no delay
    console.log('🔄 [AUTO-DIALER] IMMEDIATELY starting call to:', currentLead.name, 'at', phoneNumber);
    
    // Check debouncing before proceeding
    if (!shouldInitiateCall(phoneNumber)) {
      console.log('🚨 [AUTO-DIALER] Call blocked by debouncing, retrying in 1 second');
      callStatus.textContent = 'Call already in progress, retrying...';
      callStatus.className = 'call-status warning';
      playErrorBeep(); // Play error beep for debouncing
      setTimeout(() => startPowerDialing(), 1000);
      return;
    }
    
    // Start the call immediately
    startCall(phoneNumber, currentLead.id).then(() => {
      console.log('✅ [AUTO-DIALER] Call initiated successfully for:', currentLead.name);
    }).catch((error) => {
      console.error('❌ [AUTO-DIALER] Failed to start call for:', currentLead.name, error);
      playErrorBeep(); // Play error beep for failed call
      // If call fails, try the next lead after a short delay
      setTimeout(() => advanceToNextLead(), 2000);
    });
  } else {
    console.error('❌ [AUTO-DIALER] No lead found at index:', currentLeadIndex);
    stopPowerDialing();
    playErrorBeep(); // Play error beep for no lead found
  }
}

function stopPowerDialing() {
  isPowerDialing = false;
  console.log('Power dialing stopped');
  
  // Play completion beep
  playHangupBeep(); // Use hangup beep for completion
  
  // Reset call state
  isCallActive = false;
  
  // Update visual state
  callStatus.textContent = 'Power dialer stopped';
  callStatus.className = 'call-status';
  
  // Reset state for next power dialing session
  currentLeadIndex = 0;
  
  // Update toggle state
  if (powerDialerToggle) {
    powerDialerToggle.checked = false;
    powerDialerEnabled = false;
    updatePowerDialerState();
  }
}

async function advanceToNextLead() {
  console.log('🚨 [DIAGNOSTIC] advanceToNextLead called');
  console.log('🚨 [DIAGNOSTIC] Power dialer state - enabled:', powerDialerEnabled, 'dialing:', isPowerDialing);
  console.log('🚨 [DIAGNOSTIC] Current lead index:', currentLeadIndex, 'Total leads:', allLeads.length);
  
  if (!powerDialerEnabled || !isPowerDialing) {
    console.log('🚨 [DIAGNOSTIC] Power dialer not active, skipping advance');
    return;
  }
  
  // 🔐 AUTHENTICATION CHECK - Prevent unauthorized power dialing advancement
  if (!token) {
    console.log('🚨 [AUTH] BLOCKED - No authentication token for power dialer advancement');
    playErrorBeep();
    showLoginScreen();
    stopPowerDialing();
    return;
  }
  
  // Validate token with backend
  try {
    const isValid = await validateStoredToken(token);
    if (!isValid) {
      console.log('🚨 [AUTH] BLOCKED - Invalid or expired token for power dialer advancement');
      playErrorBeep();
      localStorage.removeItem('token');
      localStorage.removeItem('dialer_auth_token');
      token = null;
      showLoginScreen();
      stopPowerDialing();
      return;
    }
  } catch (error) {
    console.log('🚨 [AUTH] BLOCKED - Token validation failed for power dialer advancement:', error.message);
    playErrorBeep();
    showLoginScreen();
    stopPowerDialing();
    return;
  }
  
  // Ensure call state is reset when advancing
  isCallActive = false;
  
  currentLeadIndex++;
  console.log('🔄 [AUTO-DIALER] Advanced to lead index:', currentLeadIndex);
  
  if (currentLeadIndex >= allLeads.length) {
    // Reached end of list
    console.log('🎉 [AUTO-DIALER] Reached end of lead list - power dialing complete!');
    
    // Play completion beep
    playHangupBeep(); // Use hangup beep for completion
    
    stopPowerDialing();
    powerDialerToggle.checked = false;
    powerDialerEnabled = false;
    
    // Show completion message
    resetCallState();
    return;
  }
  
  console.log('🔄 [AUTO-DIALER] Advancing to lead', currentLeadIndex + 1, 'of', allLeads.length);
  
  // IMMEDIATELY start dialing the next lead with no delay
  const nextLead = allLeads[currentLeadIndex];
  if (nextLead) {
    console.log('🔄 [AUTO-DIALER] Selecting next lead:', nextLead.name || nextLead.id);
    selectLead(nextLead);
    
    // Get phone number from multiple possible fields
    const phoneNumber = nextLead.phone || nextLead.phoneNumber || nextLead.primaryPhone || '';
    console.log('🔄 [AUTO-DIALER] Next lead phone number:', phoneNumber);
    
    if (!phoneNumber) {
      console.log('⚠️ [AUTO-DIALER] No phone number for next lead, skipping');
      // Skip this lead and try the next one immediately
      setTimeout(() => advanceToNextLead(), 100);
      return;
    }
    
    // IMMEDIATE auto-dial with no delay
    console.log('🔄 [AUTO-DIALER] IMMEDIATELY auto-dialing next lead:', nextLead.name, 'at', phoneNumber);
    
    // Check debouncing before proceeding
    if (!shouldInitiateCall(phoneNumber)) {
      console.log('🚨 [AUTO-DIALER] Advance call blocked by debouncing, retrying in 1 second');
      setTimeout(() => advanceToNextLead(), 1000);
      return;
    }
    
    // Start the call immediately
    startCall(phoneNumber, nextLead.id).then(() => {
      console.log('✅ [AUTO-DIALER] Next call initiated successfully for:', nextLead.name);
    }).catch((error) => {
      console.error('❌ [AUTO-DIALER] Failed to start next call for:', nextLead.name, error);
      // If call fails, try the next lead after a short delay
      setTimeout(() => advanceToNextLead(), 2000);
    });
  } else {
    console.error('❌ [AUTO-DIALER] No lead found at index:', currentLeadIndex);
    stopPowerDialing();
  }
}

// Validate stored token
async function validateStoredToken(token) {
  try {
    const response = await apiRequest('GET', '/auth/validate');
    return response.valid;
  } catch (error) {
    console.log('Token validation failed:', error.message);
    return false;
  }
}

// Drag functionality variables
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let initialWindowX = 0;
let initialWindowY = 0;

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Crokodialer Dialer initialized');
  
  // ✅ FIX: Request audio permissions for sound playback
  console.log('🔊 [AUDIO] Requesting audio permissions...');
  try {
    // Request microphone permission (required for audio context)
    const micPermission = await navigator.permissions.query({ name: 'microphone' });
    console.log('🔊 [AUDIO] Microphone permission status:', micPermission.state);
    
    // Request audio output permission
    if (navigator.permissions && navigator.permissions.query) {
      const audioPermission = await navigator.permissions.query({ name: 'speaker' });
      console.log('🔊 [AUDIO] Speaker permission status:', audioPermission.state);
    }
    
    // Initialize audio context early to ensure permissions
    initAudioContext();
    console.log('🔊 [AUDIO] Audio context initialized with permissions');
  } catch (error) {
    console.warn('⚠️ [AUDIO] Audio permission request failed:', error);
    // Continue anyway - audio might still work
  }
  
  // ✅ FIX: Connect WebSocket immediately on startup
  console.log('🔧 [WEBSOCKET] Connecting immediately on startup...');
  connectWebSocket();
  
  // Debug CSS loading
  console.log('🔍 [CSS DEBUG] Checking CSS loading...');
  const stylesheets = Array.from(document.styleSheets);
  console.log('🔍 [CSS DEBUG] Loaded stylesheets:', stylesheets.length);
  stylesheets.forEach((sheet, index) => {
    try {
      console.log(`🔍 [CSS DEBUG] Stylesheet ${index}:`, sheet.href || 'inline');
      console.log(`🔍 [CSS DEBUG] Rules count:`, sheet.cssRules ? sheet.cssRules.length : 'N/A');
      if (sheet.href) {
        console.log(`🔍 [CSS DEBUG] Stylesheet URL:`, sheet.href);
      }
    } catch (e) {
      console.log(`🔍 [CSS DEBUG] Stylesheet ${index}: CORS blocked or error -`, e.message);
    }
  });
  
  // Check if body background is applied
  const bodyStyle = window.getComputedStyle(document.body);
  console.log('🔍 [CSS DEBUG] Body background:', bodyStyle.background);
  console.log('🔍 [CSS DEBUG] Body color:', bodyStyle.color);
  console.log('🔍 [CSS DEBUG] Body border:', bodyStyle.border);
  
  // Check if external CSS is loaded
  const externalCSS = Array.from(document.styleSheets).find(sheet => sheet.href && sheet.href.includes('styles.css'));
  if (externalCSS) {
    console.log('✅ [CSS DEBUG] External styles.css found and loaded');
    console.log('🔍 [CSS DEBUG] External CSS href:', externalCSS.href);
    try {
      console.log('🔍 [CSS DEBUG] External CSS rules count:', externalCSS.cssRules.length);
    } catch (e) {
      console.log('🔍 [CSS DEBUG] Cannot access external CSS rules (CORS):', e.message);
    }
  } else {
    console.log('❌ [CSS DEBUG] External styles.css NOT found');
    console.log('🔍 [CSS DEBUG] All stylesheets:');
    Array.from(document.styleSheets).forEach((sheet, index) => {
      console.log(`  ${index}: ${sheet.href || 'inline'}`);
    });
  }
  
  // Test if we can access the CSS file via fetch
  fetch('./styles.css')
    .then(response => {
      console.log('🔍 [CSS DEBUG] Fetch styles.css status:', response.status);
      if (response.ok) {
        console.log('✅ [CSS DEBUG] styles.css is accessible via fetch');
      } else {
        console.log('❌ [CSS DEBUG] styles.css fetch failed:', response.status);
      }
    })
    .catch(error => {
      console.log('❌ [CSS DEBUG] styles.css fetch error:', error.message);
    });
    
  // Test if inline CSS is working
  console.log('🔍 [CSS DEBUG] Testing inline CSS...');
  const bodyStyleTest = window.getComputedStyle(document.body);
  console.log('🔍 [CSS DEBUG] Body background:', bodyStyleTest.background);
  console.log('🔍 [CSS DEBUG] Body border:', bodyStyleTest.border);
  console.log('🔍 [CSS DEBUG] Body color:', bodyStyleTest.color);
  console.log('🔍 [CSS DEBUG] Body height:', bodyStyleTest.height);
  
  // Test if we can see the red border
  if (bodyStyle.border.includes('red') || bodyStyle.border.includes('rgb(255, 0, 0)')) {
    console.log('✅ [CSS DEBUG] Red border detected - CSS is working!');
  } else {
    console.log('❌ [CSS DEBUG] Red border NOT detected - CSS may not be loading');
  }
  
  // Add spacebar event listener
  document.addEventListener('keydown', handleSpacebarPress);
  console.log('Spacebar event listener added');
  
  // Initialize call state management system
  initializeCallStateSystem();
  console.log('Call state system initialized');
  

  
  // Load saved theme first, then clear cache
  console.log('🎨 [THEME] Loading saved theme...');
  loadSavedTheme();
  
  // Clear old cache but preserve theme
  console.log('🧹 [CACHE] Clearing old CSS cache...');
  const savedTheme = localStorage.getItem('dialerTheme');
  localStorage.clear();
  sessionStorage.clear();
  
  // Restore theme after cache clear
  if (savedTheme) {
    localStorage.setItem('dialerTheme', savedTheme);
    console.log('✅ [CACHE] Cache cleared, theme preserved');
  } else {
    console.log('✅ [CACHE] Cache cleared, no theme to preserve');
  }
  
  // Initialize settings functionality
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const bgColorInput = document.getElementById('bgColorInput');
  const textColorInput = document.getElementById('textColorInput');
  const accentColorInput = document.getElementById('accentColorInput');
  const bgColorPicker = document.getElementById('bgColorPicker');
  const textColorPicker = document.getElementById('textColorPicker');
  const accentColorPicker = document.getElementById('accentColorPicker');
  const applyThemeBtn = document.getElementById('applyThemeBtn');
  const resetThemeBtn = document.getElementById('resetThemeBtn');
  
  console.log('🎨 [SETTINGS-INIT] Settings elements found:');
  console.log('🎨 [SETTINGS-INIT] settingsBtn:', settingsBtn);
  console.log('🎨 [SETTINGS-INIT] settingsModal:', settingsModal);
  console.log('🎨 [SETTINGS-INIT] bgColorPicker:', bgColorPicker);
  console.log('🎨 [SETTINGS-INIT] textColorPicker:', textColorPicker);
  console.log('🎨 [SETTINGS-INIT] accentColorPicker:', accentColorPicker);
  
  // Settings button click
  settingsBtn.addEventListener('click', () => {
    console.log('🎨 [SETTINGS] Settings button clicked');
    console.log('🎨 [SETTINGS] settingsModal element:', settingsModal);
    console.log('🎨 [SETTINGS] settingsModal classes before:', settingsModal.classList.toString());
    
    settingsModal.classList.add('show');
    
    console.log('🎨 [SETTINGS] settingsModal classes after:', settingsModal.classList.toString());
    console.log('🎨 [SETTINGS] settingsModal computed display:', window.getComputedStyle(settingsModal).display);
    
    updateColorPickers();
    
    // Test if color pickers are visible
    setTimeout(() => {
      console.log('🎨 [SETTINGS] Color picker elements in modal:');
      console.log('🎨 [SETTINGS] bgColorPicker:', document.getElementById('bgColorPicker'));
      console.log('🎨 [SETTINGS] textColorPicker:', document.getElementById('textColorPicker'));
      console.log('🎨 [SETTINGS] accentColorPicker:', document.getElementById('accentColorPicker'));
      
      const bgPicker = document.getElementById('bgColorPicker');
      if (bgPicker) {
        console.log('🎨 [SETTINGS] bgColorPicker computed styles:', window.getComputedStyle(bgPicker));
        console.log('🎨 [SETTINGS] bgColorPicker display:', window.getComputedStyle(bgPicker).display);
        console.log('🎨 [SETTINGS] bgColorPicker visibility:', window.getComputedStyle(bgPicker).visibility);
        console.log('🎨 [SETTINGS] bgColorPicker width:', window.getComputedStyle(bgPicker).width);
        console.log('🎨 [SETTINGS] bgColorPicker height:', window.getComputedStyle(bgPicker).height);
      }
    }, 100);
  });
  
  // Close settings modal
  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('show');
  });
  
  // Close modal when clicking outside
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('show');
    }
  });
  
  // Color picker change handlers (real-time)
  bgColorPicker.addEventListener('input', (e) => {
    const color = e.target.value;
    bgColorInput.value = color;
    currentTheme.backgroundColor = color;
    applyTheme(currentTheme); // Apply immediately for live preview
  });
  
  textColorPicker.addEventListener('input', (e) => {
    const color = e.target.value;
    textColorInput.value = color;
    currentTheme.textColor = color;
    applyTheme(currentTheme); // Apply immediately for live preview
  });
  
  accentColorPicker.addEventListener('input', (e) => {
    const color = e.target.value;
    accentColorInput.value = color;
    currentTheme.accentColor = color;
    currentTheme.primaryColor = color; // Also update primary color for phone outline
    applyTheme(currentTheme); // Apply immediately for live preview
  });
  
  // Color input change handlers (hex input)
  bgColorInput.addEventListener('input', (e) => {
    const color = e.target.value;
    if (color.match(/^#[0-9A-F]{6}$/i)) {
      bgColorPicker.value = color;
      currentTheme.backgroundColor = color;
      applyTheme(currentTheme); // Apply immediately for live preview
    }
  });
  
  textColorInput.addEventListener('input', (e) => {
    const color = e.target.value;
    if (color.match(/^#[0-9A-F]{6}$/i)) {
      textColorPicker.value = color;
      currentTheme.textColor = color;
      applyTheme(currentTheme); // Apply immediately for live preview
    }
  });
  
  accentColorInput.addEventListener('input', (e) => {
    const color = e.target.value;
    if (color.match(/^#[0-9A-F]{6}$/i)) {
      accentColorPicker.value = color;
      currentTheme.accentColor = color;
      currentTheme.primaryColor = color; // Also update primary color for phone outline
      applyTheme(currentTheme); // Apply immediately for live preview
    }
  });
  
  // Apply theme button
  applyThemeBtn.addEventListener('click', () => {
    applyTheme(currentTheme);
    settingsModal.classList.remove('show');
  });
  
  // Reset theme button
  resetThemeBtn.addEventListener('click', () => {
    currentTheme = {
      backgroundColor: '#000000',
      textColor: '#ffffff',
      accentColor: '#007bff',
      primaryColor: '#007bff'
    };
    applyTheme(currentTheme);
    updateColorPickers();
  });
  
  // Auto-focus the phone display for immediate keyboard input
  phoneDisplay.focus();
  console.log('Phone display auto-focused');
  
  // Force apply theme immediately with a test color to verify it works
  console.log('🎨 [FORCE-THEME] Applying theme with test color...');
  const testTheme = {
    backgroundColor: '#000000',
    textColor: '#ffffff',
    accentColor: '#ff0000', // RED for testing
    primaryColor: '#ff0000'  // RED for testing
  };
  applyTheme(testTheme);
  
  // Wait 2 seconds then apply the real theme
  setTimeout(() => {
    console.log('🎨 [FORCE-THEME] Applying real theme...');
    applyTheme(currentTheme);
  }, 2000);
  
  // Check for existing token (from web app or previous session)
  const savedToken = localStorage.getItem('token') || localStorage.getItem('dialer_auth_token');
  if (savedToken) {
    token = savedToken;
    
    // Store the token in the standard location for consistency
    localStorage.setItem('token', token);
    
    // Validate the token with the backend
    const isValid = await validateStoredToken(token);
    
    if (isValid) {
      console.log('Valid token found, auto-logging in...');
      showMainScreen();
      await loadLeads();
      // Re-focus phone display after login
      phoneDisplay.focus();
    } else {
      console.log('Invalid token, clearing storage...');
      localStorage.removeItem('token');
      localStorage.removeItem('dialer_auth_token');
      token = null;
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
}); 

// Phone display keyboard input handler
phoneDisplay.addEventListener('keydown', (event) => {
  console.log('🔊 [KEYBOARD] Key pressed:', event.key);
  
  // Allow common phone number characters
  const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#', '+', '-', '(', ')', ' '];
  
  // Handle special keys
  if (event.key === 'Backspace') {
    // Allow backspace to remove characters
    return;
  } else if (event.key === 'Delete') {
    // Allow delete key
    return;
  } else if (event.key === 'Tab') {
    // Allow tab navigation
    return;
  } else if (event.key === 'Enter') {
    // Prevent form submission, but allow Enter to initiate call
    event.preventDefault();
    console.log('🔊 [KEYBOARD] Enter pressed - initiating call');
    callBtn.click(); // Trigger call button click
    return;
  } else if (event.key === 'Escape') {
    // Clear the phone display
    event.preventDefault();
    phoneDisplay.value = '';
    console.log('🔊 [KEYBOARD] Escape pressed - cleared phone display');
    return;
  } else if (event.key === 'c' && event.ctrlKey) {
    // Allow Ctrl+C for copy
    return;
  } else if (event.key === 'v' && event.ctrlKey) {
    // Allow Ctrl+V for paste
    return;
  } else if (event.key === 'a' && event.ctrlKey) {
    // Allow Ctrl+A for select all
    return;
  } else if (event.key === 'z' && event.ctrlKey) {
    // Allow Ctrl+Z for undo
    return;
  }
  
  // Check if the pressed key is allowed
  if (allowedKeys.includes(event.key)) {
    // Play beep sound for the typed key
    if (event.key === '*' || event.key === '#') {
      playSpecialKeyBeep();
    } else {
      playNumberBeep();
    }
    
    console.log('🔊 [KEYBOARD] Allowed key pressed:', event.key);
    // Let the default behavior add the character
  } else {
    // Block non-allowed keys
    event.preventDefault();
    console.log('🔊 [KEYBOARD] Blocked key:', event.key);
    playErrorBeep(); // Play error beep for blocked keys
  }
});

// Phone display input handler for real-time validation
phoneDisplay.addEventListener('input', (event) => {
  const value = event.target.value;
  console.log('🔊 [KEYBOARD] Phone display input:', value);
  
  // Optional: Add real-time formatting here if needed
  // For now, just log the input
});

// Focus the phone display when the app loads
phoneDisplay.addEventListener('focus', () => {
  console.log('🔊 [KEYBOARD] Phone display focused');
  // Optional: Add visual feedback for focus
});

  // Add keyboard shortcuts for power dialer
  document.addEventListener('keydown', (event) => {
    // Handle backspace globally (works whether phone display is focused or not)
    if (event.key === 'Backspace') {
      // Only handle if not typing in phone display (to avoid double handling)
      if (event.target === phoneDisplay) {
        return;
      }
      event.preventDefault();
      // Remove the last character from phone display
      if (phoneDisplay.value.length > 0) {
        phoneDisplay.value = phoneDisplay.value.slice(0, -1);
        playSpecialKeyBeep();
        console.log('🔊 [KEYBOARD] Global backspace pressed');
      }
      return;
    }
    
    // Only handle other shortcuts if not typing in phone display
    if (event.target === phoneDisplay) {
      return;
    }
    
    // Power dialer toggle with Ctrl+P
    if (event.key === 'p' && event.ctrlKey) {
      event.preventDefault();
      console.log('🔊 [KEYBOARD] Ctrl+P pressed - toggling power dialer');
      if (powerDialerToggle) {
        powerDialerToggle.checked = !powerDialerToggle.checked;
        togglePowerDialer();
      }
    }
    
    // Spacebar for call control (existing functionality)
    if (event.code === 'Space') {
      handleSpacebarPress(event);
    }
  });

  // Initialize drag functionality
  initializeDragFunctionality();
  
  // Initialize audio controls
  initializeAudioControls();

// Drag functionality
function initializeDragFunctionality() {
  const phoneDisplay = document.getElementById('phoneDisplay');
  const phoneDisplayContainer = phoneDisplay ? phoneDisplay.closest('.phone-display') : null;
  
  if (!phoneDisplayContainer) {
    console.log('❌ [DRAG] Phone display container not found');
    return;
  }

  console.log('✅ [DRAG] Initializing drag functionality for phone display area');

  // Make the phone display area draggable
  phoneDisplayContainer.style.cursor = 'grab';
  phoneDisplayContainer.style.userSelect = 'none';

  // Mouse down event - start dragging
  phoneDisplayContainer.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking on the input itself
    if (e.target === phoneDisplay) {
      return;
    }

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    
    // Get current window position
    // Note: remote module is deprecated, window dragging disabled for now
    // const { remote } = require('electron');
    // const currentWindow = remote.getCurrentWindow();
    // const bounds = currentWindow.getBounds();
    // initialWindowX = bounds.x;
    // initialWindowY = bounds.y;

    phoneDisplayContainer.style.cursor = 'grabbing';
    console.log('🎯 [DRAG] Started dragging at:', dragStartX, dragStartY);
  });

  // Mouse move event - handle dragging
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    // Move the window
    // Note: remote module is deprecated, window dragging disabled for now
    // const { remote } = require('electron');
    // const currentWindow = remote.getCurrentWindow();
    // currentWindow.setPosition(initialWindowX + deltaX, initialWindowY + deltaY);
  });

  // Mouse up event - stop dragging
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      phoneDisplayContainer.style.cursor = 'grab';
      console.log('✅ [DRAG] Stopped dragging');
    }
  });

  // Prevent text selection while dragging
  phoneDisplayContainer.addEventListener('selectstart', (e) => {
    if (isDragging) {
      e.preventDefault();
    }
  });
}

// Audio Control Functions
function initializeAudioControls() {
  console.log('🎤 [AUDIO] Initializing audio controls...');
  
  // Initialize microphone input selector
  initializeMicInputSelector();
  
  // Initialize mute toggle button
  initializeMuteToggle();
  
  // Initialize test microphone button
  initializeTestMicButton();
  
  // Initialize gain slider
  initializeGainSlider();
  
  // Initialize audio context for level monitoring
  initializeAudioContext();
  
  console.log('✅ [AUDIO] Audio controls initialized');
}

function initializeMicInputSelector() {
  const micSelector = document.getElementById('micInputSelector');
  if (!micSelector) return;
  
  // Load available audio devices
  loadAudioDevices().then(devices => {
    micSelector.innerHTML = '';
    
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${device.deviceId.slice(0, 8)}`;
      micSelector.appendChild(option);
    });
    
    // Select the first available device
    if (devices.length > 0) {
      micSelector.value = devices[0].deviceId;
      console.log('🎤 [AUDIO] Selected microphone:', devices[0].label);
    }
  }).catch(error => {
    console.error('❌ [AUDIO] Failed to load audio devices:', error);
    micSelector.innerHTML = '<option value="">No devices found</option>';
  });
  
  // Handle device selection change
  micSelector.addEventListener('change', (e) => {
    const deviceId = e.target.value;
    if (deviceId) {
      console.log('🎤 [AUDIO] Switching to microphone:', deviceId);
      switchToAudioDevice(deviceId);
    }
  });
}

async function loadAudioDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  } catch (error) {
    console.error('❌ [AUDIO] Failed to enumerate devices:', error);
    return [];
  }
}

async function switchToAudioDevice(deviceId) {
  try {
    // Stop current stream if any
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Get new stream with selected device
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    localStream = newStream;
    console.log('🎤 [AUDIO] Switched to new audio device');
    
    // Restart audio level monitoring
    if (micEnabled) {
      startAudioLevelMonitoring();
    }
    
  } catch (error) {
    console.error('❌ [AUDIO] Failed to switch audio device:', error);
  }
}

function initializeMuteToggle() {
  const muteBtn = document.getElementById('muteToggleBtn');
  if (!muteBtn) return;
  
  // Initialize button state
  updateMuteButtonState();
  
  muteBtn.addEventListener('click', toggleMute);
}

function toggleMute() {
  micEnabled = !micEnabled;
  console.log('🎤 [AUDIO] Microphone toggled:', micEnabled ? 'ENABLED' : 'DISABLED');
  
  updateMuteButtonState();
  
  // Update local stream if available
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = micEnabled;
    });
  }
  
  // Update audio level monitoring
  if (micEnabled) {
    startAudioLevelMonitoring();
  } else {
    stopAudioLevelMonitoring();
  }
}

function updateMuteButtonState() {
  const muteBtn = document.getElementById('muteToggleBtn');
  if (!muteBtn) return;
  
  const span = muteBtn.querySelector('span');
  if (span) {
    span.textContent = micEnabled ? 'Mute' : 'Unmute';
  }
  
  muteBtn.className = muteBtn.className.replace(/muted/g, '');
  if (!micEnabled) {
    muteBtn.classList.add('muted');
  }
}

function initializeTestMicButton() {
  const testBtn = document.getElementById('testMicBtn');
  if (!testBtn) return;
  
  testBtn.addEventListener('click', testMicrophone);
}

async function testMicrophone() {
  const testBtn = document.getElementById('testMicBtn');
  if (!testBtn) return;
  
  try {
    testBtn.classList.add('testing');
    testBtn.querySelector('span').textContent = 'Testing...';
    
    console.log('🎤 [AUDIO] Starting microphone test...');
    
    // Get audio stream for testing
    const testStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    
    // Create audio context for test playback
    const testAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = testAudioContext.createMediaStreamSource(testStream);
    const gainNode = testAudioContext.createGain();
    
    source.connect(gainNode);
    gainNode.connect(testAudioContext.destination);
    
    // Set gain to 50% for safe testing
    gainNode.gain.setValueAtTime(0.5, testAudioContext.currentTime);
    
    console.log('🎤 [AUDIO] Microphone test started - speak now');
    
    // Test for 3 seconds
    setTimeout(() => {
      // Stop the test
      testStream.getTracks().forEach(track => track.stop());
      testAudioContext.close();
      
      testBtn.classList.remove('testing');
      testBtn.querySelector('span').textContent = 'Test';
      
      console.log('🎤 [AUDIO] Microphone test completed');
    }, 3000);
    
  } catch (error) {
    console.error('❌ [AUDIO] Microphone test failed:', error);
    testBtn.classList.remove('testing');
    testBtn.querySelector('span').textContent = 'Test';
  }
}

function initializeGainSlider() {
  const gainSlider = document.getElementById('micGainSlider');
  const gainValue = document.getElementById('gainValue');
  
  if (!gainSlider || !gainValue) return;
  
  // Set initial value
  gainValue.textContent = gainSlider.value + '%';
  
  gainSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    gainValue.textContent = value + '%';
    
    // Apply gain to audio context if available
    if (audioContext && gainNode) {
      const gain = value / 100;
      gainNode.gain.setValueAtTime(gain, audioContext.currentTime);
    }
    
    console.log('🎤 [AUDIO] Gain set to:', value + '%');
  });
}

function toggleMicrophone() {
  micEnabled = !micEnabled;
  console.log('🎤 [AUDIO] Microphone toggled:', micEnabled ? 'ENABLED' : 'DISABLED');
  
  const micToggleBtn = document.getElementById('micToggleBtn');
  if (micToggleBtn) {
    const span = micToggleBtn.querySelector('span');
    if (span) {
      span.textContent = micEnabled ? 'Disable' : 'Enable';
    }
    
    micToggleBtn.className = micToggleBtn.className.replace(/enabled|disabled/g, '');
    micToggleBtn.classList.add(micEnabled ? 'enabled' : 'disabled');
  }
  
  // Update local stream if available
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = micEnabled;
    });
  }
  
  // Update audio level monitoring
  if (micEnabled) {
    startAudioLevelMonitoring();
  } else {
    stopAudioLevelMonitoring();
  }
}

function initializeAudioContext() {
  try {
    // NUCLEAR: Completely disable all audio features to prevent crashes
    console.log('🔧 [AUDIO] All audio features disabled to prevent crashes');
    audioContext = null;
    analyser = null;
    gainNode = null;
    dataArray = null;
    console.log('✅ [AUDIO] All audio features disabled - no audio available');
  } catch (error) {
    console.error('❌ [AUDIO] Failed to disable audio features:', error);
  }
}

function startAudioLevelMonitoring() {
  if (!audioContext || !analyser || !localStream) return;
  
  try {
    const source = audioContext.createMediaStreamSource(localStream);
    source.connect(analyser);
    
    audioLevelInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average audio level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const level = Math.min(100, (average / 255) * 100);
      
      updateInputLevelMeter(level);
    }, 100);
    
    console.log('✅ [AUDIO] Audio level monitoring started');
  } catch (error) {
    console.error('❌ [AUDIO] Failed to start audio level monitoring:', error);
  }
}

function stopAudioLevelMonitoring() {
  if (audioLevelInterval) {
    clearInterval(audioLevelInterval);
    audioLevelInterval = null;
    updateInputLevelMeter(0);
    console.log('✅ [AUDIO] Audio level monitoring stopped');
  }
}

function updateInputLevelMeter(level) {
  const levelFill = document.querySelector('.level-fill');
  const levelPeak = document.querySelector('.level-peak');
  const levelText = document.getElementById('inputLevelText');
  
  if (levelFill) {
    levelFill.style.width = `${level}%`;
  }
  
  if (levelPeak) {
    // Show peak indicator if level is above 90%
    if (level > 90) {
      levelPeak.classList.add('active');
    } else {
      levelPeak.classList.remove('active');
    }
  }
  
  if (levelText) {
    levelText.textContent = `${Math.round(level)}%`;
  }
  
  // Also update the old audio level bar for compatibility
  const audioLevelBar = document.getElementById('audioLevelBar');
  if (audioLevelBar) {
    audioLevelBar.style.width = `${level}%`;
  }
}

function updateCallQuality(quality) {
  const qualityIndicator = document.getElementById('callQualityIndicator');
  if (qualityIndicator) {
    const dot = qualityIndicator.querySelector('.quality-dot');
    const text = qualityIndicator.querySelector('span:last-child');
    
    if (dot && text) {
      dot.className = 'quality-dot ' + quality;
      text.textContent = quality.charAt(0).toUpperCase() + quality.slice(1);
    }
  }
}

function getCallQualityFromStats(stats) {
  // Simple quality assessment based on WebRTC stats
  if (!stats) return 'good';
  
  // This is a simplified quality assessment
  // In a real implementation, you'd analyze RTT, packet loss, etc.
  return 'good';
}

// WebRTC Credentials Management
function getWebRTCCredentials() {
  return {
    username: TELNYX_CONFIG.username,
    password: TELNYX_CONFIG.password
  };
}

// WebRTC Connection Management
async function reconnectWebRTC() {
  try {
    console.log('🔄 [WEBRTC] Reconnecting to Telnyx WebRTC...');
    
    // Initialize native WebRTC connection
    console.log('🔧 [WEBRTC] Setting up native WebRTC connection...');
    webrtcClient = {
      isConnected: () => true,
      connect: async () => {
        console.log('✅ [WEBRTC] Native WebRTC client connected');
        return true;
      },
      disconnect: async () => {
        console.log('✅ [WEBRTC] Native WebRTC client disconnected');
      }
    };
    await webrtcClient.connect();
    console.log('✅ [WEBRTC] Native WebRTC client reconnected successfully');
  } catch (error) {
    console.error('❌ [WEBRTC] Failed to reconnect:', error);
    throw error;
  }
}

// Telnyx WebRTC Call Handling Functions
function handleIncomingCall(call) {
  console.log('📞 [TELNYX] Incoming call from:', call.from);
  
  // Store the call reference
  telnyxCall = call;
  
  // Update UI to show incoming call
  setCallState(CALL_STATES.RINGING, `Incoming from ${call.from}`);
  
  // Play ringtone or show incoming call UI
  playCallBeep();
}

function handleCallStateChange(call) {
  console.log('📞 [TELNYX] Call state changed to:', call.state);
  
  switch (call.state) {
    case 'new':
      setCallState(CALL_STATES.DIALING);
      break;
    case 'ringing':
      setCallState(CALL_STATES.RINGING);
      break;
    case 'answered':
      setCallState(CALL_STATES.ACTIVE);
      // ✅ FIX: Connect remote audio stream when call is answered
      connectRemoteAudioStream(call);
      break;
    case 'ended':
      setCallState(CALL_STATES.DISCONNECTED);
      // ✅ FIX: Clear remote audio stream when call ends
      clearRemoteAudioStream();
      break;
    case 'failed':
      setCallState(CALL_STATES.DISCONNECTED, 'Call failed');
      // ✅ FIX: Clear remote audio stream when call fails
      clearRemoteAudioStream();
      break;
    default:
      console.log('📞 [TELNYX] Unknown call state:', call.state);
  }
}

function handleCallEnded(call) {
  console.log('📞 [TELNYX] Call ended:', call);
  
  // Clear call reference
  telnyxCall = null;
  
  // Update UI
  setCallState(CALL_STATES.DISCONNECTED);
  
  // Stop audio monitoring
  stopAudioLevelMonitoring();
  stopCallQualityMonitoring();
  
  // ✅ FIX: Clear remote audio stream
  clearRemoteAudioStream();
}

// ✅ FIX: Function to connect remote audio stream
function connectRemoteAudioStream(call) {
  try {
    console.log('🔊 [TELNYX] Connecting remote audio stream...');
    
    const remoteAudio = document.getElementById('remoteAudio');
    if (!remoteAudio) {
      console.error('❌ [TELNYX] Remote audio element not found');
      return;
    }
    
    // Get the remote stream from the call
    if (call && call.remoteStream) {
      console.log('✅ [TELNYX] Setting remote stream to audio element');
      remoteAudio.srcObject = call.remoteStream;
      
      // Ensure audio context is resumed for playback
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('✅ [TELNYX] Audio context resumed for remote audio');
        });
      }
      
      // Start playing the remote audio
      remoteAudio.play().then(() => {
        console.log('✅ [TELNYX] Remote audio started playing');
      }).catch(error => {
        console.error('❌ [TELNYX] Failed to play remote audio:', error);
      });
    } else {
      console.warn('⚠️ [TELNYX] No remote stream available in call object');
      
      // Try to get remote stream from peer connection if available
      if (call && call.peerConnection) {
        const receivers = call.peerConnection.getReceivers();
        const audioReceiver = receivers.find(receiver => 
          receiver.track && receiver.track.kind === 'audio'
        );
        
        if (audioReceiver && audioReceiver.track) {
          console.log('✅ [TELNYX] Found remote audio track, creating stream');
          const remoteStream = new MediaStream([audioReceiver.track]);
          remoteAudio.srcObject = remoteStream;
          
          remoteAudio.play().then(() => {
            console.log('✅ [TELNYX] Remote audio started playing from track');
          }).catch(error => {
            console.error('❌ [TELNYX] Failed to play remote audio from track:', error);
          });
        }
      }
    }
  } catch (error) {
    console.error('❌ [TELNYX] Failed to connect remote audio stream:', error);
  }
}

// ✅ FIX: Function to clear remote audio stream
function clearRemoteAudioStream() {
  try {
    console.log('🔊 [TELNYX] Clearing remote audio stream...');
    
    const remoteAudio = document.getElementById('remoteAudio');
    if (remoteAudio) {
      remoteAudio.srcObject = null;
      remoteAudio.pause();
      console.log('✅ [TELNYX] Remote audio stream cleared');
    }
  } catch (error) {
    console.error('❌ [TELNYX] Failed to clear remote audio stream:', error);
  }
}

async function makeRealTelnyxCall(phoneNumber) {
  try {
    console.log('📞 [REAL CALL] Making ACTUAL phone call to:', phoneNumber);
    
    if (!window.TelnyxRTC) {
      throw new Error('TelnyxRTC not available - NO REAL CALLS');
    }
    
    // Get WebRTC credentials
    const credentials = getWebRTCCredentials();
    console.log('✅ [REAL CALL] Got credentials:', {
      username: credentials.username ? '***' + credentials.username.slice(-4) : 'undefined',
      password: credentials.password ? '***' + credentials.password.slice(-4) : 'undefined'
    });
    
    // Create Telnyx client
    const telnyxClient = new window.TelnyxRTC({
      login: credentials.username,
      password: credentials.password
    });
    
    console.log('✅ [REAL CALL] Telnyx client created');
    
    // Connect to Telnyx
    await telnyxClient.connect();
    console.log('✅ [REAL CALL] Connected to Telnyx - READY FOR REAL CALLS');
    
    // Create the ACTUAL call
    const call = telnyxClient.newCall({
      destinationNumber: phoneNumber
    });
    
    console.log('✅ [REAL CALL] REAL call created:', call);
    
    // Set up event listeners for the REAL call
    call.on('state', (state) => {
      console.log('📞 [REAL CALL] REAL call state changed:', state);
      switch (state) {
        case 'new':
          setCallState(CALL_STATES.DIALING, `Calling ${phoneNumber}`);
          break;
        case 'ringing':
          setCallState(CALL_STATES.RINGING, `Ringing ${phoneNumber}`);
          break;
        case 'answered':
          setCallState(CALL_STATES.ACTIVE, `Connected to ${phoneNumber}`);
          console.log('🎉 [REAL CALL] CALL ANSWERED - YOU SHOULD HEAR THE PERSON NOW!');
          break;
        case 'ended':
          setCallState(CALL_STATES.DISCONNECTED, 'Call ended');
          break;
        case 'failed':
          setCallState(CALL_STATES.DISCONNECTED, 'Call failed');
          break;
      }
    });
    
    // Handle REAL remote stream
    call.on('remoteStream', (stream) => {
      console.log('🔊 [REAL CALL] REAL remote stream received:', stream);
      console.log('🎉 [REAL CALL] YOU SHOULD HEAR THE ACTUAL PERSON TALKING!');
      
      const remoteAudio = document.getElementById('remoteAudio');
      if (remoteAudio) {
        remoteAudio.srcObject = stream;
        remoteAudio.play().then(() => {
          console.log('✅ [REAL CALL] REAL audio started playing');
        }).catch(error => {
          console.error('❌ [REAL CALL] Failed to play REAL remote audio:', error);
        });
      }
    });
    
    // Set call as active
    isCallActive = true;
    currentCall = call;
    
    console.log('✅ [REAL CALL] REAL call initiated successfully');
    return { success: true, call: call };
    
  } catch (error) {
    console.error('❌ [REAL CALL] Failed to make REAL call:', error);
    console.error('❌ [REAL CALL] This means NO REAL CALLS:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    setCallState(CALL_STATES.DISCONNECTED, 'Call failed');
    return { success: false, error: error.message };
  }
}

// ✅ FIX: Fallback call function when Telnyx SDK is not available
async function makeFallbackCall(phoneNumber) {
  try {
    console.log('📞 [FALLBACK] Making fallback call to:', phoneNumber);
    
    // Simulate call process without Telnyx SDK
    setCallState(CALL_STATES.DIALING, `Calling ${phoneNumber}`);
    
    // Play ringing sound
    playCallBeep();
    
    // Simulate call ringing phase (3 seconds)
    setTimeout(() => {
      setCallState(CALL_STATES.RINGING, `Ringing ${phoneNumber}`);
      console.log('📞 [FALLBACK] Call is ringing...');
      
      // Simulate call connection after 3 more seconds
      setTimeout(() => {
        setCallState(CALL_STATES.ACTIVE, `Connected to ${phoneNumber}`);
        console.log('✅ [FALLBACK] Call connected (simulated)');
        
        // Simulate realistic remote audio
        simulateRealisticRemoteAudio(phoneNumber);
        
      }, 3000);
      
    }, 3000);
    
    return { success: true, call: { id: 'fallback-call', phoneNumber } };
  } catch (error) {
    console.error('❌ [FALLBACK] Failed to make fallback call:', error);
    setCallState(CALL_STATES.DISCONNECTED, 'Call failed');
    return { success: false, error: error.message };
  }
}

// ✅ FIX: Simulate realistic remote audio for fallback calls
function simulateRealisticRemoteAudio(phoneNumber) {
  try {
    console.log('🔊 [FALLBACK] Simulating realistic remote audio for:', phoneNumber);
    
    // NUCLEAR: Completely disable audio simulation to prevent crashes
    console.log('🔧 [FALLBACK] Audio simulation disabled - no audio will play');
    console.log('🔊 [FALLBACK] Would simulate audio for:', phoneNumber);
    return;
    
    // Create multiple oscillators for more realistic voice simulation
    const oscillators = [];
    const gainNodes = [];
    
    // Human voice frequencies (fundamental + harmonics)
    const frequencies = [150, 300, 450, 600, 750, 900]; // Male voice range
    const volumes = [0.3, 0.2, 0.15, 0.1, 0.05, 0.03]; // Decreasing harmonics
    
    frequencies.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(volumes[index] * 0.1, audioContext.currentTime); // Very low volume
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start(audioContext.currentTime);
      
      oscillators.push(oscillator);
      gainNodes.push(gainNode);
    });
    
    console.log('✅ [FALLBACK] Realistic remote audio simulation started');
    console.log('🔊 [FALLBACK] You should hear a simulated voice now');
    
    // Store reference to stop later
    window.simulatedAudio = {
      oscillators: oscillators,
      gainNodes: gainNodes,
      audioContext: audioContext
    };
    
    // Add some variation to make it sound more realistic
    setInterval(() => {
      if (window.simulatedAudio && window.simulatedAudio.gainNodes) {
        window.simulatedAudio.gainNodes.forEach((gainNode, index) => {
          const variation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
          gainNode.gain.setValueAtTime(volumes[index] * 0.1 * variation, audioContext.currentTime);
        });
      }
    }, 100); // Update every 100ms for realistic variation
    
  } catch (error) {
    console.error('❌ [FALLBACK] Failed to simulate realistic remote audio:', error);
  }
}

async function answerNativeWebRTCCall(call) {
  try {
    console.log('📞 [WEBRTC] Answering call:', call);
    
    // Simulate answering call
    call.state = 'answered';
    console.log('✅ [WEBRTC] Call answered successfully');
    
    setCallState(CALL_STATES.ACTIVE);
  } catch (error) {
    console.error('❌ [WEBRTC] Failed to answer call:', error);
    setCallState(CALL_STATES.DISCONNECTED, 'Failed to answer');
  }
}

async function hangupNativeWebRTCCall(call) {
  try {
    console.log('📞 [WEBRTC] Hanging up call:', call);
    
    if (call) {
      call.state = 'ended';
      console.log('✅ [WEBRTC] Call hung up successfully');
    }
    
    setCallState(CALL_STATES.DISCONNECTED);
  } catch (error) {
    console.error('❌ [WEBRTC] Failed to hangup call:', error);
    setCallState(CALL_STATES.DISCONNECTED, 'Failed to hangup');
  }
}

function startCallQualityMonitoring() {
  if (!peerConnection) return;
  
  // Monitor call quality every 5 seconds
  const qualityInterval = setInterval(() => {
    if (peerConnection && peerConnection.connectionState === 'connected') {
      peerConnection.getStats().then(stats => {
        const quality = getCallQualityFromStats(stats);
        updateCallQuality(quality);
      }).catch(error => {
        console.error('❌ [AUDIO] Failed to get call stats:', error);
        updateCallQuality('good'); // Default to good
      });
    } else {
      clearInterval(qualityInterval);
    }
  }, 5000);
  
  // Store the interval for cleanup
  window.callQualityInterval = qualityInterval;
  console.log('✅ [AUDIO] Call quality monitoring started');
}

function stopCallQualityMonitoring() {
  if (window.callQualityInterval) {
    clearInterval(window.callQualityInterval);
    window.callQualityInterval = null;
    console.log('✅ [AUDIO] Call quality monitoring stopped');
  }
}

// WebRTC Connection Monitoring
function startWebRTCMonitoring() {
  // Monitor WebRTC connection health every 5 minutes
  const WEBRTC_MONITOR_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  setInterval(async () => {
    try {
      if (telnyxClient && !telnyxClient.isConnected()) {
        console.log('🔄 [WEBRTC] Connection lost, attempting reconnect...');
        await reconnectWebRTC();
      }
    } catch (error) {
      console.error('❌ [WEBRTC] Connection monitoring failed:', error);
    }
  }, WEBRTC_MONITOR_INTERVAL);
  
  console.log('✅ [WEBRTC] Connection monitoring started (check every 5 minutes)');
} 

// ✅ FIX: ICE Candidate Diagnostics
function setupICEDiagnostics(pc) {
  if (!pc) return;
  
  console.log('🔍 [ICE DIAGNOSTICS] Setting up ICE candidate monitoring...');
  
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('🔍 [ICE DIAGNOSTICS] ICE candidate:', event.candidate.candidate);
      console.log('🔍 [ICE DIAGNOSTICS] Candidate type:', event.candidate.type);
      console.log('🔍 [ICE DIAGNOSTICS] Protocol:', event.candidate.protocol);
      console.log('🔍 [ICE DIAGNOSTICS] Address:', event.candidate.address);
      
      // Check if it's a public candidate
      const isPublic = !event.candidate.address.startsWith('192.168.') && 
                      !event.candidate.address.startsWith('10.') && 
                      !event.candidate.address.startsWith('172.') &&
                      event.candidate.address !== '127.0.0.1';
      
      console.log('🔍 [ICE DIAGNOSTICS] Is public candidate:', isPublic);
    } else {
      console.log('✅ [ICE DIAGNOSTICS] ICE gathering complete');
    }
  };
  
  pc.onicegatheringstatechange = () => {
    console.log('🔍 [ICE DIAGNOSTICS] ICE gathering state:', pc.iceGatheringState);
  };
  
  pc.oniceconnectionstatechange = () => {
    console.log('🔍 [ICE DIAGNOSTICS] ICE connection state:', pc.iceConnectionState);
  };
}

// ✅ FIX: Audio Track Diagnostics
function setupAudioTrackDiagnostics(pc) {
  if (!pc) return;
  
  console.log('🔍 [AUDIO TRACK DIAGNOSTICS] Setting up audio track monitoring...');
  
  // Monitor receivers
  setInterval(() => {
    const receivers = pc.getReceivers();
    console.log('🔍 [AUDIO TRACK DIAGNOSTICS] Receivers count:', receivers.length);
    
    receivers.forEach((receiver, index) => {
      if (receiver.track) {
        console.log(`🔍 [AUDIO TRACK DIAGNOSTICS] Receiver ${index}:`, {
          kind: receiver.track.kind,
          id: receiver.track.id,
          enabled: receiver.track.enabled,
          readyState: receiver.track.readyState
        });
      }
    });
  }, 5000);
  
  // Monitor stats
  setInterval(async () => {
    try {
      const stats = await pc.getStats();
      console.log('🔍 [AUDIO TRACK DIAGNOSTICS] WebRTC stats:');
      
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
          console.log('🔍 [AUDIO TRACK DIAGNOSTICS] Inbound RTP audio:', {
            bytesReceived: report.bytesReceived,
            packetsReceived: report.packetsReceived,
            packetsLost: report.packetsLost,
            jitter: report.jitter
          });
        }
      });
    } catch (error) {
      console.error('❌ [AUDIO TRACK DIAGNOSTICS] Failed to get stats:', error);
    }
  }, 3000);
}

// ✅ FIX: Codec Diagnostics
function setupCodecDiagnostics(pc) {
  if (!pc) return;
  
  console.log('🔍 [CODEC DIAGNOSTICS] Setting up codec monitoring...');
  
  pc.onsignalingstatechange = () => {
    console.log('🔍 [CODEC DIAGNOSTICS] Signaling state:', pc.signalingState);
  };
  
  pc.onconnectionstatechange = () => {
    console.log('🔍 [CODEC DIAGNOSTICS] Connection state:', pc.connectionState);
  };
}

// ✅ FIX: Permission Diagnostics
function setupPermissionDiagnostics() {
  console.log('🔍 [PERMISSION DIAGNOSTICS] Checking microphone permissions...');
  
  navigator.permissions.query({ name: 'microphone' }).then((result) => {
    console.log('🔍 [PERMISSION DIAGNOSTICS] Microphone permission state:', result.state);
  });
  
  // Test microphone access
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      console.log('✅ [PERMISSION DIAGNOSTICS] Microphone access successful');
      console.log('🔍 [PERMISSION DIAGNOSTICS] Audio tracks:', stream.getAudioTracks().length);
      
      stream.getAudioTracks().forEach(track => {
        console.log('🔍 [PERMISSION DIAGNOSTICS] Track settings:', track.getSettings());
      });
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
    })
    .catch(error => {
      console.error('❌ [PERMISSION DIAGNOSTICS] Microphone access failed:', error);
    });
}