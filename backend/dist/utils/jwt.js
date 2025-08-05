"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.decodeToken = decodeToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';
function generateToken(payload) {
    // Cast payload to any to satisfy jsonwebtoken v8 typings in strict mode
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRATION
    });
}
function verifyToken(token) {
    const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
    // Handle both userId and _id formats
    if (payload._id && !payload.userId) {
        return {
            userId: payload._id,
            email: payload.email,
            _id: payload._id
        };
    }
    return payload;
}
function decodeToken(token) {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch {
        return null;
    }
}
