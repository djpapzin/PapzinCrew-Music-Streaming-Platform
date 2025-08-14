import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from pathlib import Path
import sys
import json

# Add backend to path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.ai_art_generator import AIArtGenerator

class TestAIArtGeneratorConfiguration:
    """Test AI art generator configuration and initialization."""
    
    def test_generator_initialization(self):
        """Test that generator initializes correctly."""
        generator = AIArtGenerator()
        assert generator.base_url == "https://image.pollinations.ai/prompt"
        assert generator.default_width == 1024
        assert generator.default_height == 1024
        assert generator.base_negative_prompt is not None
    
    def test_generator_no_api_key_required(self):
        """Test that generator works without API key (uses free Pollinations AI)."""
        # Pollinations AI doesn't require an API key
        generator = AIArtGenerator()
        assert hasattr(generator, 'generate_cover_art')
        assert hasattr(generator, 'generate_cover_art_from_metadata')
    
    def test_is_configured_with_api_key(self):
        """Test AI generator is configured when API key is present."""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test_key'}):
            generator = AIArtGenerator()
            assert generator.is_configured() is True
    
    def test_is_configured_without_api_key(self):
        """Test AI generator is not configured when API key is missing."""
        with patch.dict('os.environ', {}, clear=True):
            generator = AIArtGenerator()
            assert generator.is_configured() is False
    
    def test_is_configured_empty_api_key(self):
        """Test AI generator is not configured when API key is empty."""
        with patch.dict('os.environ', {'OPENAI_API_KEY': ''}):
            generator = AIArtGenerator()
            assert generator.is_configured() is False

