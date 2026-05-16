/**
 * chain.js — All blockchain operations for MediTrack.
 * Replaces the Solidity smart contract entirely.
 */

const {
  createBlock, createGenesisBlock, verifyChain,
  EVENT_TYPES, STATUS,
  assertActive, assertExists, assertQty,
} = require("./blockchain");
const { pool } = require("../models/db");

// ── Internal helpers ───────────────────────────────────────────────────────

async function getLastHash(batchId) {
  // Get last block for this batch, or genesis if none yet
  if (batchId) {
    const r = await pool.query(
      "SELECT hash FROM chain_blocks WHERE batch_id=$1 ORDER BY id DESC LIMIT 1",
      [batchId]
    );
    if (r.rows.length) return r.rows[0].hash;
  }
  // Fall back to genesis block
  const g = await pool.query(
    "SELECT hash FROM chain_blocks WHERE data->>'type'='GENESIS' ORDER BY id LIMIT 1"
  );
  return g.rows.length ? g.rows[0].hash : "0".repeat(64);
}

async function insertBlock(block, batchId) {
  // Store data as JSON string so it round-trips cleanly through pg
  const dataJson = JSON.stringify(block.data);
  const r = await pool.query(
    `INSERT INTO chain_blocks (hash, previous_hash, timestamp, data, batch_id)
     VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING id`,
    [block.hash, block.previousHash, block.timestamp, dataJson, batchId || null]
  );
  return r.rows[0].id;
}

async function getUser(wallet) {
  const r = await pool.query(
    "SELECT * FROM chain_users WHERE LOWER(wallet)=LOWER($1) AND active=true",
    [wallet]
  );
  return r.rows[0] || null;
}

async function getBatch(batchId) {
  const r = await pool.query(
    "SELECT * FROM chain_batches WHERE batch_id=$1",
    [batchId]
  );
  return r.rows[0] || null;
}

async function setBatchStatus(batchId, status, remainingQty) {
  await pool.query(
    `UPDATE chain_batches
     SET status=$1, remaining_quantity=COALESCE($2, remaining_quantity), updated_at=NOW()
     WHERE batch_id=$3`,
    [status, remainingQty ?? null, batchId]
  );
}

// ── Initialise chain ───────────────────────────────────────────────────────

async function initChain() {
  const r = await pool.query(
    "SELECT id FROM chain_blocks WHERE data->>'type'='GENESIS' LIMIT 1"
  );
  if (r.rows.length) return; // already initialised

  const genesis = createGenesisBlock();
  await pool.query(
    `INSERT INTO chain_blocks (hash, previous_hash, timestamp, data, batch_id)
     VALUES ($1,$2,$3,$4,NULL)`,
    [genesis.hash, genesis.previousHash, genesis.timestamp, genesis.data]
  );
  console.log("  Genesis block:", genesis.hash.slice(0, 16) + "…");
}

// ── Register user ──────────────────────────────────────────────────────────

async function registerUser(wallet, name, role, facility, createdBy) {
  const exists = await pool.query(
    "SELECT wallet FROM chain_users WHERE LOWER(wallet)=LOWER($1) AND active=true",
    [wallet]
  );
  if (exists.rows.length) throw new Error("User already registered");

  await pool.query(
    `INSERT INTO chain_users (wallet, name, role, facility, active, created_by)
     VALUES ($1,$2,$3,$4,true,$5)
     ON CONFLICT (wallet) DO UPDATE SET name=$2, role=$3, facility=$4, active=true`,
    [wallet.toLowerCase(), name, role, facility || "", createdBy || null]
  );

  const lastHash = await getLastHash(null);
  const block    = createBlock(lastHash, {
    type: EVENT_TYPES.USER_ADDED, wallet: wallet.toLowerCase(),
    name, role, facility: facility || "", createdBy: createdBy || null,
  });
  await insertBlock(block, null);
  return block;
}

// ── Register batch ─────────────────────────────────────────────────────────

