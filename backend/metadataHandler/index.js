import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body || "{}");
        const { assetId, musicType, language, community, licensable, licenseTypes, lyrics } = body;

        if (!assetId || !community) {
            return { statusCode: 400, body: JSON.stringify({ error: "assetId and community required" }), headers: { 'Access-Control-Allow-Origin': '*' } };
        }

        await docClient.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                PK: `ASSET#${assetId}`,
                SK: `METADATA`
            },
            UpdateExpression: "SET musicType = :mt, #lang = :ln, community = :cm, licensable = :lc, licenseTypes = :lt, lyrics = :ly",
            ExpressionAttributeNames: {
                "#lang": "language"
            },
            ExpressionAttributeValues: {
                ":mt": musicType || "unknown",
                ":ln": language || "unknown",
                ":cm": community,
                ":lc": licensable === true ? "true" : "false", // Use string for GSI partition key
                ":lt": licenseTypes || [],
                ":ly": lyrics || ""
            }
        }));

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ status: "success", assetId })
        };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }), headers: { 'Access-Control-Allow-Origin': '*' } };
    }
};
