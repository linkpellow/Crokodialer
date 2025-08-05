// Minimal WebRTC type definitions for Node backend
// These interfaces provide the fields we actually relay; they are **not** full spec types.

interface RTCSessionDescriptionInit {
  type?: string;
  sdp?: string;
}

interface RTCIceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number;
  sdpMid?: string | null;
} 