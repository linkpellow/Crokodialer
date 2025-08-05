<!--
Reference: Use this file for all step-by-step, file-specific integration instructions.
Consult this for implementation or review of any integration work. Always cross-check module or file-level actions with Project_Overview.md, Tree Map files, and conventions in rules.yaml.
-->

# Crokodial Dialer: File-by-File Integration Instructions (Telnyx + FusionPBX + Electron)

---

## 1. Backend (API & Socket.io)

### 1.1. `/api/calls` Endpoint

- **File:** `backend/src/routes/calls.routes.ts`
- **Instruction:**  
  - Ensure POST `/api/calls` (or `/calls/initiate`) accepts `{ toNumber: string }`.
  - Creates a call record in MongoDB.
  - Calls Telnyx API to initiate the outbound call.
  - Generates a `roomId` (can be `callControlId` or a unique call/session identifier).
  - Returns the `roomId` to the frontend.

### 1.2. Socket.io Room/Event Setup

- **File:** `backend/src/socket/index.js` (or where socket.io is initialized)
- **Instruction:**
  - When a call is initiated, listen for `join-room` from frontend with `roomId`.
  - Add the socket to the room: `socket.join(roomId)`.
  - Broadcast call status updates to the room:  
    `io.to(roomId).emit('call-status', { status, eventType })`.
  - Also handle these signaling events in this room:
    - `offer`
    - `answer`
    - `ice-candidate`
  - For each event, forward payloads between peers in the same room.

### 1.3. Telnyx Webhook Integration

- **File:** `backend/src/routes/telnyx.ts`
- **Instruction:**
  - On POST from Telnyx, parse `event.data.event_type`.
  - Map event type to status using:  
    ```js
    const statusMap = {
      'call.initiated': 'ringing',
      'call.ringing': 'ringing',
      'call.answered': 'active',
      'call.hangup': 'ended'
    };
    ```
  - Update the call record in MongoDB:  
    `await Call.findOneAndUpdate({ callControlId }, { status: newStatus });`
  - Emit to socket room:  
    `io.to('call_' + callControlId).emit('call-status', { status: newStatus, eventType });`

### 1.4. FusionPBX WebSocket Events

- **File:** `backend/src/services/fusionpbx.ts`
- **Instruction:**
  - On new PBX event, emit relevant call status updates to the associated call's socket.io room.
  - Use the same status mapping as Telnyx for consistency.

---

## 2. Electron/Desktop Frontend

### 2.1. API Requests via IPC

- **File:** `apps/desktop/main.js`
- **Instruction:**
  - Use `ipcMain.handle('api-request', ...)` to proxy HTTP requests from renderer to backend.
  - Ensure that POST `/api/calls` with `{ toNumber: phoneNumber }` is supported.

### 2.2. WebRTC + Socket.io Integration

- **File:** `apps/desktop/renderer.js`
- **Instruction:**  
  - In `startCall(phoneNumber)`:
    1. Call `apiRequest('POST', '/api/calls', { toNumber: phoneNumber })`.
    2. Receive `roomId` from the backend.
    3. Emit `join-room` via socket.io: `socket.emit('join-room', roomId)`.
    4. Create `RTCPeerConnection`.
    5. Create offer, set local description.
    6. Emit `offer` via socket.io to room: `socket.emit('offer', { roomId, offer })`.
    7. Listen for `answer` and `ice-candidate` events, apply them to `peerConnection`.
    8. Listen for `call-status` events in the room to update the UI:
        - Update UI with `status` (`Calling...`, `Ringing`, `Active`, `Ended`, etc.).
        - Show/hide call/hangup buttons accordingly.

### 2.3. UI Integration

- **File:** `Leads.tsx` (or wherever your lead action buttons are)
- **Instruction:**
  - On "Call" button click, invoke `window.startCall(phone)` or trigger `ipcRenderer.invoke('api-request', ...)` as needed.
  - Reflect real-time call status in the UI using socket.io event listeners.

---

## 3. Types and Event Contracts

### 3.1. WebRTC Types

- **File:** `backend/src/types/webrtc.d.ts`
- **Instruction:**
  - Use these types for all signaling payloads between frontend and backend:
    - `RTCSessionDescriptionInit`
    - `RTCIceCandidateInit`

### 3.2. Call Status/Event Types

- **Instruction:**
  - All `call-status` events should have:
    ```json
    {
      "status": "ringing" | "active" | "ended",
      "eventType": "call.initiated" | "call.ringing" | "call.answered" | "call.hangup"
    }
    ```

---

## 4. Optional: Testing and Debugging

- Add logging for all socket.io events in both backend and frontend for easier debugging.
- Write integration tests that simulate:
  - Call initiation
  - Real-time status updates
  - ICE/SDP exchange
  - Hangup flow

---

## 5. (Recommended) Architecture Diagram

- Show the flow:
  - UI/Electron → IPC → Backend (`/api/calls`)
  - Backend → Telnyx API & FusionPBX
  - Telnyx/FusionPBX → Webhook/Event → Backend
  - Backend → socket.io room → Electron UI
  - Electron UI ↔ socket.io room ↔ Backend for WebRTC signaling

---

## 6. Directory Reference

- **For all file locations and structure:**  
  See Crokodialer_(Dialer)_Tree_Map.md and Crokodial_(CRM)_Tree_Map.md in this folder.