async function registerBatch(actorWallet, { batchId, medicineName, manufacturer, quantity, expiryDate, location, notes }) {
  const actor = await getUser(actorWallet);
  assertActive(actor);

  if (await getBatch(batchId)) throw new Error(`Batch ${batchId} already exists`);

  await pool.query(
    `INSERT INTO chain_batches
       (batch_id, medicine_name, manufacturer, quantity, remaining_quantity,
        expiry_date, status, registered_by, location, notes)
     VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9)`,
    [batchId, medicineName, manufacturer || "Unknown", quantity,
     expiryDate || null, STATUS.Registered, actorWallet.toLowerCase(),
     location || "CMST", notes || ""]
  );

  const lastHash = await getLastHash(batchId);
  const block    = createBlock(lastHash, {
    type: EVENT_TYPES.REGISTERED, batchId, medicineName,
    manufacturer: manufacturer || "Unknown", quantity,
    expiryDate: expiryDate || null, location: location || "CMST",
    notes: notes || "", actor: actorWallet.toLowerCase(), actorName: actor.name,
  });
  await insertBlock(block, batchId);
  return { block, batch: await getBatch(batchId) };
}

// ── Transfer ───────────────────────────────────────────────────────────────

async function transferBatch(actorWallet, batchId, { quantity, toLocation, notes }) {
  const actor = await getUser(actorWallet);
  assertActive(actor);
  const batch = await getBatch(batchId);
  assertExists(batch);
  assertQty(batch, quantity);

  await setBatchStatus(batchId, STATUS.InTransit, null);

  const lastHash = await getLastHash(batchId);
  const block    = createBlock(lastHash, {
    type: EVENT_TYPES.TRANSFERRED, batchId, quantity,
    toLocation: toLocation || "", notes: notes || "",
    actor: actorWallet.toLowerCase(), actorName: actor.name,
  });
  await insertBlock(block, batchId);
  return { block, batch: await getBatch(batchId) };
}

// ── Receive ────────────────────────────────────────────────────────────────

async function receiveBatch(actorWallet, batchId, { quantityReceived, quantityExpected, location, notes }) {
  const actor = await getUser(actorWallet);
  assertActive(actor);
  const batch = await getBatch(batchId);
  assertExists(batch);

  const expected       = quantityExpected || quantityReceived;
  const isDiscrepancy  = quantityReceived < expected;
  const newStatus      = isDiscrepancy ? STATUS.Flagged : STATUS.Received;
  const eventType      = isDiscrepancy ? EVENT_TYPES.DISCREPANCY : EVENT_TYPES.RECEIVED;

  await setBatchStatus(batchId, newStatus, quantityReceived);

  const lastHash = await getLastHash(batchId);
  const block    = createBlock(lastHash, {
    type: eventType, batchId, quantityReceived, quantityExpected: expected,
    discrepancy: isDiscrepancy ? expected - quantityReceived : 0,
    location: location || "", notes: notes || "",
    actor: actorWallet.toLowerCase(), actorName: actor.name,
  });
  await insertBlock(block, batchId);
  return { block, batch: await getBatch(batchId), isDiscrepancy };
}

// ── Dispense ───────────────────────────────────────────────────────────────

async function dispenseBatch(actorWallet, batchId, { quantity, location, notes }) {
  const actor = await getUser(actorWallet);
  assertActive(actor);
  const batch = await getBatch(batchId);
  assertExists(batch);
  assertQty(batch, quantity);

  const newRemaining = batch.remaining_quantity - quantity;
  await setBatchStatus(batchId, newRemaining === 0 ? STATUS.Dispensed : batch.status, newRemaining);

  const lastHash = await getLastHash(batchId);
  const block    = createBlock(lastHash, {
    type: EVENT_TYPES.DISPENSED, batchId, quantity,
    location: location || "", notes: notes || "",
    actor: actorWallet.toLowerCase(), actorName: actor.name,
  });
  await insertBlock(block, batchId);
  return { block, batch: await getBatch(batchId) };
}