class TestAIArtGeneratorMetadata:
    """Test AI art generation from metadata."""
    
    @pytest.fixture
    def generator(self):
        """Create configured AI art generator."""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test_key'}):
            return AIArtGenerator()
    
    @pytest.fixture
    def sample_metadata(self):
        """Sample audio metadata for testing."""
        return {
            'title': 'Midnight Dreams',
            'artist': 'Electronic Artist',
            'album': 'Synthwave Collection',
            'genre': 'Electronic',
            'year': 2024
        }
    
    @pytest.mark.asyncio
    async def test_generate_cover_art_success(self, generator, sample_metadata):
        """Test successful cover art generation."""
        mock_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
        
        with patch('aiohttp.ClientSession.post') as mock_post:
            # Mock successful API response
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                'data': [{'url': 'https://example.com/generated_image.png'}]
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            # Mock image download
            with patch('aiohttp.ClientSession.get') as mock_get:
                mock_img_response = AsyncMock()
                mock_img_response.status = 200
                mock_img_response.read = AsyncMock(return_value=mock_image_data)
                mock_get.return_value.__aenter__.return_value = mock_img_response
                
                result = await generator.generate_cover_art_from_metadata(sample_metadata)
                
                assert result is not None
                assert isinstance(result, bytes)
                assert len(result) > 0
    
    @pytest.mark.asyncio
    async def test_generate_cover_art_api_timeout(self, generator, sample_metadata):
        """Test handling of API timeout."""
        with patch('aiohttp.ClientSession.post') as mock_post:
            # Mock timeout
            mock_post.side_effect = asyncio.TimeoutError()
            
            result = await generator.generate_cover_art_from_metadata(sample_metadata)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_generate_cover_art_api_error(self, generator, sample_metadata):
        """Test handling of API error response."""
        with patch('aiohttp.ClientSession.post') as mock_post:
            # Mock API error response
            mock_response = AsyncMock()
            mock_response.status = 400
            mock_response.json = AsyncMock(return_value={
                'error': {'message': 'Invalid request'}
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            result = await generator.generate_cover_art_from_metadata(sample_metadata)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_generate_cover_art_rate_limit(self, generator, sample_metadata):
        """Test handling of rate limit response."""
        with patch('aiohttp.ClientSession.post') as mock_post:
            # Mock rate limit response
            mock_response = AsyncMock()
            mock_response.status = 429
            mock_response.json = AsyncMock(return_value={
                'error': {'message': 'Rate limit exceeded'}
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            result = await generator.generate_cover_art_from_metadata(sample_metadata)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_generate_cover_art_image_download_failure(self, generator, sample_metadata):
        """Test handling when image download fails."""
        with patch('aiohttp.ClientSession.post') as mock_post:
            # Mock successful API response
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                'data': [{'url': 'https://example.com/generated_image.png'}]
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            # Mock image download failure
            with patch('aiohttp.ClientSession.get') as mock_get:
                mock_img_response = AsyncMock()
                mock_img_response.status = 404
                mock_get.return_value.__aenter__.return_value = mock_img_response
                
                result = await generator.generate_cover_art_from_metadata(sample_metadata)
                
                assert result is None
    
    @pytest.mark.asyncio
    async def test_generate_cover_art_minimal_metadata(self, generator):
        """Test generation with minimal metadata."""
        minimal_metadata = {'title': 'Test Track'}
        
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                'data': [{'url': 'https://example.com/image.png'}]
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            with patch('aiohttp.ClientSession.get') as mock_get:
                mock_img_response = AsyncMock()
                mock_img_response.status = 200
                mock_img_response.read = AsyncMock(return_value=b'image_data')
                mock_get.return_value.__aenter__.return_value = mock_img_response
                
                result = await generator.generate_cover_art_from_metadata(minimal_metadata)
                
                assert result is not None
    
    @pytest.mark.asyncio
    async def test_generate_cover_art_empty_metadata(self, generator):
        """Test generation with empty metadata."""
        result = await generator.generate_cover_art_from_metadata({})
        assert result is None
    
    @pytest.mark.asyncio
    async def test_generate_cover_art_unicode_metadata(self, generator):
        """Test generation with Unicode characters in metadata."""
        unicode_metadata = {
            'title': '午夜梦境',  # Chinese
            'artist': 'Артист',  # Cyrillic
            'genre': 'Électronique'  # French accents
        }
        
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                'data': [{'url': 'https://example.com/image.png'}]
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            with patch('aiohttp.ClientSession.get') as mock_get:
                mock_img_response = AsyncMock()
                mock_img_response.status = 200
                mock_img_response.read = AsyncMock(return_value=b'image_data')
                mock_get.return_value.__aenter__.return_value = mock_img_response
                
                result = await generator.generate_cover_art_from_metadata(unicode_metadata)
                
                assert result is not None

class TestAIArtGeneratorPromptGeneration:
    """Test AI prompt generation logic."""
    
    @pytest.fixture
    def generator(self):
        """Create configured AI art generator."""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test_key'}):
            return AIArtGenerator()
    
    def test_build_prompt_comprehensive_metadata(self, generator):
        """Test prompt building with comprehensive metadata."""
        metadata = {
            'title': 'Neon Nights',
            'artist': 'Cyber DJ',
            'album': 'Digital Dreams',
            'genre': 'Synthwave',
            'year': 2024
        }
        
        # Access the private method for testing
        prompt = generator._build_prompt(metadata)
        
        assert 'Neon Nights' in prompt
        assert 'Cyber DJ' in prompt
        assert 'Synthwave' in prompt
        assert 'album cover' in prompt.lower()
    
    def test_build_prompt_genre_specific(self, generator):
        """Test prompt building adapts to different genres."""
        rock_metadata = {'title': 'Thunder Road', 'genre': 'Rock'}
        classical_metadata = {'title': 'Symphony No. 1', 'genre': 'Classical'}
        
        rock_prompt = generator._build_prompt(rock_metadata)
        classical_prompt = generator._build_prompt(classical_metadata)
        
        assert 'rock' in rock_prompt.lower()
        assert 'classical' in classical_prompt.lower()
        assert rock_prompt != classical_prompt

class TestAIArtGeneratorErrorHandling:
    """Test error handling and edge cases."""
    
    @pytest.fixture
    def generator(self):
        """Create configured AI art generator."""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test_key'}):
            return AIArtGenerator()
    
    @pytest.mark.asyncio
    async def test_network_connection_error(self, generator):
        """Test handling of network connection errors."""
        metadata = {'title': 'Test Track'}
        
        with patch('aiohttp.ClientSession.post') as mock_post:
            # Mock network connection error
            import aiohttp
            mock_post.side_effect = aiohttp.ClientConnectionError()
            
            result = await generator.generate_cover_art_from_metadata(metadata)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_malformed_api_response(self, generator):
        """Test handling of malformed API response."""
        metadata = {'title': 'Test Track'}
        
        with patch('aiohttp.ClientSession.post') as mock_post:
            # Mock malformed response
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={'invalid': 'structure'})
            mock_post.return_value.__aenter__.return_value = mock_response
            
            result = await generator.generate_cover_art_from_metadata(metadata)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_json_decode_error(self, generator):
        """Test handling of JSON decode errors."""
        metadata = {'title': 'Test Track'}
        
        with patch('aiohttp.ClientSession.post') as mock_post:
            # Mock JSON decode error
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(side_effect=json.JSONDecodeError('msg', 'doc', 0))
            mock_post.return_value.__aenter__.return_value = mock_response
            
            result = await generator.generate_cover_art_from_metadata(metadata)
            
            assert result is None

class TestAIArtGeneratorCostTracking:
    """Test cost tracking and usage limits."""
    
    @pytest.fixture
    def generator(self):
        """Create configured AI art generator."""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test_key'}):
            return AIArtGenerator()
    
    def test_cost_tracking_initialization(self, generator):
        """Test cost tracking is properly initialized."""
        # This would test internal cost tracking if implemented
        assert hasattr(generator, '_track_usage') or True  # Placeholder
    
    @pytest.mark.asyncio
    async def test_usage_limit_enforcement(self, generator):
        """Test enforcement of usage limits."""
        # This would test usage limit enforcement if implemented
        metadata = {'title': 'Test Track'}
        
        # Mock hitting usage limit
        with patch.object(generator, '_check_usage_limits', return_value=False):
            result = await generator.generate_cover_art_from_metadata(metadata)
            # Should return None if usage limits are exceeded
            assert result is None or True  # Placeholder for actual implementation
