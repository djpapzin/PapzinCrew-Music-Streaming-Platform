import pytest
import os
from unittest.mock import patch, MagicMock
from pathlib import Path
import sys
from fastapi.testclient import TestClient

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

class TestCORSConfiguration:
    """Test CORS middleware configuration and behavior."""
    
    def test_cors_with_allowed_origins_env_var(self):
        """Test CORS configuration with ALLOWED_ORIGINS environment variable."""
        test_origins = "https://papzincrew-netlify.app,http://localhost:5173,http://localhost:3000"
        
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': test_origins,
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            # Import app after setting environment variables
            from app.main import app
            client = TestClient(app)
            
            # Test preflight request from allowed origin
            response = client.options(
                "/",
                headers={
                    "Origin": "https://papzincrew-netlify.app",
                    "Access-Control-Request-Method": "GET"
                }
            )
            
            assert response.status_code in [200, 204]
            assert "access-control-allow-origin" in [h.lower() for h in response.headers.keys()]
    
    def test_cors_with_localhost_origin(self):
        """Test CORS allows localhost origins."""
        test_origins = "http://localhost:5173,http://localhost:5174"
        
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': test_origins,
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            # Test request from localhost
            response = client.get(
                "/",
                headers={"Origin": "http://localhost:5173"}
            )
            
            assert response.status_code == 200
            # Should include CORS headers
            cors_headers = [h.lower() for h in response.headers.keys()]
            assert any("access-control" in h for h in cors_headers)
    
    def test_cors_fallback_to_default_origins(self):
        """Test CORS falls back to default origins when env var not set."""
        env_without_origins = {
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }
        # Remove ALLOWED_ORIGINS if it exists
        if 'ALLOWED_ORIGINS' in env_without_origins:
            del env_without_origins['ALLOWED_ORIGINS']
        
        with patch.dict(os.environ, env_without_origins, clear=True):
            from app.main import app
            client = TestClient(app)
            
            # Test request from default localhost origin
            response = client.get(
                "/",
                headers={"Origin": "http://localhost:5173"}
            )
            
            assert response.status_code == 200
    
    def test_cors_regex_pattern_matching(self):
        """Test CORS regex pattern for localhost variations."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'ALLOWED_ORIGIN_REGEX': r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            # Test various localhost patterns
            localhost_patterns = [
                "http://localhost:3000",
                "https://localhost:8080",
                "http://127.0.0.1:5173",
                "https://127.0.0.1"
            ]
            
            for origin in localhost_patterns:
                response = client.options(
                    "/",
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": "GET"
                    }
                )
                # Should be allowed by regex pattern
                assert response.status_code in [200, 204], f"Failed for origin: {origin}"
    
    def test_cors_credentials_allowed(self):
        """Test that CORS allows credentials."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            response = client.options(
                "/",
                headers={
                    "Origin": "https://papzincrew-netlify.app",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "authorization"
                }
            )
            
            assert response.status_code in [200, 204]
            # Should allow credentials
            allow_credentials = response.headers.get("access-control-allow-credentials")
            assert allow_credentials == "true"
    
    def test_cors_all_methods_allowed(self):
        """Test that CORS allows all HTTP methods."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
            
            for method in methods:
                response = client.options(
                    "/",
                    headers={
                        "Origin": "https://papzincrew-netlify.app",
                        "Access-Control-Request-Method": method
                    }
                )
                
                assert response.status_code in [200, 204], f"Failed for method: {method}"
    
    def test_cors_headers_configuration(self):
        """Test CORS headers configuration."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            response = client.options(
                "/",
                headers={
                    "Origin": "https://papzincrew-netlify.app",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type,authorization,x-custom-header"
                }
            )
            
            assert response.status_code in [200, 204]
            
            # Check that custom headers are allowed
            allowed_headers = response.headers.get("access-control-allow-headers", "").lower()
            assert "content-type" in allowed_headers or "*" in allowed_headers
    
    def test_cors_max_age_setting(self):
        """Test CORS max-age for preflight caching."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            response = client.options(
                "/",
                headers={
                    "Origin": "https://papzincrew-netlify.app",
                    "Access-Control-Request-Method": "GET"
                }
            )
            
            assert response.status_code in [200, 204]
            
            # Check max-age header
            max_age = response.headers.get("access-control-max-age")
            assert max_age == "600"  # 10 minutes as configured

class TestEnvironmentVariableParsing:
    """Test environment variable parsing for CORS configuration."""
    
    def test_allowed_origins_parsing_with_spaces(self):
        """Test parsing ALLOWED_ORIGINS with spaces around commas."""
        test_origins = "https://example.com , http://localhost:3000 ,  https://app.example.com  "
        
        with patch.dict(os.environ, {'ALLOWED_ORIGINS': test_origins}):
            # Import the parsing logic
            from app.main import allowed_origins
            
            # Should strip spaces and parse correctly
            expected = [
                "https://example.com",
                "http://localhost:3000", 
                "https://app.example.com"
            ]
            assert allowed_origins == expected
    
    def test_allowed_origins_parsing_empty_values(self):
        """Test parsing ALLOWED_ORIGINS with empty values."""
        test_origins = "https://example.com,,http://localhost:3000,"
        
        with patch.dict(os.environ, {'ALLOWED_ORIGINS': test_origins}):
            from app.main import allowed_origins
            
            # Should filter out empty strings
            expected = ["https://example.com", "http://localhost:3000"]
            assert allowed_origins == expected
    
    def test_allowed_origins_single_value(self):
        """Test parsing ALLOWED_ORIGINS with single value."""
        test_origins = "https://papzincrew-netlify.app"
        
        with patch.dict(os.environ, {'ALLOWED_ORIGINS': test_origins}):
            from app.main import allowed_origins
            
            assert allowed_origins == ["https://papzincrew-netlify.app"]
    
    def test_allowed_origin_regex_default(self):
        """Test default ALLOWED_ORIGIN_REGEX when not set."""
        with patch.dict(os.environ, {}, clear=True):
            from app.main import allowed_origin_regex
            
            # Should have default localhost regex
            assert "localhost" in allowed_origin_regex
            assert "127\\.0\\.0\\.1" in allowed_origin_regex

class TestCORSSecurityScenarios:
    """Test CORS security scenarios and edge cases."""
    
    def test_cors_blocks_unauthorized_origin(self):
        """Test that CORS blocks requests from unauthorized origins."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            # Request from unauthorized origin
            response = client.options(
                "/",
                headers={
                    "Origin": "https://malicious-site.com",
                    "Access-Control-Request-Method": "GET"
                }
            )
            
            # Should not include CORS headers for unauthorized origin
            origin_header = response.headers.get("access-control-allow-origin")
            assert origin_header != "https://malicious-site.com"
    
    def test_cors_null_origin_handling(self):
        """Test CORS handling of null origin."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            # Request with null origin (file:// protocol)
            response = client.options(
                "/",
                headers={
                    "Origin": "null",
                    "Access-Control-Request-Method": "GET"
                }
            )
            
            # Should handle null origin appropriately
            assert response.status_code in [200, 204, 403]
    
    def test_cors_case_sensitivity(self):
        """Test CORS origin matching is case sensitive."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            # Test with different case
            response = client.options(
                "/",
                headers={
                    "Origin": "https://PAPZINCREW-NETLIFY.APP",  # Different case
                    "Access-Control-Request-Method": "GET"
                }
            )
            
            # Should not match due to case sensitivity
            origin_header = response.headers.get("access-control-allow-origin")
            assert origin_header != "https://PAPZINCREW-NETLIFY.APP"

