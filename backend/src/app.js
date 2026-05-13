require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { initDb }    = require("./models/db");
const { initChain } = require("./blockchain/chain");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "*", methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"] }));
app.use(express.json({ limit: "10mb" }));

app.use("/api/auth",      require("./routes/auth"));
app.use("/api/batches",   require("./routes/batches"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/users",     require("./routes/users"));
app.use("/api/mobile",    require("./routes/mobile"));
app.use("/api/sync",      require("./routes/mobile")); // sync endpoints are in mobile.js

app.get("/api/health", (req, res) => res.json({
  status: "ok", version: "3.0.0",
  blockchain: "js-native-sha256",
  time: new Date().toISOString(),
}));

app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, req, res, next) => { console.error(err.stack); res.status(500).json({ error: "Internal server error" }); });

async function start() {
  try {
    await initDb();
    console.log(" Database connected");
  } catch (err) {
    console.error("\n [ERROR] PostgreSQL failed:", err.message);
    console.error(" Update DATABASE_URL in .env\n");
    process.exit(1);
  }

  await initChain();
  console.log(" Blockchain ready");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n MediTrack JS Blockchain API`);
    console.log(` http://localhost:${PORT}`);
    console.log(`\n Seed demo users (once):`);
    console.log(`   Invoke-RestMethod -Method POST -Uri http://localhost:${PORT}/api/auth/seed-users\n`);
  });
}

start();
