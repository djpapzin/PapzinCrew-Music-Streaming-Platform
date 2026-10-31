import json
import logging
import sys
from app.logging_utils import JSONFormatter


def test_exception_location_is_preserved_without_message_or_locals():
    secret = "private-token-that-must-not-be-logged"
    try:
        raise RuntimeError(secret)
    except RuntimeError:
        record = logging.LogRecord("app", logging.ERROR, __file__, 14,
                                   "Unhandled exception", (), sys.exc_info())
        output = JSONFormatter().format(record)
    data = json.loads(output)
    assert data["exception_type"] == "RuntimeError"
    assert data["exception_frames"][-1]["function"] == "test_exception_location_is_preserved_without_message_or_locals"
    assert data["exception_frames"][-1]["file"] == "test_logging_utils.py"
    assert data["exception_frames"][-1]["line"] > 0
    assert secret not in output
    assert "exc_info" not in data


def test_normal_log_does_not_claim_an_exception():
    record = logging.LogRecord("app", logging.INFO, __file__, 1, "ready", (), None)
    data = json.loads(JSONFormatter().format(record))
    assert "exception_type" not in data
    assert "exception_frames" not in data
