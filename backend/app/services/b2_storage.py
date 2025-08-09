import os
from typing import Optional, Dict
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError


class B2Storage:
    """Thin wrapper around S3-compatible Backblaze B2 uploads."""

    def __init__(self) -> None:
        self.endpoint_url: Optional[str] = os.getenv("B2_ENDPOINT")
        self.region_name: Optional[str] = os.getenv("B2_REGION") or "us-west-002"
        self.bucket: Optional[str] = os.getenv("B2_BUCKET")
        self.access_key: Optional[str] = os.getenv("B2_ACCESS_KEY_ID")
        self.secret_key: Optional[str] = os.getenv("B2_SECRET_ACCESS_KEY")

        if not all([self.endpoint_url, self.bucket, self.access_key, self.secret_key]):
            # Not configured; operate in disabled mode
            self.enabled = False
            self.s3 = None
            return

        self.enabled = True
        # Configure conservative timeouts and retries to avoid long hangs on network issues
        connect_timeout = int(os.getenv("B2_CONNECT_TIMEOUT", "5"))
        read_timeout = int(os.getenv("B2_READ_TIMEOUT", "15"))
        max_attempts = int(os.getenv("B2_MAX_ATTEMPTS", "3"))

        self.s3 = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            region_name=self.region_name,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(
                signature_version="s3v4",
                connect_timeout=connect_timeout,
                read_timeout=read_timeout,
                retries={"max_attempts": max_attempts, "mode": "standard"},
            ),
        )

    def is_configured(self) -> bool:
        return self.enabled

    def put_bytes(self, key: str, data: bytes, content_type: str, cache_control: str = "public, max-age=31536000") -> str:
        assert self.enabled and self.s3 is not None
        self.s3.put_object(
            Bucket=self.bucket, Key=key, Body=data, ContentType=content_type, CacheControl=cache_control
        )
        return f"{self.endpoint_url}/{self.bucket}/{key}"

    def put_file(self, key: str, file_path: str, content_type: str, cache_control: str = "public, max-age=31536000") -> str:
        assert self.enabled and self.s3 is not None
        with open(file_path, "rb") as f:
            self.s3.put_object(
                Bucket=self.bucket, Key=key, Body=f, ContentType=content_type, CacheControl=cache_control
            )
        return f"{self.endpoint_url}/{self.bucket}/{key}"

    def delete_file(self, key: str) -> bool:
        """Delete a file from B2 storage. Returns True if successful, False if file doesn't exist or error."""
        if not self.enabled or self.s3 is None:
            return False
        
        try:
            self.s3.delete_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'NoSuchKey':
                # File doesn't exist, which is fine for deletion
                return True
            else:
                print(f"Error deleting file from B2: {e}")
                return False

    def extract_key_from_url(self, url: str) -> Optional[str]:
        """Extract the object key from a B2 URL."""
        if not url or not self.enabled:
            return None
        
        # URL format: https://endpoint/bucket/key
        try:
            # Remove the endpoint and bucket from the URL
            bucket_prefix = f"{self.endpoint_url}/{self.bucket}/"
            if url.startswith(bucket_prefix):
                return url[len(bucket_prefix):]
        except Exception:
            pass
        return None


