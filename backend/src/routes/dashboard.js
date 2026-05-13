const express = require("express");
const auth    = require("../middleware/auth");
const chain   = require("../blockchain/chain");
const router  = express.Router();

router.get("/stats", auth, async (req, res) => {
  try { res.json({ stats: await chain.getStats() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/alerts", auth, async (req, res) => {
  try {
    const batches = await chain.getAllBatches();
    const now     = Math.floor(Date.now() / 1000);
    const alerts  = [];

    for (const b of batches) {
      if (b.status === "Flagged") {
        const { blocks } = await chain.getBatchHistory(b.batch_id);
        const last = [...blocks].reverse().find(bl => ["FLAGGED","DISCREPANCY"].includes(bl.data?.type));
        alerts.push({
          type: "DISCREPANCY", severity: "high", batchId: b.batch_id,
          medicineName: b.medicine_name,
          message: last?.data?.reason || last?.data?.notes || "Batch flagged",
          timestamp: last?.timestamp || 0,
        });
      }
      if (b.expiry_date && b.expiry_date - now < 86400 * 30 && b.expiry_date > now) {
        const days = Math.floor((b.expiry_date - now) / 86400);
        alerts.push({
          type: "EXPIRY", severity: days < 7 ? "high" : "medium",
          batchId: b.batch_id, medicineName: b.medicine_name,
          message: `Expires in ${days} day${days !== 1 ? "s" : ""}`, timestamp: now,
        });
      }
      if (b.status === "InTransit") {
        alerts.push({
          type: "IN_TRANSIT", severity: "low", batchId: b.batch_id,
          medicineName: b.medicine_name, message: "Batch currently in transit", timestamp: 0,
        });
      }
    }

    alerts.sort((a, b) => ({ high:0, medium:1, low:2 }[a.severity] - { high:0, medium:1, low:2 }[b.severity]));
    res.json({ alerts, total: alerts.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/activity", auth, async (req, res) => {
  try { res.json({ activity: await chain.getRecentActivity(50) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/verify-chain", auth, async (req, res) => {
  try { res.json(await chain.verifyFullChain()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
