# Crokodialer - Sound Effects Integration Plan

## Background and Motivation

**User Request**: Integrate all sound effects from '/Users/linkpellow/Desktop/Crokodialer 1/SFX' directory to play correctly for web events with proper timing and no interference.

**Goal**: Ensure all sound effects are properly connected to their corresponding call events, play at the right time, and don't overlap or interfere with each other.

## Key Challenges and Analysis

### **Available Sound Effects:**
Based on the SFX directory:
1. `call-answered.wav` - When call is answered
2. `call-hangup.wav` - When call ends
3. `call-inbound.wav` - When receiving a call
4. `call-initiated.wav` - When starting a call
5. `error.wav` - For error states
6. `ui-buttons.wav` - For UI interactions

### **Telnyx Webhook Events (from API docs):**
According to [Telnyx API documentation](https://developers.telnyx.com/api/):
- `call.initiated` - Call started
- `call.answered` - Call connected
- `call.hangup` - Call ended
- `call.incoming` - Inbound call received
- Various error events

### **Current Issues to Address:**
1. Sound files need to be properly loaded and cached
2. Events must trigger correct sounds
3. Timing must be precise (no delays)
4. Prevent sound overlap/interference
5. Handle audio context restrictions in browsers
6. Ensure sounds work in Electron environment

## High-level Task Breakdown

### **Step 1: Sound File Integration** 🎵
_Overall Goal_: Load and prepare all sound files for use.

| # | Sub-Task | Success Criteria | Status |
|---|----------|-----------------|--------|
| 1.1 | **Inventory sound files** - List all available SFX | All 6 sounds documented | ⏳ PENDING |
| 1.2 | **Create sound loader** - Preload all audio files | Sounds loaded on app start | ⏳ PENDING |
| 1.3 | **Handle load errors** - Graceful fallback if sounds missing | No crashes if sound fails | ⏳ PENDING |
| 1.4 | **Test sound playback** - Verify each sound plays | All sounds audible | ⏳ PENDING |

### **Step 2: Event Mapping** 🔗
_Overall Goal_: Map each sound to correct events.

| # | Sub-Task | Success Criteria | Status |
|---|----------|-----------------|--------|
| 2.1 | **Map call events** - Connect Telnyx events to sounds | Each event has correct sound | ⏳ PENDING |
| 2.2 | **Map UI events** - Button clicks trigger sounds | UI feedback sounds work | ⏳ PENDING |
| 2.3 | **Map error events** - Error states play error sound | Errors have audio feedback | ⏳ PENDING |
| 2.4 | **Document mappings** - Clear event->sound documentation | Mapping table created | ⏳ PENDING |

### **Step 3: Audio Management System** 🎛️
_Overall Goal_: Create robust audio playback system.

| # | Sub-Task | Success Criteria | Status |
|---|----------|-----------------|--------|
| 3.1 | **Create AudioManager class** - Centralized audio control | Single point of control | ⏳ PENDING |
| 3.2 | **Implement sound queue** - Prevent overlap/cutoff | Sounds don't interfere | ⏳ PENDING |
| 3.3 | **Add volume control** - User can adjust volume | Volume slider works | ⏳ PENDING |
| 3.4 | **Handle audio context** - Deal with browser restrictions | Auto-resume on interaction | ⏳ PENDING |

### **Step 4: WebSocket Integration** 📡
_Overall Goal_: Connect sounds to real-time events.

| # | Sub-Task | Success Criteria | Status |
|---|----------|-----------------|--------|
| 4.1 | **Hook WebSocket events** - Listen for call events | Events trigger sounds | ⏳ PENDING |
| 4.2 | **Add event debouncing** - Prevent rapid-fire sounds | No sound spam | ⏳ PENDING |
| 4.3 | **Test with real calls** - Verify timing is correct | Sounds sync with calls | ⏳ PENDING |
| 4.4 | **Handle disconnections** - Sounds work offline too | Graceful degradation | ⏳ PENDING |

### **Step 5: Testing & Polish** ✨
_Overall Goal_: Ensure perfect sound experience.

| # | Sub-Task | Success Criteria | Status |
|---|----------|-----------------|--------|
| 5.1 | **Test all scenarios** - Every event plays sound | 100% coverage | ⏳ PENDING |
| 5.2 | **Performance testing** - No lag or delays | < 50ms latency | ⏳ PENDING |
| 5.3 | **Cross-platform test** - Works on Mac/Win/Linux | Platform agnostic | ⏳ PENDING |
| 5.4 | **User preferences** - Save volume/mute settings | Settings persist | ⏳ PENDING |

## Project Status Board

### **To Do** 📋
- [ ] Create comprehensive sound file inventory
- [ ] Build AudioManager class
- [ ] Map all Telnyx events to sounds
- [ ] Implement sound preloading
- [ ] Add WebSocket event listeners
- [ ] Create sound queue system
- [ ] Test with real calls
- [ ] Add user preferences

### **In Progress** 🔄
- [ ] Planning sound integration architecture

### **Done** ✅
- [x] Identified all sound files in SFX directory
- [x] Reviewed Telnyx webhook events
- [x] Created implementation plan

## Current Status / Progress Tracking

**Status**: **PLANNING COMPLETE** - Ready to implement sound effects integration.

**Sound Mapping Plan**:
| Event | Sound File | Timing |
|-------|-----------|--------|
| call.initiated | call-initiated.wav | Immediate on call start |
| call.answered | call-answered.wav | When call connects |
| call.hangup | call-hangup.wav | On call end |
| call.incoming | call-inbound.wav | On incoming call |
| error states | error.wav | On any error |
| button clicks | ui-buttons.wav | On UI interaction |

**Next Step**: Analyze current sound implementation and create AudioManager class.

## Executor's Feedback or Assistance Requests

**Ready to implement sound integration**: Need to examine current audio implementation and create a robust system for managing all sound effects.

## Lessons

- **Audio Context**: Modern browsers require user interaction before playing sounds
- **Preloading**: All sounds should be loaded at app start for instant playback
- **Event Timing**: Sounds must play immediately (< 50ms) for good UX
- **No Overlap**: Use audio queue to prevent sounds cutting each other off
- **Electron Specifics**: May need special handling for Electron's audio APIs
- **Volume Control**: Users need ability to adjust or mute sounds