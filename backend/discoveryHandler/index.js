import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
    try {
        const command = new QueryCommand({
            TableName: process.env.TABLE_NAME,
            IndexName: 'PublicDiscoveryIndex',
            KeyConditionExpression: "licensable = :lval",
            ExpressionAttributeValues: {
                ":lval": "true"
            }
        });

        const response = await docClient.send(command);

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(response.Items || [])
        };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }), headers: { 'Access-Control-Allow-Origin': '*' } };
    }
};
