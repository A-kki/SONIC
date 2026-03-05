import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event) => {
    try {
        const assetId = event.pathParameters?.assetId;

        if (!assetId) {
            return { statusCode: 400, body: JSON.stringify({ error: "assetId required" }), headers: { 'Access-Control-Allow-Origin': '*' } };
        }

        const previewKey = `${assetId}.mp3`;

        const command = new GetObjectCommand({
            Bucket: process.env.PREVIEW_BUCKET,
            Key: previewKey
        });

        // Short-lived 60-second URL
        const previewUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ assetId, previewUrl })
        };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }), headers: { 'Access-Control-Allow-Origin': '*' } };
    }
};