// ── Flag ───────────────────────────────────────────────────────────────────

async function flagBatch(actorWallet, batchId, { reason, location }) {
  const actor = await getUser(actorWallet);
  assertActive(actor);
  const batch = await getBatch(batchId);
  assertExists(batch);

  await setBatchStatus(batchId, STATUS.Flagged, null);

  const lastHash = await getLastHash(batchId);
  const block    = createBlock(lastHash, {
    type: EVENT_TYPES.FLAGGED, batchId,
    reason: reason || "Flagged", location: location || "",
    actor: actorWallet.toLowerCase(), actorName: actor.name,
  });
  await insertBlock(block, batchId);
  return { block, batch: await getBatch(batchId) };
}

// ── Read operations ────────────────────────────────────────────────────────

async function getBatchHistory(batchId) {
  const r = await pool.query(
    "SELECT * FROM chain_blocks WHERE batch_id=$1 ORDER BY id ASC",
    [batchId]
  );
  const blocks = r.rows.map(rowToBlock);
  return { blocks, verification: verifyChain(blocks) };
}

async function getAllBatches() {
  const r = await pool.query("SELECT * FROM chain_batches ORDER BY created_at ASC");
  return r.rows;
}

async function getAllUsers() {
  const r = await pool.query(
    "SELECT * FROM chain_users WHERE active=true ORDER BY created_at ASC"
  );
  return r.rows;
}

async function verifyFullChain() {
  const r = await pool.query("SELECT * FROM chain_blocks ORDER BY id ASC");
  return verifyChain(r.rows.map(rowToBlock));
}

async function getStats() {
  const batches = await getAllBatches();
  const now     = Math.floor(Date.now() / 1000);
  const stats   = {
    totalBatches: batches.length,
    byStatus: { Registered:0, InTransit:0, Received:0, Dispensed:0, Flagged:0 },
    expiringWithin30Days: 0, discrepancies: 0,
    totalUnits: 0, remainingUnits: 0,
  };
  for (const b of batches) {
    stats.byStatus[b.status] = (stats.byStatus[b.status] || 0) + 1;
    stats.totalUnits     += b.quantity;
    stats.remainingUnits += b.remaining_quantity;
    if (b.status === "Flagged") stats.discrepancies++;
    if (b.expiry_date && b.expiry_date - now < 86400 * 30 && b.expiry_date > now)
      stats.expiringWithin30Days++;
  }
  return stats;
}

async function getRecentActivity(limit = 50) {
  const r = await pool.query(
    `SELECT cb.*, cb2.medicine_name
     FROM chain_blocks cb
     LEFT JOIN chain_batches cb2 ON cb.batch_id = cb2.batch_id
     WHERE cb.batch_id IS NOT NULL
     ORDER BY cb.id DESC LIMIT $1`,
    [limit]
  );
  return r.rows.map(row => {
    const data = row.data;
    return {
      hash:         row.hash,
      batchId:      row.batch_id,
      medicineName: row.medicine_name || "",
      eventType:    data.type || "",
      actorName:    data.actorName || "",
      location:     data.location || data.toLocation || "",
      quantity:     data.quantity || data.quantityReceived || 0,
      notes:        data.notes || data.reason || "",
      timestamp:    Number(row.timestamp),
    };
  });
}

// ── Row formatter ──────────────────────────────────────────────────────────

function rowToBlock(row) {
  // Ensure timestamp is always a plain integer (pg may return BIGINT as string)
  const timestamp = parseInt(row.timestamp, 10);

  // Ensure data is always a plain JS object, not a string
  const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;

  return {
    id:           row.id,
    hash:         row.hash,
    previousHash: row.previous_hash,
    timestamp,
    data,
    batchId:      row.batch_id,
  };
}

module.exports = {
  initChain, registerUser, registerBatch, transferBatch,
  receiveBatch, dispenseBatch, flagBatch,
  getBatchHistory, getAllBatches, getBatch, getUser, getAllUsers,
  verifyFullChain, getStats, getRecentActivity,
};
