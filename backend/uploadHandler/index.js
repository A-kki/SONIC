import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body || "{}");
        const { filename, contentType } = body;

        if (!filename || !contentType) {
            return { statusCode: 400, body: JSON.stringify({ error: "filename and contentType required" }), headers: { 'Access-Control-Allow-Origin': '*' } };
        }

        const assetId = randomUUID();
        const s3Key = `secure-audio/${assetId}/${filename}`;

        const command = new PutObjectCommand({
            Bucket: process.env.RAW_AUDIO_BUCKET,
            Key: s3Key,
            ContentType: contentType
        });

        // 5-minute pre-signed URL
        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

        // Save initial pending state
        await docClient.send(new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
                PK: `ASSET#${assetId}`,
                SK: `METADATA`,
                assetId: assetId,
                uploadStatus: 'PENDING',
                s3Key: s3Key,
                createdAt: new Date().toISOString()
            }
        }));

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ assetId, uploadUrl })
        };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }), headers: { 'Access-Control-Allow-Origin': '*' } };
    }
};
