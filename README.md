# MediTrack — JavaScript Blockchain

No Hardhat. No Solidity. No blockchain node. Just Node.js + PostgreSQL + React.

## How it works

Every batch event (register, transfer, receive, dispense, flag) is stored as
a SHA-256 block linked to the previous block by hash. Any tampering breaks
every hash that follows it — detected immediately on every read.

## Setup (2 minutes)

### 1. Create the database
```bash
psql -U postgres -c "CREATE DATABASE meditrack;"
```

### 2. Configure the backend
Edit `backend/.env` and set your PostgreSQL password:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/meditrack
```

### 3. Install dependencies
```bash
cd backend  && npm install
cd frontend && npm install
```

## Running (2 terminals)

### Terminal 1 — Backend
```bash
cd backend
npm run dev
```
The backend starts, creates all tables, and inserts the genesis block automatically.

### Seed demo users (once, after first start)
```powershell
# Windows PowerShell:
Invoke-RestMethod -Method POST -Uri http://localhost:3001/api/auth/seed-users
```

### Terminal 2 — Frontend
```bash
cd frontend
npm run dev
```
Open http://localhost:5173

## Login

Enter your **name** (e.g. "System Admin") and password **meditrack123**.
The login page shows all demo accounts — click any to fill in the credentials.

## Demo accounts (all use password: meditrack123)

| Name            | Role        | Facility                    |
|-----------------|-------------|-----------------------------|
| System Admin    | CMST        | CMST Headquarters           |
| Dr. Sarah Phiri | Pharmacist  | Lilongwe Central Hospital   |
| James Banda     | HSA         | Mzuzu District Health Office|
| ACE Logistics   | Transporter | Central Transport Depot     |
| PMRA Inspector  | Regulator   | Pharmacy Regulatory Authority|

## Adding new users (CMST admin only)

Go to Users → Add user. Each new user gets:
- A unique wallet address (Ethereum-format, cryptographically generated)
- A private key (shown once — save it)
- A blockchain registration event in the chain

## Blockchain structure

```
chain_blocks table (append-only — never UPDATE or DELETE)
├── Genesis block
├── Block 1: REGISTERED  MW-2041 → hash links to genesis
├── Block 2: TRANSFERRED MW-2041 → hash links to block 1
├── Block 3: RECEIVED    MW-2041 → hash links to block 2
└── ...
```

Each block: `SHA-256(previousHash + timestamp + eventData)`

`GET /api/dashboard/verify-chain` re-hashes the entire chain and returns
`{ valid: true }` or the exact block where tampering was detected.
