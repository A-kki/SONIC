import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
const client = new DynamoDBClient({ region: 'ap-south-1' });

async function check() {
    try {
        const ddb = await client.send(new ScanCommand({ TableName: process.env.TABLE_NAME || 'SonicStack-SonicAssetsTableFB7312CA-2O70G5MBBFR4' }));
        console.log("=== SonicAssetsTable ===");
        console.log(JSON.stringify(ddb.Items, null, 2));

        const fallback = await client.send(new ScanCommand({ TableName: process.env.LEDGER_NAME || 'SonicStack-SonicProvenanceFallbackB4DC1156-82X5KXY1DMD8' }));
        console.log("=== SonicProvenanceFallback ===");
        console.log(JSON.stringify(fallback.Items, null, 2));
    } catch (e) {
        console.error(e);
    }
}
check();
