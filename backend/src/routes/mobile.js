const express = require("express");
const auth    = require("../middleware/auth");
const chain   = require("../blockchain/chain");
const router  = express.Router();

// ── Mobile ──────────────────────────────────────────────────────────────────
router.get("/config", async (req, res) => {
  res.json({ blockchain: "js-native", version: "3.0.0",
    serverTime: Math.floor(Date.now() / 1000),
    features: { qrScan: true, offlineQueue: true, auditReport: true },
  });
});

router.get("/scan/:batchId", auth, async (req, res) => {
  try {
    const batch = await chain.getBatch(req.params.batchId);
    if (!batch) return res.status(404).json({ error: "Batch not found", batchId: req.params.batchId });

    const { blocks, verification } = await chain.getBatchHistory(req.params.batchId);
    const now = Math.floor(Date.now() / 1000);

    res.json({
      batch: {
        batchId: batch.batch_id, medicineName: batch.medicine_name,
        manufacturer: batch.manufacturer, quantity: batch.quantity,
        remainingQuantity: batch.remaining_quantity,
        expiryDate: batch.expiry_date ? Number(batch.expiry_date) : 0,
        status: batch.status,
      },
      lastEvent:         blocks.length ? { ...blocks[blocks.length - 1].data, timestamp: blocks[blocks.length - 1].timestamp } : null,
      eventCount:        blocks.length,
      verified:          verification.valid,
      chainVerification: verification,
      warnings: {
        expired:      batch.expiry_date > 0 && batch.expiry_date < now,
        expiringSoon: batch.expiry_date > 0 && batch.expiry_date - now < 86400 * 30 && batch.expiry_date > now,
        flagged:      batch.status === "Flagged",
        discrepancy:  blocks.some(b => b.data?.type === "DISCREPANCY"),
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/batches", auth, async (req, res) => {
  try {
    const page  = parseInt(req.query.page  || "1");
    const limit = parseInt(req.query.limit || "20");
    let batches = await chain.getAllBatches();
    if (req.query.status) batches = batches.filter(b => b.status === req.query.status);
    const total  = batches.length;
    const sliced = batches.slice((page - 1) * limit, page * limit).map(b => ({
      batchId: b.batch_id, medicineName: b.medicine_name, manufacturer: b.manufacturer,
      quantity: b.quantity, remainingQuantity: b.remaining_quantity,
      expiryDate: b.expiry_date ? Number(b.expiry_date) : 0, status: b.status,
    }));
    res.json({ batches: sliced, total, page, limit, pages: Math.ceil(total / limit), hasMore: page * limit < total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/me", auth, async (req, res) => {
  try {
    const u = await chain.getUser(req.user.wallet);
    res.json({ user: { ...req.user, ...(u || {}) } });
  } catch { res.json({ user: req.user }); }
});

router.get("/dashboard", auth, async (req, res) => {
  try {
    const stats    = await chain.getStats();
    const activity = await chain.getRecentActivity(5);
    res.json({
      stats: {
        total:        stats.totalBatches,
        inTransit:    stats.byStatus.InTransit,
        flagged:      stats.discrepancies,
        expiringSoon: stats.expiringWithin30Days,
      },
      recentActivity: activity,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Sync ──────────────────────────────────────────────────────────────────
router.post("/sync/queue", auth, async (req, res) => {
  const { actions } = req.body;
  if (!Array.isArray(actions) || !actions.length)
    return res.status(400).json({ error: "actions array required" });

  const results = [];
  for (const { type, batchId, payload, localId } of actions) {
    try {
      let result;
      switch ((type || "").toUpperCase()) {
        case "TRANSFER": result = await chain.transferBatch(req.user.wallet, batchId, { quantity: Number(payload.quantity), toLocation: payload.toLocation, notes: payload.notes }); break;
        case "RECEIVE":  result = await chain.receiveBatch(req.user.wallet, batchId,  { quantityReceived: Number(payload.quantityReceived), quantityExpected: Number(payload.quantityExpected), location: payload.location, notes: payload.notes }); break;
        case "DISPENSE": result = await chain.dispenseBatch(req.user.wallet, batchId, { quantity: Number(payload.quantity), location: payload.location, notes: payload.notes }); break;
        case "FLAG":     result = await chain.flagBatch(req.user.wallet, batchId,     { reason: payload.reason, location: payload.location }); break;
        default: results.push({ localId, success: false, error: `Unknown type: ${type}` }); continue;
      }
      results.push({ localId, success: true, blockHash: result.block.hash });
    } catch (err) { results.push({ localId, success: false, error: err.message }); }
  }

  res.json({
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed:    results.filter(r => !r.success).length,
    results,
  });
});

router.get("/sync/status", auth, (req, res) => {
  res.json({ online: true, serverTime: Math.floor(Date.now() / 1000), wallet: req.user.wallet });
});

module.exports = router;
