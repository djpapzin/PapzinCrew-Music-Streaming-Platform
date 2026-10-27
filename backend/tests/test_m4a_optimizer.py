import shutil
import subprocess
from pathlib import Path
import pytest
from app.services import m4a_optimizer as optimizer


@pytest.fixture
def legacy_m4a(tmp_path):
    ffmpeg = shutil.which('ffmpeg')
    assert ffmpeg and shutil.which('ffprobe'), 'Install FFmpeg/FFprobe to test M4A intake'
    metadata = tmp_path / 'chapters.txt'
    metadata.write_text(';FFMETADATA1\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=6000\ntitle=Legacy test chapter\n')
    source = tmp_path / 'legacy.m4a'
    subprocess.run([ffmpeg, '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=521:duration=6', '-i', str(metadata), '-map', '0:a:0', '-map_metadata', '1', '-map_chapters', '1', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', str(source)], check=True)
    return source.read_bytes()


def test_remux_preserves_audio_and_removes_legacy_metadata(legacy_m4a):
    output, result = optimizer.optimize_m4a(legacy_m4a)
    assert output != legacy_m4a
    assert optimizer._fast_start(output)
    assert result['verified_audio_packets'] is True
    assert len(result['audio_packet_sha256']) == 64
    assert result['source_sha256'] != result['stored_sha256']


def test_missing_tools_rejects_before_processing(monkeypatch):
    monkeypatch.setattr(optimizer.shutil, 'which', lambda _: None)
    with pytest.raises(optimizer.M4AOptimizationError, match='require FFmpeg'):
        optimizer.optimize_m4a(b'not processed')


def test_packet_mismatch_is_rejected(legacy_m4a, monkeypatch):
    run = optimizer._run
    hashes = 0
    def changed_hash(args):
        nonlocal hashes
        if 'hash' in args:
            hashes += 1
            if hashes == 2:
                return b'SHA256=' + b'0' * 64
        return run(args)
    monkeypatch.setattr(optimizer, '_run', changed_hash)
    with pytest.raises(optimizer.M4AOptimizationError, match='lossless playback checks'):
        optimizer.optimize_m4a(legacy_m4a)


def test_multiple_audio_streams_are_not_silently_dropped(legacy_m4a, monkeypatch):
    run = optimizer._run
    def two_streams(args):
        if '-show_streams' in args:
            return b'{"streams":[{"codec_type":"audio"},{"codec_type":"audio"}]}'
        return run(args)
    monkeypatch.setattr(optimizer, '_run', two_streams)
    with pytest.raises(optimizer.M4AOptimizationError, match='exactly one audio stream'):
        optimizer.optimize_m4a(legacy_m4a)
