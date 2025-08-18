import os
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Lazy imports for boto3/botocore to avoid import-time warnings during tests.
# We bind real classes only when S3-compatible mode is actually used.
boto3 = None  # type: ignore
Config = None  # type: ignore

class _BotocorePlaceholder(Exception):
    pass

# Placeholders to keep except clauses valid even if botocore isn't installed.
ClientError = _BotocorePlaceholder  # type: ignore
EndpointConnectionError = _BotocorePlaceholder  # type: ignore
BotoCoreError = _BotocorePlaceholder  # type: ignore

# Optional Backblaze native SDK imports (tests may patch B2Api symbol)
try:
    from b2sdk.v2 import B2Api, InMemoryAccountInfo  # type: ignore
except Exception:  # pragma: no cover - not required in production path
    B2Api = None  # type: ignore
    InMemoryAccountInfo = None  # type: ignore


class B2Storage:
    """Thin wrapper around S3-compatible Backblaze B2 uploads."""

    def __init__(self) -> None:
        # Do NOT auto-load .env. Allow explicit opt-in via env flag.
        if os.getenv("B2_LOAD_DOTENV") == "1":
            load_dotenv('.env')
        # S3-compatible envs
        self.endpoint_url: Optional[str] = os.getenv("B2_ENDPOINT")
        self.region_name: Optional[str] = os.getenv("B2_REGION") or "us-west-002"
        self.bucket: Optional[str] = os.getenv("B2_BUCKET")
        self.access_key: Optional[str] = os.getenv("B2_ACCESS_KEY_ID")
        self.secret_key: Optional[str] = os.getenv("B2_SECRET_ACCESS_KEY")

        # Native B2 envs (used by unit tests)
        self.application_key_id: Optional[str] = os.getenv("B2_APPLICATION_KEY_ID")
        self.application_key: Optional[str] = os.getenv("B2_APPLICATION_KEY")
        self.bucket_name_native: Optional[str] = os.getenv("B2_BUCKET_NAME")

        # Determine operating mode
        self.mode: str = "disabled"
        self.s3 = None
        self.enabled = False

        if all([self.application_key_id, self.application_key, self.bucket_name_native]):
            # Prefer native mode if explicitly configured (aligns with tests)
            self.mode = "native"
            self.enabled = True
        elif all([self.endpoint_url, self.bucket, self.access_key, self.secret_key]):
            # Attempt to enable S3-compatible mode with lazy imports.
            try:
                import boto3 as _boto3  # type: ignore
                from botocore.client import Config as _Config  # type: ignore
                from botocore.exceptions import (
                    ClientError as _ClientError,  # type: ignore
                    EndpointConnectionError as _EndpointConnectionError,  # type: ignore
                    BotoCoreError as _BotoCoreError,  # type: ignore
                )
                # Bind into module globals so except clauses resolve real classes at runtime
                globals().update(
                    boto3=_boto3,
                    Config=_Config,
                    ClientError=_ClientError,
                    EndpointConnectionError=_EndpointConnectionError,
                    BotoCoreError=_BotoCoreError,
                )
            except Exception:
                # If boto3/botocore are unavailable, disable S3 mode gracefully
                self.mode = "disabled"
                self.enabled = False
                self.s3 = None
                return

            self.mode = "s3"
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

    def put_bytes_safe(self, key: str, data: bytes, content_type: str, cache_control: str = "public, max-age=31536000") -> Dict[str, Any]:
        """
        Upload bytes to B2 and return a structured result instead of raising.
        Result shape:
          { ok: bool, url?: str, key?: str, error_code?: str, detail?: str }
        """
        if not self.enabled:
            return {"ok": False, "error_code": "not_configured", "detail": "B2 storage not configured"}

        # Native B2 path (used by tests; B2Api is patched there)
        if self.mode == "native":
            try:
                # Instantiate API (unit tests patch B2Api to a MagicMock). If b2sdk is not
                # installed (InMemoryAccountInfo is None) but B2Api is patched, fall back
                # to calling B2Api() without arguments.
                api = None
                if B2Api:  # type: ignore[truthy-bool]
                    try:
                        api = B2Api(InMemoryAccountInfo()) if InMemoryAccountInfo else B2Api()  # type: ignore
                    except TypeError:
                        # Some patched or SDK constructors may not accept args; retry default ctor
                        api = B2Api()
                if api is None:
                    # If SDK is unavailable and not patched, simulate not configured
                    return {"ok": False, "error_code": "sdk_missing", "detail": "b2sdk not installed"}
                api.authorize_account("production", self.application_key_id, self.application_key)  # type: ignore[arg-type]
                bucket = api.get_bucket_by_name(self.bucket_name_native)  # type: ignore[assignment]
                # In b2sdk, upload_bytes accepts (data, file_name, content_type=...)
                file_info = bucket.upload_bytes(data, key, content_type=content_type)
                return {"ok": True, "url": self._generate_public_url(key), "key": key}
            except Exception as e:
                # Map to a generic error_code for tests
                return {"ok": False, "error_code": "client_error", "detail": str(e)}

        # S3-compatible path
        try:
            assert self.s3 is not None and self.bucket is not None
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                CacheControl=cache_control,
            )
            return {"ok": True, "url": f"{self.endpoint_url}/{self.bucket}/{key}", "key": key}
        except ClientError as e:
            code = self._map_client_error(e)
            detail = str(e)
            return {"ok": False, "error_code": code, "detail": detail}
        except EndpointConnectionError as e:
            return {"ok": False, "error_code": "network_error", "detail": str(e)}
        except BotoCoreError as e:
            return {"ok": False, "error_code": "boto_error", "detail": str(e)}
        except Exception as e:
            return {"ok": False, "error_code": "unknown_error", "detail": str(e)}

    def _map_client_error(self, e: ClientError) -> str:
        """Map boto3 ClientError to a stable error_code string."""
        try:
            err = e.response.get("Error", {})
            code = (err.get("Code") or "").lower()
            if code in {"invalidaccesskeyid", "signaturedoesnotmatch", "accessdenied", "invalidtoken"}:
                return "auth_error"
            if code in {"nosuchbucket", "bucketnotfound"}:
                return "bucket_not_found"
            if code in {"requesttimeout", "requesttimedout"}:
                return "timeout"
            if code in {"slowdown", "throttling", "toomanyrequests"}:
                return "rate_limited"
            return code or "client_error"
        except Exception:
            return "client_error"

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

    def build_url(self, key: str) -> Optional[str]:
        """Build a public URL to an object key."""
        if not self.enabled:
            return None

    # Helper for unit tests to patch; builds a public URL for a given key
    def _generate_public_url(self, key: str) -> str:
        if self.mode == "native":
            # Prefer endpoint env if provided (e.g., CDN or S3 gateway). Fallback to a generic pattern.
            base = os.getenv("B2_ENDPOINT")
            bucket = self.bucket_name_native or self.bucket or ""
            if base:
                return f"{base}/{bucket}/{key}"
            # Generic Backblaze-style URL placeholder
            return f"https://example-b2/{bucket}/{key}"
        # S3-compatible
        if self.endpoint_url and self.bucket:
            return f"{self.endpoint_url}/{self.bucket}/{key}"
        return key
        return f"{self.endpoint_url}/{self.bucket}/{key}"

    def head_object(self, key: str) -> Dict[str, Any]:
        """HEAD an object and return metadata; returns {ok: bool, status: int, exists: bool}."""
        if not self.enabled or self.s3 is None:
            return {"ok": False, "exists": False, "status": 0}
        try:
            resp = self.s3.head_object(Bucket=self.bucket, Key=key)
            return {"ok": True, "exists": True, "status": 200, "meta": resp}
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code")
            if code in ("404", "NoSuchKey"):
                return {"ok": True, "exists": False, "status": 404}
            return {"ok": False, "exists": False, "status": int(e.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 500) or 500), "error": str(e)}
        except Exception as e:
            return {"ok": False, "exists": False, "status": 0, "error": str(e)}

    def object_exists(self, key: str) -> bool:
        res = self.head_object(key)
        return bool(res.get("ok") and res.get("exists"))

    def list_objects(self, prefix: str, max_keys: int = 1000) -> Dict[str, Any]:
        """List objects under a prefix. Returns {ok, items:[{Key, Size, LastModified}], error?}."""
        if not self.enabled or self.s3 is None:
            return {"ok": False, "items": [], "error": "not_configured"}
        try:
            items: list[Dict[str, Any]] = []
            continuation_token: Optional[str] = None
            while True:
                kwargs: Dict[str, Any] = {"Bucket": self.bucket, "Prefix": prefix, "MaxKeys": max_keys}
                if continuation_token:
                    kwargs["ContinuationToken"] = continuation_token
                resp = self.s3.list_objects_v2(**kwargs)
                for obj in resp.get("Contents", []) or []:
                    items.append({
                        "Key": obj.get("Key"),
                        "Size": obj.get("Size"),
                        "LastModified": obj.get("LastModified"),
                    })
                if not resp.get("IsTruncated"):
                    break
                continuation_token = resp.get("NextContinuationToken")
                if not continuation_token:
                    break
            return {"ok": True, "items": items}
        except ClientError as e:
            return {"ok": False, "items": [], "error": str(e)}
        except Exception as e:
            return {"ok": False, "items": [], "error": str(e)}

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

    def check_health(self) -> Dict[str, Any]:
        """Check B2 configuration and bucket accessibility."""
        if not self.enabled or self.s3 is None:
            return {"configured": False, "ok": False, "error_code": "not_configured"}
        try:
            # HEAD the bucket to validate connectivity, auth and bucket existence
            self.s3.head_bucket(Bucket=self.bucket)
            return {
                "configured": True,
                "ok": True,
                "endpoint": self.endpoint_url,
                "bucket": self.bucket,
                "region": self.region_name,
            }
        except ClientError as e:
            code = self._map_client_error(e)
            return {"configured": True, "ok": False, "error_code": code, "detail": str(e)}
        except EndpointConnectionError as e:
            return {"configured": True, "ok": False, "error_code": "network_error", "detail": str(e)}
        except BotoCoreError as e:
            return {"configured": True, "ok": False, "error_code": "boto_error", "detail": str(e)}
        except Exception as e:
            return {"configured": True, "ok": False, "error_code": "unknown_error", "detail": str(e)}


