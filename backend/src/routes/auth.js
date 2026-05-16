const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { pool }         = require("../models/db");
const { registerUser } = require("../blockchain/chain");
const auth             = require("../middleware/auth");
const router = express.Router();

// ── POST /api/auth/login ──────────────────────────────────────────────────
// Simple: username (name or wallet) + password. No private key needed.
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "username and password required" });

    // Accept login by name OR wallet address
    const r = await pool.query(
      `SELECT * FROM users
       WHERE LOWER(name)=LOWER($1) OR LOWER(wallet)=LOWER($1)
       LIMIT 1`,
      [username.trim()]
    );
    if (!r.rows.length) return res.status(401).json({ error: "User not found" });

    const user = r.rows[0];
    if (!await bcrypt.compare(password, user.password_hash))
      return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      { wallet: user.wallet, name: user.name, role: user.role, facility: user.facility },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({ token, user: { wallet: user.wallet, name: user.name, role: user.role, facility: user.facility } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
});

// ── POST /api/auth/seed-users ─────────────────────────────────────────────
// Creates the 5 default demo users, each with a generated wallet address
router.post("/seed-users", async (req, res) => {
  try {
    const { generateWallet } = require("../blockchain/wallet");
    const hash = await bcrypt.hash("meditrack123", 10);

    // Fixed wallets matching Hardhat's default accounts for familiarity
    const defaults = [
      { wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", name: "System Admin",    role: "CMST",        facility: "CMST Headquarters" },
      { wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", name: "Dr. Sarah Phiri",  role: "Pharmacist",  facility: "Lilongwe Central Hospital" },
      { wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", name: "James Banda",      role: "HSA",         facility: "Mzuzu District Health Office" },
      { wallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", name: "ACE Logistics",    role: "Transporter", facility: "Central Transport Depot" },
      { wallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", name: "PMRA Inspector",   role: "Regulator",   facility: "Pharmacy Regulatory Authority" },
    ];

    const seeded = [];
    for (const u of defaults) {
      await pool.query(
        `INSERT INTO users (wallet, name, role, facility, password_hash)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (wallet) DO UPDATE SET name=$2, role=$3, facility=$4`,
        [u.wallet.toLowerCase(), u.name, u.role, u.facility, hash]
      );
      try { await registerUser(u.wallet, u.name, u.role, u.facility, null); }
      catch (e) { if (!e.message.includes("already registered")) throw e; }
      seeded.push({ name: u.name, wallet: u.wallet, role: u.role });
    }

    res.json({ message: "Demo users seeded. Password for all: meditrack123", users: seeded });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────
router.get("/me", auth, (req, res) => res.json({ user: req.user }));

// POST /api/auth/reset — wipe all chain data and reseed (dev only)
router.post("/reset", async (req, res) => {
  try {
    await pool.query(`
      TRUNCATE chain_blocks RESTART IDENTITY CASCADE;
      TRUNCATE chain_batches RESTART IDENTITY CASCADE;
      TRUNCATE chain_users RESTART IDENTITY CASCADE;
      TRUNCATE users RESTART IDENTITY CASCADE;
    `);
    res.json({ message: "All chain data wiped. Now POST /api/auth/seed-users then /api/auth/seed-data" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


// ── POST /api/auth/seed-data — seed demo medicine batches with supply chain events
router.post("/seed-data", async (req, res) => {
  try {
    const {
      registerBatch, transferBatch, receiveBatch,
      dispenseBatch, flagBatch, getBatch
    } = require("../blockchain/chain");

    // Get the seeded user wallets
    const r = await pool.query("SELECT wallet, role FROM chain_users WHERE active=true ORDER BY created_at ASC LIMIT 5");
    if (r.rows.length < 2) {
      return res.status(400).json({ error: "Run seed-users first before seeding data" });
    }

    const adminWallet  = r.rows.find(u => u.role === "CMST")?.wallet;
    const pharmaWallet = r.rows.find(u => u.role === "Pharmacist")?.wallet;
    const hsaWallet    = r.rows.find(u => u.role === "HSA")?.wallet;

    if (!adminWallet) return res.status(400).json({ error: "No CMST user found. Run seed-users first." });

    const now     = Math.floor(Date.now() / 1000);
    const oneYear = now + 86400 * 365;
    const sixMo   = now + 86400 * 180;
    const thirtyD = now + 86400 * 30;
    const tenDays = now + 86400 * 10;

    const batches = [
      // ── Fully delivered batch ───────────────────────────────────────────
      { batchId:"MW-2041", medicineName:"Amoxicillin 500mg",   manufacturer:"Cipla Ltd",      quantity:1000, expiryDate:oneYear, location:"CMST Lilongwe",    notes:"Routine quarterly supply" },
      // ── In transit ─────────────────────────────────────────────────────
      { batchId:"MW-2039", medicineName:"Paracetamol 500mg",   manufacturer:"Sun Pharma",     quantity:2400, expiryDate:sixMo,   location:"CMST Lilongwe",    notes:"Urgent restocking" },
      // ── Discrepancy flagged ─────────────────────────────────────────────
      { batchId:"MW-2037", medicineName:"ORS Sachets",         manufacturer:"Electral Co.",   quantity:800,  expiryDate:sixMo,   location:"CMST Blantyre",    notes:"Standard quarterly issue" },
      // ── Expiring soon ──────────────────────────────────────────────────
      { batchId:"MW-2035", medicineName:"Cotrimoxazole 480mg", manufacturer:"Aspen Pharma",   quantity:600,  expiryDate:thirtyD, location:"CMST Lilongwe",    notes:"Routine batch" },
      // ── Expiring very soon ─────────────────────────────────────────────
      { batchId:"MW-2033", medicineName:"Metformin 500mg",     manufacturer:"Ranbaxy",        quantity:1500, expiryDate:tenDays, location:"CMST Blantyre",    notes:"Diabetics programme" },
      // ── Registered only ────────────────────────────────────────────────
      { batchId:"MW-2031", medicineName:"Artesunate 50mg",     manufacturer:"Guilin Pharma",  quantity:3200, expiryDate:sixMo,   location:"CMST Lilongwe",    notes:"Malaria treatment stock" },
      // ── Dispensed batch ────────────────────────────────────────────────
      { batchId:"MW-2029", medicineName:"Zinc Sulphate 20mg",  manufacturer:"Micro Labs",     quantity:500,  expiryDate:oneYear, location:"CMST Lilongwe",    notes:"Child diarrhoea programme" },
      // ── Another received batch ─────────────────────────────────────────
      { batchId:"MW-2027", medicineName:"SP Tablets",          manufacturer:"Ipca Labs",      quantity:1200, expiryDate:oneYear, location:"CMST Blantyre",    notes:"Malaria prevention" },
    ];

    const created = [];

    for (const b of batches) {
      // Skip if already exists
      const existing = await getBatch(b.batchId);
      if (existing) { created.push({ batchId: b.batchId, status: "already exists" }); continue; }

      await registerBatch(adminWallet, b);

      // ── MW-2041: Transferred and fully received ─────────────────────────
      if (b.batchId === "MW-2041" && pharmaWallet) {
        await transferBatch(adminWallet, "MW-2041", { quantity: 1000, toLocation: "Lilongwe Central Hospital", notes: "Weekly delivery run" });
        await receiveBatch(pharmaWallet, "MW-2041", { quantityReceived: 1000, quantityExpected: 1000, location: "Lilongwe Central Hospital", notes: "All units accounted for, seals intact" });
      }

      // ── MW-2039: Transferred, still in transit ──────────────────────────
      if (b.batchId === "MW-2039") {
        await transferBatch(adminWallet, "MW-2039", { quantity: 2400, toLocation: "Mzuzu District Health Office", notes: "Scheduled delivery" });
      }

      // ── MW-2037: Transferred, received with discrepancy ─────────────────
      if (b.batchId === "MW-2037" && hsaWallet) {
        await transferBatch(adminWallet, "MW-2037", { quantity: 800, toLocation: "Zomba Health Centre", notes: "Routine dispatch" });
        await receiveBatch(hsaWallet, "MW-2037", { quantityReceived: 752, quantityExpected: 800, location: "Zomba Health Centre", notes: "48 sachets missing on arrival, outer carton damaged" });
      }

      // ── MW-2029: Transferred, received, then partially dispensed ────────
      if (b.batchId === "MW-2029" && pharmaWallet) {
        await transferBatch(adminWallet, "MW-2029", { quantity: 500, toLocation: "Lilongwe Central Hospital", notes: "Child health programme" });
        await receiveBatch(pharmaWallet, "MW-2029", { quantityReceived: 500, quantityExpected: 500, location: "Lilongwe Central Hospital", notes: "Good condition" });
        await dispenseBatch(pharmaWallet, "MW-2029", { quantity: 200, location: "Paediatric ward", notes: "Dispensed to children under 5" });
        await dispenseBatch(pharmaWallet, "MW-2029", { quantity: 150, location: "Paediatric ward", notes: "Second dispensing batch" });
      }

      // ── MW-2027: Transferred, received, partially dispensed ─────────────
      if (b.batchId === "MW-2027" && pharmaWallet) {
        await transferBatch(adminWallet, "MW-2027", { quantity: 1200, toLocation: "Blantyre DHO", notes: "ANC programme restock" });
        await receiveBatch(pharmaWallet, "MW-2027", { quantityReceived: 1200, quantityExpected: 1200, location: "Blantyre DHO", notes: "Received in good condition" });
      }

      created.push({ batchId: b.batchId, status: "created" });
    }

    res.json({
      message: `Demo data seeded successfully`,
      batches: created,
      summary: {
        registered:    created.filter(c => c.status === "created").length,
        alreadyExisted: created.filter(c => c.status === "already exists").length,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});