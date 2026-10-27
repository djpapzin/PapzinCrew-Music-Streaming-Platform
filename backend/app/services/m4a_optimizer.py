"""Lossless upload-time M4A normalization, before any cloud storage writes."""
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile


class M4AOptimizationError(RuntimeError):
    pass


def _run(args: list[str]) -> bytes:
    try:
        return subprocess.run(args, capture_output=True, check=True, timeout=90).stdout
    except (OSError, subprocess.SubprocessError) as exc:
        raise M4AOptimizationError('M4A verification or lossless optimization failed') from exc


def _fast_start(data: bytes) -> bool:
    position = 0
    metadata_seen = False
    while position + 8 <= len(data):
        size, kind = struct.unpack('>I4s', data[position:position + 8])
        if size < 8 or position + size > len(data):
            return False
        if kind == b'moov':
            metadata_seen = True
        if kind == b'mdat':
            return metadata_seen
        position += size
    return False


def optimize_m4a(data: bytes) -> tuple[bytes, dict]:
    """Copy one audio stream exactly; remove pictures/chapters and front-load metadata.

    Fail closed if dependencies, copy verification, or output structure are invalid.
    Temporary source/output files are local and removed before returning. Only the
    verified output is handed to B2; no original cloud object is created.
    """
    ffmpeg, ffprobe = shutil.which('ffmpeg'), shutil.which('ffprobe')
    if not ffmpeg or not ffprobe:
        raise M4AOptimizationError('M4A uploads require FFmpeg and FFprobe')
    with tempfile.TemporaryDirectory(prefix='papzin-m4a-') as directory:
        source, target = Path(directory) / 'source.m4a', Path(directory) / 'optimized.m4a'
        source.write_bytes(data)
        def probe(path: Path) -> dict:
            try:
                return json.loads(_run([ffprobe, '-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_chapters', '-of', 'json', str(path)]))
            except (ValueError, TypeError) as exc:
                raise M4AOptimizationError('Invalid M4A inspection result') from exc
        before = probe(source)
        audio = [s for s in before.get('streams', []) if s.get('codec_type') == 'audio']
        if len(audio) != 1:
            raise M4AOptimizationError('M4A must contain exactly one audio stream; no streams will be discarded silently')
        _run([ffmpeg, '-v', 'error', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', str(source), '-map', '0:a:0', '-c:a', 'copy', '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', str(target)])
        def packet_hash(path: Path) -> str:
            result = _run([ffmpeg, '-v', 'error', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', str(path), '-map', '0:a:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).decode().strip()
            if not result.startswith('SHA256=') or len(result) != 71:
                raise M4AOptimizationError('Missing compressed audio verification hash')
            return result
        original_hash, optimized_hash = packet_hash(source), packet_hash(target)
        output = target.read_bytes()
        after = probe(target)
        if original_hash != optimized_hash or not _fast_start(output) or after.get('chapters') or len(after.get('streams', [])) != 1:
            raise M4AOptimizationError('Optimized M4A did not pass lossless playback checks')
        return output, {'mode': 'lossless_m4a_faststart', 'verified_audio_packets': True, 'audio_packet_sha256': optimized_hash[7:], 'source_sha256': hashlib.sha256(data).hexdigest(), 'stored_sha256': hashlib.sha256(output).hexdigest()}
