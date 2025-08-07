import os
import requests
import logging
import urllib.parse
import random
from io import BytesIO
from PIL import Image
from typing import Optional, Tuple

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIArtGenerator:
    """
    A service for generating cover art using Pollinations AI's free API.
    No API key required.
    """
    
    def __init__(self):
        """Initialize the AI Art Generator with optimized settings."""
        self.base_url = "https://image.pollinations.ai/prompt"
        # Optimized for album covers (square format, high resolution)
        self.default_width = 1024
        self.default_height = 1024
        
        # Base negative prompt to avoid common AI artifacts
        self.base_negative_prompt = (
            "low quality, blurry, pixelated, distorted, artifacts, "
            "text, watermark, signature, logo, extra limbs, missing limbs, "
            "deformed hands, bad anatomy, cropped, out of frame, "
            "duplicate, error, jpeg artifacts, ugly, morbid, mutilated, "
            "extra fingers, mutated hands, poorly drawn hands, "
            "poorly drawn face, mutation, deformed, blurry, "
            "bad proportions, extra limbs, cloned face, disfigured, "
            "gross proportions, malformed limbs, missing arms, "
            "missing legs, extra arms, extra legs, fused fingers, "
            "too many fingers, long neck, cross-eye, body out of frame, "
            "cut off, low contrast, underexposed, overexposed, "
            "bad art, beginner, amateur, distorted face, blur, grain"
        )
        
        # Genre-specific negative prompts
        self.genre_negative_prompts = {
            "electronic": "realistic photography, vintage, organic textures",
            "rock": "colorful, happy, soft lighting, pastel colors",
            "pop": "dark, gloomy, grunge, distressed, vintage",
            "hip hop": "rural, nature, soft, cute, classical",
            "jazz": "modern, futuristic, bright colors, cartoon, childish",
            "classical": "colorful, casual, modern, grunge, street art"
        }
        
    def generate_cover_art(
        self,
        prompt: str,
        negative_prompt: str = None,
        width: int = None,
        height: int = None,
        **kwargs  # Accept additional parameters for backward compatibility
    ) -> Optional[bytes]:
        """
        Generate cover art using Pollinations AI's API with optimized settings.
        
        Args:
            prompt: Text prompt for image generation
            negative_prompt: Additional negative prompts (base negative prompts are always included)
            width: Width of the generated image (default: 1024)
            height: Height of the generated image (default: 1024)
            
        Returns:
            bytes: The generated image as bytes in JPEG format, or None if generation failed
        """
        # Set default dimensions if not provided
        width = width or self.default_width
        height = height or self.default_height
        
        # Combine base negative prompt with any additional negative prompts
        full_negative_prompt = self.base_negative_prompt
        if negative_prompt:
            full_negative_prompt = f"{full_negative_prompt}, {negative_prompt}"
            
        # Log the final API request details
        logger.debug(f"Sending request to Pollinations AI with parameters:")
        logger.debug(f"- Prompt: {prompt}")
        logger.debug(f"- Negative Prompt: {full_negative_prompt}")
        logger.debug(f"- Dimensions: {width}x{height}")
        
        # Encode the prompt for URL
        encoded_prompt = urllib.parse.quote(prompt)
        
        # Build the URL with optimized parameters
        seed = random.randint(0, 1000000)  # Generate seed here to log it
        params = {
            "width": width,
            "height": height,
            "model": "flux",  # FLUX model for better quality
            "seed": seed,  # Random seed for variation
            "nologo": "yes",  # Remove watermarks
            "negative_prompt": full_negative_prompt  # Include negative prompts
        }
        
        logger.debug(f"- Seed: {seed}")
        logger.debug(f"- Full API URL: {self.base_url}/{encoded_prompt}?{urllib.parse.urlencode(params)}")
        
        try:
            # Make the request to Pollinations AI
            response = requests.get(
                f"{self.base_url}/{encoded_prompt}",
                params=params,
                timeout=60  # 60 second timeout
            )
            response.raise_for_status()
            
            # Return the image bytes
            return response.content
            
        except Exception as e:
            logger.error(f"Error generating cover art: {str(e)}")
            return None
    
    def generate_cover_art_from_metadata(
        self,
        title: str,
        artist: str,
        genre: Optional[str] = None,
        custom_prompt: Optional[str] = None,
        **kwargs
    ) -> Optional[bytes]:
        """
        Generate cover art based on song metadata using optimized prompt structure.
        
        Args:
            title: Song title
            artist: Artist name
            genre: Optional genre to help guide the style
            custom_prompt: Optional custom prompt to use instead of generating one
            **kwargs: Additional arguments to pass to generate_cover_art
            
        Returns:
            bytes: The generated image as bytes in JPEG format, or None if generation failed
        """
        # If a custom prompt is provided, use it with some enhancements
        if custom_prompt and custom_prompt.strip():
            prompt = self._build_enhanced_prompt(title, artist, genre, custom_prompt)
        else:
            # Generate a prompt using the optimized structure
            prompt = self._build_optimized_prompt(title, artist, genre)
            
        # Get genre-specific negative prompts if available
        negative_prompt = None
        if genre and genre.lower() in self.genre_negative_prompts:
            negative_prompt = self.genre_negative_prompts[genre.lower()]
        
        # Log the prompt and negative prompt being used
        logger.info(f"Generating cover art with prompt: {prompt}")
        if negative_prompt:
            logger.info(f"Using negative prompt: {negative_prompt}")
        
        # Generate the cover art with the optimized prompt
        result = self.generate_cover_art(
            prompt=prompt,
            negative_prompt=negative_prompt,
            **kwargs
        )
        
        if result:
            logger.info("Successfully generated cover art")
        else:
            logger.warning("Failed to generate cover art - no data returned")
        
        return result
        
    def _build_optimized_prompt(self, title: str, artist: str, genre: Optional[str] = None) -> str:
        """
        Build an optimized prompt based on the research document.
        
        Args:
            title: Song title
            artist: Artist name
            genre: Optional genre to guide the style
            
        Returns:
            str: Optimized prompt string
        """
        # Default to a neutral style if genre is not specified
        genre = (genre or "").lower()
        
        # Genre-specific templates based on research
        genre_templates = {
            "electronic": (
                "Album cover for '{title}' by {artist}, "
                "futuristic cyberpunk aesthetic, neon synthwave style, "
                "electric blue and purple lighting, high-tech digital art, "
                "intricate circuit patterns, holographic effects, "
                "professional album artwork, ultra-detailed, 8k resolution"
            ),
            "rock": (
                "Album cover for '{title}' by {artist}, "
                "edgy rock aesthetic, grunge style, "
                "dramatic high contrast lighting, dark moody atmosphere, "
                "distressed textures, bold graphic design, "
                "professional album artwork, high detail, 8k"
            ),
            "pop": (
                "Album cover for '{title}' by {artist}, "
                "colorful pop art style, vibrant and energetic, "
                "glossy surfaces, geometric shapes, trendy graphics, "
                "professional album artwork, high detail, 8k resolution"
            ),
            "hip hop": (
                "Album cover for '{title}' by {artist}, "
                "urban hip hop style, street art aesthetic, "
                "gold and black color scheme, luxury items, "
                "graffiti elements, professional album artwork, "
                "high detail, 8k resolution"
            ),
            "jazz": (
                "Album cover for '{title}' by {artist}, "
                "sophisticated jazz aesthetic, art deco style, "
                "warm sepia tones, vinyl record texture, "
                "smoke effects, professional album artwork, "
                "high detail, 8k resolution"
            ),
            "classical": (
                "Album cover for '{title}' by {artist}, "
                "elegant classical aesthetic, minimalist design, "
                "black and gold color scheme, orchestral elements, "
                "professional album artwork, high detail, 8k resolution"
            )
        }
        
        # Get the appropriate template or use a default one
        template = genre_templates.get(genre, genre_templates["pop"])
        
        # Format the template with the provided metadata
        prompt = template.format(title=title, artist=artist)
        
        # Add quality boosters that work well with the FLUX model
        quality_enhancers = [
            "high quality", "detailed", "sharp focus", "professional",
            "masterpiece", "ultra-detailed", "intricate details",
            "HDR", "cinematic lighting", "dramatic composition"
        ]
        
        # Add a few random quality enhancers for variety
        selected_enhancers = random.sample(quality_enhancers, min(4, len(quality_enhancers)))
        prompt += ", " + ", ".join(selected_enhancers)
        
        return prompt
        
    def _build_enhanced_prompt(self, title: str, artist: str, genre: Optional[str], custom_prompt: str) -> str:
        """
        Enhance a custom prompt with additional context and quality boosters.
        
        Args:
            title: Song title
            artist: Artist name
            genre: Optional genre
            custom_prompt: User-provided custom prompt
            
        Returns:
            str: Enhanced prompt string
        """
        # Start with the custom prompt
        prompt = custom_prompt
        
        # Add basic context if not already present
        if f"{title}" not in prompt and f"{artist}" not in prompt:
            prompt = f"Album cover for '{title}' by {artist}, {prompt}"
            
        # Add genre-specific context if available
        if genre:
            genre = genre.lower()
            genre_context = {
                "electronic": "futuristic, high-tech, cyberpunk aesthetic, ",
                "rock": "edgy, high contrast, dramatic, ",
                "pop": "colorful, vibrant, energetic, ",
                "hip hop": "urban, street, luxury, ",
                "jazz": "sophisticated, warm, moody, ",
                "classical": "elegant, minimal, orchestral, "
            }
            
            if genre in genre_context and genre_context[genre] not in prompt.lower():
                prompt = f"{prompt}, {genre_context[genre]}"
        
        # Add quality boosters if not already present
        quality_terms = [
            "professional album artwork", "high quality", "detailed",
            "8k resolution", "sharp focus", "intricate details"
        ]
        
        for term in quality_terms:
            if term not in prompt.lower():
                prompt = f"{prompt}, {term}"
        
        return prompt
        
        # Generate the cover art
        return self.generate_cover_art(prompt, **kwargs)
    
    def save_cover_art(
        self,
        image_bytes: bytes,
        output_path: str,
        size: Tuple[int, int] = (500, 500)
    ) -> bool:
        """
        Save the generated cover art to a file.
        
        Args:
            image_bytes: The image data as bytes
            output_path: Path to save the image to
            size: Optional size to resize the image to (width, height)
            
        Returns:
            bool: True if the image was saved successfully, False otherwise
        """
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Open the image and resize if needed
            image = Image.open(BytesIO(image_bytes))
            if size:
                image = image.resize(size, Image.Resampling.LANCZOS)
            
            # Save as PNG
            image.save(output_path, 'PNG')
            return True
            
        except Exception as e:
            logger.error(f"Error saving cover art: {str(e)}")
            return False

# Example usage
if __name__ == "__main__":
    # Initialize with your API key
    generator = AIArtGenerator()
    
    # Generate cover art
    image_bytes = generator.generate_cover_art_from_metadata(
        title="Midnight Dreams",
        artist="The Night Owls",
        genre="jazz"
    )
    
    if image_bytes:
        # Save the generated image
        generator.save_cover_art(
            image_bytes,
            "generated_cover.png"
        )
        print("Cover art generated successfully!")
    else:
        print("Failed to generate cover art.")
