const express = require("express");
const auth    = require("../middleware/auth");
const chain   = require("../blockchain/chain");
const router  = express.Router();

function fmt(b) {
  return {
    batchId:           b.batch_id,
    medicineName:      b.medicine_name,
    manufacturer:      b.manufacturer,
    quantity:          b.quantity,
    remainingQuantity: b.remaining_quantity,
    expiryDate:        b.expiry_date ? Number(b.expiry_date) : 0,
    status:            b.status,
    registeredBy:      b.registered_by,
    createdAt:         b.created_at ? Math.floor(new Date(b.created_at).getTime() / 1000) : 0,
  };
}

function fmtBlock(block) {
  const d = block.data || {};
  return {
    hash:         block.hash,
    previousHash: block.previousHash,
    timestamp:    Number(block.timestamp),
    eventType:    d.type || "",
    actor:        d.actor || "",
    actorName:    d.actorName || "",
    quantity:     d.quantity || d.quantityReceived || 0,
    location:     d.location || d.toLocation || "",
    notes:        d.notes || d.reason || "",
    data:         d,
  };
}

router.get("/", auth, async (req, res) => {
  try {
    const batches = await chain.getAllBatches();
    res.json({ batches: batches.map(fmt), total: batches.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const batch = await chain.getBatch(req.params.id);
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    const { blocks, verification } = await chain.getBatchHistory(req.params.id);
    res.json({
      batch:             { ...fmt(batch), history: blocks.map(fmtBlock) },
      chainVerification: verification,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const { batchId, medicineName, manufacturer, quantity, expiryDate, location, notes } = req.body;
    if (!batchId || !medicineName || !quantity)
      return res.status(400).json({ error: "batchId, medicineName and quantity required" });

    const expiryTs = expiryDate ? Math.floor(new Date(expiryDate).getTime() / 1000) : null;
    const { block, batch } = await chain.registerBatch(req.user.wallet, {
      batchId, medicineName, manufacturer, quantity: Number(quantity), expiryDate: expiryTs, location, notes,
    });
    res.status(201).json({ message: "Batch registered", batch: fmt(batch), blockHash: block.hash });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/transfer", auth, async (req, res) => {
  try {
    const { quantity, toLocation, notes } = req.body;
    const { block, batch } = await chain.transferBatch(req.user.wallet, req.params.id,
      { quantity: Number(quantity), toLocation, notes });
    res.json({ message: "Transfer recorded", batch: fmt(batch), blockHash: block.hash });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/receive", auth, async (req, res) => {
  try {
    const { quantityReceived, quantityExpected, location, notes } = req.body;
    const { block, batch, isDiscrepancy } = await chain.receiveBatch(req.user.wallet, req.params.id, {
      quantityReceived: Number(quantityReceived),
      quantityExpected: quantityExpected ? Number(quantityExpected) : Number(quantityReceived),
      location, notes,
    });
    res.json({
      message: isDiscrepancy ? "Discrepancy recorded" : "Receipt recorded",
      batch: fmt(batch), blockHash: block.hash, isDiscrepancy,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/flag", auth, async (req, res) => {
  try {
    const { reason, location } = req.body;
    const { block, batch } = await chain.flagBatch(req.user.wallet, req.params.id, { reason, location });
    res.json({ message: "Batch flagged", batch: fmt(batch), blockHash: block.hash });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/dispense", auth, async (req, res) => {
  try {
    const { quantity, location, notes } = req.body;
    const { block, batch } = await chain.dispenseBatch(req.user.wallet, req.params.id,
      { quantity: Number(quantity), location, notes });
    res.json({ message: "Dispensing recorded", batch: fmt(batch), blockHash: block.hash });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
