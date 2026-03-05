<p align="center">
  <h1 align="center">🔊 SONIC</h1>
  <p align="center"><strong>Secure Orchestration for Native & Indigenous Cultural Heritage</strong></p>
  <p align="center">
    Zero-Trust Cultural Provenance System — protecting indigenous music, oral traditions, and folk heritage through immutable ledger-backed audio fingerprinting.
  </p>
</p>

---

## 🧭 What is SONIC?

**SONIC** is a serverless platform that lets indigenous communities **register, fingerprint, and protect** their cultural audio heritage. It creates an immutable provenance record for every uploaded audio asset — generating spectral fingerprints, SHA-256 hashes, and storing them on a tamper-proof ledger — so that cultural ownership can be **cryptographically proven** at any time.

### Key Features

- 🔐 **Zero-Trust Upload** — Master audio is uploaded directly to a private S3 bucket via pre-signed URLs. It never touches a public server.
- 🧬 **Audio Fingerprinting** — Each file is hashed (SHA-256) and spectral-fingerprinted (MFCC-based) for provenance verification.
- 📜 **Immutable Ledger** — Provenance records are stored on a DynamoDB-backed ledger (designed for QLDB when available).
- 🔍 **Public Discovery** — A curated library lets researchers and media discover licensable assets — with only **30-second degraded previews** exposed.
- 🎨 **Glassmorphism UI** — A modern, responsive frontend with dynamic orbs, glass cards, and smooth transitions.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SONIC SYSTEM ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────────┘

                            ┌──────────────────┐
                            │   Frontend (UI)  │
                            │  HTML / CSS / JS │
                            │  Glassmorphism   │
                            └────────┬─────────┘
                                     │  HTTPS
                                     ▼
                        ┌────────────────────────────┐
                        │    API Gateway (REST)      │
                        │  /api/v1/assets/*          │
                        └──────┬──────┬──────┬───────┘
                               │      │      │
              ┌────────────────┤      │      ├──────────────────┐
              ▼                ▼      ▼      ▼                  ▼
    ┌──────────────┐  ┌────────────┐ ┌────────────┐   ┌──────────────────┐
    │ Upload       │  │ Metadata   │ │ Discovery  │   │ Play / Preview   │
    │ Handler      │  │ Handler    │ │ Handler    │   │ Handler          │
    │ (Node.js)    │  │ (Node.js)  │ │ (Node.js)  │   │ (Node.js)        │
    └──────┬───────┘  └─────┬──────┘ └──────┬─────┘   └────────┬─────────┘
           │                │               │                   │
           │   ┌────────────┴───────────────┴───────────────────┘
           │   │
           ▼   ▼
    ┌──────────────────┐          ┌──────────────────┐
    │   DynamoDB       │          │  Provenance      │
    │ (Assets Table)   │◄────────►│  Handler         │
    │  PK: ASSET#id    │          │  (Node.js)       │
    │  GSI: Discovery  │          └────────┬─────────┘
    └──────────────────┘                   │
                                           ▼
                                ┌──────────────────┐
                                │ Provenance Ledger│
                                │   (DynamoDB /    │
                                │    QLDB)         │
                                └──────────────────┘

    ┌───────────────────────────────────────────────┐
    │          S3 Event Trigger (on upload)         │
    └─────────────────────┬─────────────────────────┘
                          ▼
              ┌──────────────────────┐
              │  Audio Processor     │
              │  (Python 3.11)       │
              │  - SHA-256 Hash      │
              │  - MFCC Fingerprint  │
              │  - Preview Copy      │
              └──────┬───────┬───────┘
                     │       │
                     ▼       ▼
        ┌────────────────┐  ┌────────────────────┐
        │ Raw Audio      │  │ Preview Audio      │
        │ Bucket (S3)    │  │ Bucket (S3)        │
        │ 🔒 Private     │  │ 🔒 Pre-signed     │
        │ (Master files) │  │ (30s previews)     │
        └────────────────┘  └────────────────────┘
```

---

## 📂 Project Structure

```
SONIC/
├── bin/
│   └── sonic.ts                  # CDK App entry point
├── lib/
│   └── sonic-stack.ts            # Full AWS CDK infrastructure stack
├── backend/
│   ├── uploadHandler/            # Generates S3 pre-signed upload URLs
│   │   ├── index.js
│   │   └── package.json
│   ├── metadataHandler/          # Saves asset metadata to DynamoDB
│   │   ├── index.js
│   │   └── package.json
│   ├── audioProcessor/           # Python — fingerprints audio + copies preview
│   │   ├── app.py
│   │   └── requirements.txt
│   ├── discoveryHandler/         # Returns public/licensable assets
│   │   ├── index.js
│   │   └── package.json
│   ├── playHandler/              # Generates pre-signed URL for preview playback
│   │   ├── index.js
│   │   └── package.json
│   └── provenanceHandler/        # Reads immutable provenance from ledger
│       ├── index.js
│       └── package.json
├── frontend/
│   ├── index.html                # Main UI — Register Heritage + Discover Library
│   ├── style.css                 # Glassmorphism design system
│   └── app.js                    # Frontend logic — upload, discovery, provenance modal
├── cdk.json                      # CDK configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # CDK & project dependencies
└── .gitignore
```

---

## 🔧 AWS Services Used

| Service | Purpose |
|---|---|
| **Amazon S3** (×2 buckets) | Raw master audio storage (private) + Preview audio (pre-signed access) |
| **Amazon DynamoDB** (×2 tables) | Asset metadata with GSI for discovery + Provenance ledger (QLDB fallback) |
| **AWS Lambda** (×6 functions) | Serverless compute for all API handlers + audio processing |
| **Amazon API Gateway** | RESTful API with CORS support |
| **AWS CDK** | Infrastructure-as-Code for the complete stack |

---

## 🚀 How to Deploy & Run Locally

### Prerequisites

Make sure you have the following installed:

- **Node.js** ≥ 18.x — [Download](https://nodejs.org/)
- **AWS CLI** — [Install Guide](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
- **AWS CDK** — Install globally: `npm install -g aws-cdk`
- **Python 3.11** — Required for the Audio Processor Lambda
- **An AWS Account** with credentials configured (`aws configure`)

### Step 1: Clone the Repository

```bash
git clone https://github.com/A-kki/SONIC.git
cd SONIC
```

### Step 2: Install Dependencies

```bash
# Install CDK and project dependencies
npm install

# Install Python dependencies for Audio Processor
cd backend/audioProcessor
pip install -r requirements.txt
cd ../..
```

### Step 3: Bootstrap CDK (First Time Only)

If this is the first time using CDK in your AWS account/region:

```bash
cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

Example:
```bash
cdk bootstrap aws://123456789012/ap-south-1
```

### Step 4: Deploy the Stack

```bash
# Build TypeScript
npm run build

# Deploy to AWS
cdk deploy
```

After deployment, CDK will output the **API Gateway URL**. It will look something like:

```
SonicStack.SonicApiEndpointXXXXX = https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/prod/
```

### Step 5: Configure the Frontend

Open `frontend/app.js` and replace the `API_URL` on **line 2** with your deployed API Gateway URL:

```javascript
const API_URL = "https://YOUR-API-ID.execute-api.YOUR-REGION.amazonaws.com/prod/api/v1";
```

### Step 6: Launch the Frontend

Simply open `frontend/index.html` in your browser, or serve it locally:

```bash
# Using Python
cd frontend
python -m http.server 8080

# Or using Node.js
npx serve frontend
```

Then visit: **http://localhost:8080**

---

## 📡 API Endpoints

All endpoints are under `/api/v1/assets`:

| Method | Endpoint | Lambda | Description |
|--------|----------|--------|-------------|
| `POST` | `/assets/upload-url` | Upload Handler | Returns a pre-signed S3 PUT URL for direct browser upload |
| `POST` | `/assets/metadata` | Metadata Handler | Stores community, language, music type, and licensing info |
| `GET` | `/assets/public` | Discovery Handler | Returns all licensable assets for the public library |
| `GET` | `/assets/{assetId}/play` | Play Handler | Returns a pre-signed URL for the 30s preview audio |
| `GET` | `/assets/{assetId}/provenance` | Provenance Handler | Returns the immutable QLDB/DDB provenance record |

---

## 🔄 How the Pipeline Works

```
1. USER selects audio file + fills metadata in the UI
          │
2. Frontend calls POST /assets/upload-url
          │
3. Upload Handler generates a UUID (assetId) and writes
   PENDING state to DynamoDB. Returns a pre-signed S3 URL.
          │
4. Frontend uploads the raw audio DIRECTLY to S3 via pre-signed URL
   (bypasses API Gateway's 10MB limit)
          │
5. S3 Event Trigger fires → Audio Processor Lambda
          │
6. Audio Processor:
   ├── Downloads raw audio from S3
   ├── Generates SHA-256 hash
   ├── Generates MFCC spectral fingerprint
   ├── Copies file to Preview Bucket
   ├── Updates DynamoDB with hashes
   └── Writes immutable provenance record to Ledger
          │
7. Frontend calls POST /assets/metadata to save community info
          │
8. Asset is now discoverable in the Public Heritage Library ✅
```

---

## 🎨 Frontend Screens

### Register Heritage
Upload master audio (WAV/FLAC), specify community, language, music type, lyrics, and licensing terms. The audio is securely archived with an immutable provenance trail.

### Discover Library
Browse all public-facing cultural assets. Play 30-second degraded preview audio and verify the QLDB-backed provenance of any asset.

---

## 🧹 Cleanup

To tear down all AWS resources when done:

```bash
cdk destroy
```

> ⚠️ This will delete all buckets, tables, and Lambda functions. Audio files will be permanently lost.

---

## 📜 License

This project is built for cultural heritage preservation and is intended for **research and educational use**.

---

<p align="center">
  Built with ❤️ for Indigenous Communities
</p>
