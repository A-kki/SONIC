const fs = require('fs');

async function testUpload() {
    const API_URL = "https://4z2cv12blg.execute-api.ap-south-1.amazonaws.com/prod/api/v1";
    console.log("Starting test...");

    // 1. Get Pre-signed URL
    const urlRes = await fetch(`${API_URL}/assets/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: "test.mp3", contentType: "audio/mpeg" })
    });
    const { assetId, uploadUrl } = await urlRes.json();
    console.log(`Got asset ID: ${assetId}`);

    // 2. Upload dummy data directly to S3
    const dummyData = new Blob(["mock-audio-bytes"]);
    await fetch(uploadUrl, {
        method: 'PUT',
        body: dummyData,
        headers: { 'Content-Type': "audio/mpeg" }
    });
    console.log("Uploaded mock audio to S3.");

    // 3. Register Metadata
    await fetch(`${API_URL}/assets/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            assetId, community: "Test Comm", language: "English", musicType: "Test",
            licensable: true, licenseTypes: ["CC0"]
        })
    });
    console.log("Registered metadata.");

    // 4. Wait for Python Lambda to process
    console.log("Waiting 5 seconds for Python Lambda trigger...");
    await new Promise(r => setTimeout(r, 5000));

    // 5. Verify Provenance
    const provRes = await fetch(`${API_URL}/assets/${assetId}/provenance`);
    const data = await provRes.json();
    console.log("Provenance Result:", JSON.stringify(data, null, 2));
}

testUpload().catch(console.error);
