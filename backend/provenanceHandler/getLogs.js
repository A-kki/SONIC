const { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand, DescribeLogGroupsCommand } = require('@aws-sdk/client-cloudwatch-logs');
const client = new CloudWatchLogsClient({ region: 'ap-south-1' });

async function getLogs() {
    try {
        console.log("Finding AudioProcessor log group...");
        const groupsRes = await client.send(new DescribeLogGroupsCommand({ logGroupNamePrefix: '/aws/lambda/SonicStack-AudioProcessor' }));
        const group = groupsRes.logGroups.find(g => g.logGroupName.includes('AudioProcessor'));

        if (!group) {
            console.log("No log group found for AudioProcessor.");
            return;
        }

        console.log(`Found group: ${group.logGroupName}. Fetching latest streams...`);
        const streamsRes = await client.send(new DescribeLogStreamsCommand({
            logGroupName: group.logGroupName,
            orderBy: 'LastEventTime',
            descending: true,
            limit: 3
        }));

        if (streamsRes.logStreams.length === 0) {
            console.log("No log streams found.");
            return;
        }

        for (const stream of streamsRes.logStreams) {
            console.log(`\n--- Stream: ${stream.logStreamName} ---`);
            const eventsRes = await client.send(new GetLogEventsCommand({
                logGroupName: group.logGroupName,
                logStreamName: stream.logStreamName,
                limit: 20
            }));

            for (const event of eventsRes.events) {
                console.log(event.message.trim());
            }
        }
    } catch (e) {
        console.error(e);
    }
}

getLogs();
