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
    const users = await getAllUsers();
    res.json({ users: users.map(u => ({
      wallet: u.wallet, name: u.name, role: u.role, facility: u.facility,
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

module.exports = router;
