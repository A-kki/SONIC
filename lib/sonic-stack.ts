import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as qldb from 'aws-cdk-lib/aws-qldb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class SonicStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // 1. Storage Buckets
        // Raw Audio Bucket (Strictly Private)
        const rawAudioBucket = new s3.Bucket(this, 'RawAudioBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            cors: [{
                allowedMethods: [s3.HttpMethods.PUT],
                allowedOrigins: ['*'], // Allow frontend uploads
                allowedHeaders: ['*'],
            }],
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For hackathon purposes
            autoDeleteObjects: true,
        });

        // Preview Audio Bucket (For discovery - controlled access)
        const previewAudioBucket = new s3.Bucket(this, 'PreviewAudioBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Still private, accessed via pre-signed URL only
            encryption: s3.BucketEncryption.S3_MANAGED,
            cors: [{
                allowedMethods: [s3.HttpMethods.GET],
                allowedOrigins: ['*'],
                allowedHeaders: ['*'],
            }],
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // 2. DynamoDB Table for Metadata
        const assetsTable = new dynamodb.Table(this, 'SonicAssetsTable', {
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // GSI for Public Discovery
        assetsTable.addGlobalSecondaryIndex({
            indexName: 'PublicDiscoveryIndex',
            partitionKey: { name: 'licensable', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'community', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.INCLUDE,
            nonKeyAttributes: ['musicType', 'language', 'licenseTypes', 'assetId']
        });

        // 3. Amazon QLDB for Immutable Provenance (or fallback DDB if region lacks QLDB)
        const sonicLedger = new dynamodb.Table(this, 'SonicProvenanceFallback', {
            partitionKey: { name: 'assetId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // 4. API Gateway
        const api = new apigateway.RestApi(this, 'SonicApi', {
            restApiName: 'SONIC System API',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
            }
        });

        const v1 = api.root.addResource('api').addResource('v1').addResource('assets');

        // 5. Lambda Functions

        // Upload Handler (Generates S3 Pre-signed PUT URL)
        const uploadHandler = new lambda.Function(this, 'UploadHandler', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../backend/uploadHandler')),
            environment: {
                RAW_AUDIO_BUCKET: rawAudioBucket.bucketName,
                TABLE_NAME: assetsTable.tableName
            }
        });
        rawAudioBucket.grantPut(uploadHandler);
        assetsTable.grantWriteData(uploadHandler);
        v1.addResource('upload-url').addMethod('POST', new apigateway.LambdaIntegration(uploadHandler));

        // Metadata Handler
        const metadataHandler = new lambda.Function(this, 'MetadataHandler', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../backend/metadataHandler')),
            environment: { TABLE_NAME: assetsTable.tableName }
        });
        assetsTable.grantWriteData(metadataHandler);
        v1.addResource('metadata').addMethod('POST', new apigateway.LambdaIntegration(metadataHandler));

        // Audio Processor & Fingerprinter (Python)
        const audioProcessor = new lambda.Function(this, 'AudioProcessor', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'app.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../backend/audioProcessor')),
            timeout: cdk.Duration.seconds(90),
            memorySize: 1024,
            environment: {
                RAW_AUDIO_BUCKET: rawAudioBucket.bucketName,
                PREVIEW_BUCKET: previewAudioBucket.bucketName,
                TABLE_NAME: assetsTable.tableName,
                LEDGER_NAME: sonicLedger.tableName,
            }
        });
        rawAudioBucket.grantRead(audioProcessor);
        previewAudioBucket.grantWrite(audioProcessor);
        assetsTable.grantWriteData(audioProcessor);
        sonicLedger.grantWriteData(audioProcessor);
        // Trigger Python lambda when raw audio is uploaded
        rawAudioBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(audioProcessor));

        // Discovery Handler
        const discoveryHandler = new lambda.Function(this, 'DiscoveryHandler', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../backend/discoveryHandler')),
            environment: { TABLE_NAME: assetsTable.tableName }
        });
        assetsTable.grantReadData(discoveryHandler);
        v1.addResource('public').addMethod('GET', new apigateway.LambdaIntegration(discoveryHandler));

        // Play/Preview Handler
        const playHandler = new lambda.Function(this, 'PlayHandler', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../backend/playHandler')),
            environment: { PREVIEW_BUCKET: previewAudioBucket.bucketName, TABLE_NAME: assetsTable.tableName }
        });
        previewAudioBucket.grantRead(playHandler);
        assetsTable.grantReadData(playHandler);
        const assetResource = v1.addResource('{assetId}');
        assetResource.addResource('play').addMethod('GET', new apigateway.LambdaIntegration(playHandler));

        // Provenance Handler (QLDB Reader)
        const provenanceHandler = new lambda.Function(this, 'ProvenanceHandler', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../backend/provenanceHandler')),
            environment: { LEDGER_NAME: sonicLedger.tableName, TABLE_NAME: assetsTable.tableName }
        });
        assetsTable.grantReadData(provenanceHandler);
        sonicLedger.grantReadData(provenanceHandler);
        assetResource.addResource('provenance').addMethod('GET', new apigateway.LambdaIntegration(provenanceHandler));
    }
}
