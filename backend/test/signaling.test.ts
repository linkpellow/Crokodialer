import { createServer } from 'http';
import { Server } from 'socket.io';
import Client from 'socket.io-client';
import express from 'express';
import { generateToken } from '../src/utils/jwt';
import '../src/types/webrtc.d.ts';
import type { Server as HttpServer } from 'http';

let io: Server, serverHttp: HttpServer, addr: any;

beforeAll((done) => {
  const app = express();
  serverHttp = createServer(app);
  io = new Server(serverHttp, { cors: { origin: '*' } });

  // simplified roomUsers tracking for test
  const roomUsers = new Map<string, Set<string>>();

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('no token'));
    try {
      socket.data.user = { email: 'test@example.com', userId: 'u1' };
      next();
    } catch {
      next(new Error('bad token'));
    }
  });

  io.on('connection', (s) => {
    const addUser = (room: string) => {
      const set = roomUsers.get(room) || new Set();
      set.add(s.id);
      roomUsers.set(room, set);
      io.to(room).emit('room-users', Array.from(set));
    };
    const removeUser = (room: string) => {
      const set = roomUsers.get(room);
      if (!set) return;
      set.delete(s.id);
      if (set.size === 0) roomUsers.delete(room);
      else io.to(room).emit('room-users', Array.from(set));
    };

    s.on('join-room', (room) => {
      s.join(room);
      addUser(room);
    });
    s.on('leave-room', (room) => {
      s.leave(room);
      removeUser(room);
      s.to(room).emit('user-left', { socketId: s.id });
    });

    // relay offer/answer/ice
    ['offer', 'answer', 'ice-candidate', 'call-start', 'call-end'].forEach((evt) => {
      s.on(evt, (payload) => {
        const { roomId } = payload;
        s.to(roomId).emit(evt, { socketId: s.id, ...payload });
      });
    });

    s.on('disconnect', () => {
      roomUsers.forEach((_set, room) => removeUser(room));
      s.rooms.forEach((room) => {
        if (room !== s.id) s.to(room).emit('user-left', { socketId: s.id });
      });
    });
  });

  serverHttp.listen(() => {
    addr = serverHttp.address();
    done();
  });
});

afterAll((done) => {
  io.close();
  serverHttp.close(done);
});

const makeClient = (email: string) => {
  const token = generateToken({ email, userId: email });
  return Client(`http://localhost:${addr.port}`, { auth: { token }, forceNew: true });
};

describe('Socket.io signaling flow', () => {
  it('rejects connection without token', (done) => {
    const client = Client(`http://localhost:${addr.port}`, { forceNew: true });
    client.on('connect_error', () => {
      client.close();
      done();
    });
  });

  it('joins room and receives roster', (done) => {
    const alice = makeClient('alice');
    const roomId = 'room1';
    alice.on('connect', () => {
      alice.emit('join-room', roomId);
    });
    alice.on('room-users', (users: string[]) => {
      expect(users.length).toBe(1);
      alice.close();
      done();
    });
  });

  it('relay offer/answer/ice between peers', (done) => {
    const roomId = 'room2';
    const alice = makeClient('alice');
    const bob = makeClient('bob');

    let offerReceived = false,
      answerReceived = false,
      iceReceived = false;

    function checkDone() {
      if (offerReceived && answerReceived && iceReceived) {
        alice.close();
        bob.close();
        done();
      }
    }

    alice.on('connect', () => alice.emit('join-room', roomId));
    bob.on('connect', () => bob.emit('join-room', roomId));

    bob.on('offer', () => {
      offerReceived = true;
      checkDone();
    });
    alice.on('answer', () => {
      answerReceived = true;
      checkDone();
    });
    bob.on('ice-candidate', () => {
      iceReceived = true;
      checkDone();
    });

    // wait until both joined then emit
    bob.on('room-users', (users: string[]) => {
      if (users.length === 2) {
        alice.emit('offer', { roomId, offer: { sdp: 'dummy' } });
        bob.emit('answer', { roomId, answer: { sdp: 'dummy' } });
        alice.emit('ice-candidate', { roomId, candidate: { candidate: 'dummy' } });
      }
    });
  });
}); 