/**
 * blockchain.js — MediTrack pure JS blockchain engine
 *
 * Each event is a SHA-256 block linked to the previous by hash.
 * Tamper detection: re-hash every block on read, compare with stored hash.
 */

const crypto = require("crypto");

function hashBlock(previousHash, timestamp, data) {
  const content = JSON.stringify({ previousHash, timestamp, data });
  return crypto.createHash("sha256").update(content).digest("hex");
}

function createBlock(previousHash, data) {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash      = hashBlock(previousHash, timestamp, data);
  return { hash, previousHash, timestamp, data };
}

function createGenesisBlock() {
  return createBlock("0".repeat(64), {
    type:    "GENESIS",
    message: "MediTrack blockchain genesis block",
  });
}

function verifyChain(blocks) {
  if (!blocks.length) return { valid: true, message: "Empty chain" };
  for (let i = 0; i < blocks.length; i++) {
    const b        = blocks[i];
    const expected = hashBlock(b.previousHash, b.timestamp, b.data);
    if (b.hash !== expected) {
      return { valid: false, reason: `Block ${i + 1} hash mismatch — record may have been altered`, index: i };
    }
    if (i > 0 && b.previousHash !== blocks[i - 1].hash) {
      return { valid: false, reason: `Block ${i + 1} broken chain link`, index: i };
    }
  }
  return { valid: true, message: `${blocks.length} block${blocks.length !== 1 ? "s" : ""} verified` };
}

const EVENT_TYPES = {
  GENESIS: "GENESIS", REGISTERED: "REGISTERED", TRANSFERRED: "TRANSFERRED",
  RECEIVED: "RECEIVED", DISCREPANCY: "DISCREPANCY", DISPENSED: "DISPENSED",
  FLAGGED: "FLAGGED", USER_ADDED: "USER_ADDED",
};

const STATUS = {
  Registered: "Registered", InTransit: "InTransit", Received: "Received",
  Dispensed: "Dispensed", Flagged: "Flagged",
};

// Business rules (replace Solidity modifiers)
function assertActive(user)  { if (!user || !user.active)  throw new Error("User not registered"); }
function assertExists(batch) { if (!batch)                 throw new Error("Batch not found"); }
function assertQty(batch, qty) {
  if (batch.remaining_quantity < qty)
    throw new Error(`Insufficient quantity: ${batch.remaining_quantity} available, ${qty} requested`);
}

module.exports = { createBlock, createGenesisBlock, verifyChain, hashBlock, EVENT_TYPES, STATUS, assertActive, assertExists, assertQty };
