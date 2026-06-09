const express = require("express");
const bcrypt  = require("bcryptjs");
const auth    = require("../middleware/auth");
const { pool }         = require("../models/db");
const { registerUser, getAllUsers, getUser } = require("../blockchain/chain");
const { generateWallet } = require("../blockchain/wallet");
const router = express.Router();

const VALID_ROLES = ["CMST", "Transporter", "Pharmacist", "HSA", "Regulator"];

// GET /api/users
router.get("/", auth, async (req, res) => {
  try {
    const isCMST = req.user.role === "CMST";
    // Admins get all users including inactive; others get active only
    const users = isCMST
      ? (await pool.query("SELECT wallet, name, role, facility, active FROM chain_users ORDER BY created_at ASC")).rows
      : await getAllUsers();
    res.json({ users: users.map(u => ({
      wallet: u.wallet, name: u.name, role: u.role, facility: u.facility, active: u.active ?? true,
    }))});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/users/accounts — returns demo account list for login screen
router.get("/accounts", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT wallet, name, role, facility FROM users ORDER BY id ASC LIMIT 10"
    );
    res.json({ accounts: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users — admin creates a new user with an auto-generated wallet
router.post("/", auth, async (req, res) => {
  try {
    if (req.user.role !== "CMST")
      return res.status(403).json({ error: "Only CMST admins can add users" });

    const { name, role, facility, password } = req.body;
    if (!name || !role) return res.status(400).json({ error: "name and role required" });
    if (!VALID_ROLES.includes(role))
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });

    // 1. Generate a unique wallet address
    const { address: wallet, privateKey } = generateWallet();

    // 2. Set up credentials
    const userPassword = password?.trim() || "meditrack123";
    const passwordHash = await bcrypt.hash(userPassword, 10);

    // 3. Register on the blockchain
    await registerUser(wallet, name, role, facility || "", req.user.wallet);

    // 4. Save to login table
    await pool.query(
      `INSERT INTO users (wallet, name, role, facility, password_hash)
       VALUES ($1,$2,$3,$4,$5)`,
      [wallet.toLowerCase(), name, role, facility || "", passwordHash]
    );

    // 5. Save private key against chain user (for reference)
    await pool.query(
      "UPDATE chain_users SET private_key=$1 WHERE LOWER(wallet)=LOWER($2)",
      [privateKey, wallet]
    );

    const user = await getUser(wallet);
    res.status(201).json({
      message: "User created with new wallet address",
      user:    { wallet: user.wallet, name: user.name, role: user.role, facility: user.facility },
      credentials: {
        wallet,
        privateKey,
        password:  userPassword,
        loginName: name,
        warning:   "Save the private key now — it will not be shown again",
      },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// GET /api/users/:wallet
router.get("/:wallet", auth, async (req, res) => {
  try {
    const u = await getUser(req.params.wallet);
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json({ user: { wallet: u.wallet, name: u.name, role: u.role, facility: u.facility } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/users/all/including-inactive — returns all users including deactivated (admin only)
router.get("/all/including-inactive", auth, async (req, res) => {
  try {
    if (req.user.role !== "CMST")
      return res.status(403).json({ error: "Admin only" });
    const r = await pool.query(
      "SELECT wallet, name, role, facility, active, created_at FROM chain_users ORDER BY created_at ASC"
    );
    res.json({ users: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/users/:wallet/deactivate — suspend a user account
router.patch("/:wallet/deactivate", auth, async (req, res) => {
  try {
    if (req.user.role !== "CMST")
      return res.status(403).json({ error: "Only CMST admins can deactivate users" });
    const { wallet } = req.params;
    const { reason } = req.body;

    const existing = await pool.query(
      "SELECT * FROM chain_users WHERE LOWER(wallet)=LOWER($1)", [wallet]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "User not found" });
    if (!existing.rows[0].active) return res.status(400).json({ error: "User is already deactivated" });

    await pool.query(
      "UPDATE chain_users SET active=false WHERE LOWER(wallet)=LOWER($1)", [wallet]
    );
    await pool.query(
      "UPDATE users SET active=false WHERE LOWER(wallet)=LOWER($1)", [wallet]
    );

    // Log to blockchain
    const { createBlock } = require("../blockchain/blockchain");
    const { pool: dbPool } = require("../models/db");
    const lastHashR = await dbPool.query(
      "SELECT hash FROM chain_blocks ORDER BY id DESC LIMIT 1"
    );
    const lastHash = lastHashR.rows[0]?.hash || "0".repeat(64);
    const block = createBlock(lastHash, {
      type: "USER_DEACTIVATED",
      wallet: wallet.toLowerCase(),
      reason: reason || "Deactivated by admin",
      actor: req.user.wallet,
      actorName: req.user.name,
    });
    const dataJson = JSON.stringify(block.data);
    await dbPool.query(
      `INSERT INTO chain_blocks (hash, previous_hash, timestamp, data, batch_id)
       VALUES ($1,$2,$3,$4::jsonb,NULL)`,
      [block.hash, block.previousHash, block.timestamp, dataJson]
    );

    res.json({ message: `${existing.rows[0].name} has been deactivated` });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// PATCH /api/users/:wallet/reinstate — reactivate a suspended user
router.patch("/:wallet/reinstate", auth, async (req, res) => {
  try {
    if (req.user.role !== "CMST")
      return res.status(403).json({ error: "Only CMST admins can reinstate users" });
    const { wallet } = req.params;

    const existing = await pool.query(
      "SELECT * FROM chain_users WHERE LOWER(wallet)=LOWER($1)", [wallet]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "User not found" });
    if (existing.rows[0].active) return res.status(400).json({ error: "User is already active" });

    await pool.query(
      "UPDATE chain_users SET active=true WHERE LOWER(wallet)=LOWER($1)", [wallet]
    );
    await pool.query(
      "UPDATE users SET active=true WHERE LOWER(wallet)=LOWER($1)", [wallet]
    );

    // Log to blockchain
    const { createBlock } = require("../blockchain/blockchain");
    const { pool: dbPool } = require("../models/db");
    const lastHashR = await dbPool.query(
      "SELECT hash FROM chain_blocks ORDER BY id DESC LIMIT 1"
    );
    const lastHash = lastHashR.rows[0]?.hash || "0".repeat(64);
    const block = createBlock(lastHash, {
      type: "USER_REINSTATED",
      wallet: wallet.toLowerCase(),
      actor: req.user.wallet,
      actorName: req.user.name,
    });
    const dataJson = JSON.stringify(block.data);
    await dbPool.query(
      `INSERT INTO chain_blocks (hash, previous_hash, timestamp, data, batch_id)
       VALUES ($1,$2,$3,$4::jsonb,NULL)`,
      [block.hash, block.previousHash, block.timestamp, dataJson]
    );

    res.json({ message: `${existing.rows[0].name} has been reinstated` });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// DELETE /api/users/:wallet — permanently delete a user
router.delete("/:wallet", auth, async (req, res) => {
  try {
    if (req.user.role !== "CMST")
      return res.status(403).json({ error: "Only CMST admins can delete users" });
    const { wallet } = req.params;

    if (wallet.toLowerCase() === req.user.wallet.toLowerCase())
      return res.status(400).json({ error: "You cannot delete your own account" });

    const existing = await pool.query(
      "SELECT * FROM chain_users WHERE LOWER(wallet)=LOWER($1)", [wallet]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "User not found" });

    await pool.query("DELETE FROM chain_users WHERE LOWER(wallet)=LOWER($1)", [wallet]);
    await pool.query("DELETE FROM users WHERE LOWER(wallet)=LOWER($1)", [wallet]);

    res.json({ message: `${existing.rows[0].name} has been permanently deleted` });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// PATCH /api/users/:wallet/reset-password — reset a user's password
router.patch("/:wallet/reset-password", auth, async (req, res) => {
  try {
    if (req.user.role !== "CMST")
      return res.status(403).json({ error: "Only CMST admins can reset passwords" });
    const { wallet } = req.params;
    const { newPassword } = req.body;

    const existing = await pool.query(
      "SELECT * FROM users WHERE LOWER(wallet)=LOWER($1)", [wallet]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "User not found" });

    const password     = newPassword?.trim() || "meditrack123";
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      "UPDATE users SET password_hash=$1 WHERE LOWER(wallet)=LOWER($2)",
      [passwordHash, wallet]
    );

    res.json({ message: "Password reset successfully", newPassword: password });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
