import json
import boto3
import os
import hashlib
from datetime import datetime
import tempfile
import urllib.parse

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

def get_fallback_audio_hash(file_path):
    # For Hackathon purposes since librosa C-bindings can't build locally
    # We will generate a mock "Spectral/MFCC hash" using the raw bytes 
    # to symbolize the fingerprinting process.
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    
    sha256_hash = hasher.hexdigest()
    # Mocking an MFCC spectral hash based on the SHA256 bytes
    mock_mfcc_hash = "mfcc-" + hashlib.md5(buf).hexdigest() 
    return sha256_hash, mock_mfcc_hash

def update_dynamodb(asset_id, audio_hash, fingerprint_hash):
    table = dynamodb.Table(os.environ['TABLE_NAME'])
    table.update_item(
        Key={'PK': f"ASSET#{asset_id}", 'SK': "METADATA"},
        UpdateExpression="SET audioHash = :ah, fingerprintHash = :fh",
        ExpressionAttributeValues={
            ':ah': audio_hash,
            ':fh': fingerprint_hash
        }
    )

def handler(event, context):
    print("Received event: ", json.dumps(event))
    
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        
        # S3 event keys are URL encoded, we must decode them!
        raw_key = record['s3']['object']['key']
        key = urllib.parse.unquote_plus(raw_key)

        # Key format: secure-audio/<asset_id>/filename.ext
        # Extract asset_id specifically
        parts = key.split('/')
        if len(parts) > 1:
            asset_id = parts[1]
        else:
            asset_id = key.split('.')[0]
        
        # Download raw audio
        download_path = os.path.join(tempfile.gettempdir(), key)
        os.makedirs(os.path.dirname(download_path), exist_ok=True)
        s3.download_file(bucket, key, download_path)
        
        # 1. Fingerprint (Mocked for deployment bounds)
        audio_hash, fingerprint_hash = get_fallback_audio_hash(download_path)
        
        # 2. Upload "Preview" (For hackathon, we'll just copy the file over to the public bucket)
        # In actual prod we'd use ffmpeg to degrade audio, but lambda layers are missing
        preview_key = f"{asset_id}.mp3"
        s3.copy_object(
            Bucket=os.environ['PREVIEW_BUCKET'],
            CopySource={'Bucket': bucket, 'Key': key},
            Key=preview_key
        )
            
        update_dynamodb(asset_id, audio_hash, fingerprint_hash)
        
        # 3. Write to Fallback Provenance Ledger
        provenance_table = dynamodb.Table(os.environ['LEDGER_NAME'])
        provenance_table.put_item(
            Item={
                'assetId': asset_id,
                'audioHash': audio_hash,
                'fingerprintHash': fingerprint_hash,
                'timestamp': datetime.utcnow().isoformat() + "Z",
                'note': "Stored in Fallback DDB Ledger (QLDB unavailable in this region)"
            }
        )
        
        os.remove(download_path)
        print(f"Successfully processed asset {asset_id}")
        
    return {"statusCode": 200, "body": "Success"}