class TestCORSIntegrationWithRouters:
    """Test CORS integration with different API routes."""
    
    def test_cors_with_upload_endpoint(self):
        """Test CORS works with upload endpoints."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            response = client.options(
                "/upload",
                headers={
                    "Origin": "https://papzincrew-netlify.app",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type"
                }
            )
            
            assert response.status_code in [200, 204]
            assert response.headers.get("access-control-allow-origin") == "https://papzincrew-netlify.app"
    
    def test_cors_with_tracks_endpoint(self):
        """Test CORS works with tracks endpoints."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'http://localhost:5173',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            response = client.options(
                "/tracks",
                headers={
                    "Origin": "http://localhost:5173",
                    "Access-Control-Request-Method": "GET"
                }
            )
            
            assert response.status_code in [200, 204]
    
    def test_cors_with_static_files(self):
        """Test CORS works with static file serving."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            # Test preflight for static files
            response = client.options(
                "/uploads/test.mp3",
                headers={
                    "Origin": "https://papzincrew-netlify.app",
                    "Access-Control-Request-Method": "GET"
                }
            )
            
            # Should allow access to static files
            assert response.status_code in [200, 204, 404]  # 404 if file doesn't exist

class TestCORSPerformance:
    """Test CORS performance and caching behavior."""
    
    def test_cors_preflight_caching(self):
        """Test CORS preflight response includes proper caching headers."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            response = client.options(
                "/",
                headers={
                    "Origin": "https://papzincrew-netlify.app",
                    "Access-Control-Request-Method": "POST"
                }
            )
            
            # Should include max-age for caching
            max_age = response.headers.get("access-control-max-age")
            assert max_age is not None
            assert int(max_age) > 0
    
    def test_cors_multiple_requests_performance(self):
        """Test CORS doesn't significantly impact performance."""
        with patch.dict(os.environ, {
            'ALLOWED_ORIGINS': 'https://papzincrew-netlify.app',
            'B2_ACCESS_KEY_ID': 'test',
            'B2_SECRET_ACCESS_KEY': 'test',
            'B2_BUCKET': 'test'
        }):
            from app.main import app
            client = TestClient(app)
            
            import time
            start_time = time.time()
            
            # Make multiple CORS requests
            for _ in range(10):
                response = client.get(
                    "/",
                    headers={"Origin": "https://papzincrew-netlify.app"}
                )
                assert response.status_code == 200
            
            elapsed_time = time.time() - start_time
            
            # Should complete reasonably quickly (adjust threshold as needed)
            assert elapsed_time < 5.0  # 5 seconds for 10 requests
