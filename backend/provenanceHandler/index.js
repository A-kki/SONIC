const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
    try {
        const assetId = event.pathParameters?.assetId;

        if (!assetId) {
            return { statusCode: 400, body: JSON.stringify({ error: "assetId required" }), headers: { 'Access-Control-Allow-Origin': '*' } };
        }

        // 1. Get DDB metadata to verify existence
        const ddbRes = await docClient.send(new GetCommand({
            TableName: process.env.TABLE_NAME,
            Key: { PK: `ASSET#${assetId}`, SK: `METADATA` }
        }));

        if (!ddbRes.Item) {
            return { statusCode: 404, body: JSON.stringify({ error: "Asset not found" }), headers: { 'Access-Control-Allow-Origin': '*' } };
        }

        // 2. Query Fallback DDB Ledger for the immutable provenance record
        const ledgerRes = await docClient.send(new GetCommand({
            TableName: process.env.LEDGER_NAME,
            Key: { assetId: assetId }
        }));

        let provenanceRecord = ledgerRes.Item;

        // 3. Fallback mock for hackathon if ledger is empty (because audio processor hasn't run yet)
        if (!provenanceRecord) {
            provenanceRecord = {
                assetId: assetId,
                audioHash: ddbRes.Item.audioHash || "pending...",
                fingerprintHash: ddbRes.Item.fingerprintHash || "pending...",
                community: ddbRes.Item.community,
                timestamp: ddbRes.Item.createdAt,
                note: "Audio processing is pending. Ledger record will appear shortly."
            };
        }

        // Combine community name from main DDB since ledger only stores structural hashes
        if (provenanceRecord && !provenanceRecord.community) {
            provenanceRecord.community = ddbRes.Item.community;
        }

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                status: "VERIFIED",
                provenance: provenanceRecord
            })
        };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }), headers: { 'Access-Control-Allow-Origin': '*' } };
    }
};
