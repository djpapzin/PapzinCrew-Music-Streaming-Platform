# Task #194 — Mobile Playback Validation Checklist

## Purpose
Use this when headless verification is blocked by missing local playback data or by a backend that is not running on the expected local route.

## Current offline blocker snapshot
- Frontend local dev server: `http://127.0.0.1:5173`
- Expected local API base in dev: `http://localhost:8000`
- Headless blocker seen during this lane: `GET http://localhost:8000/tracks/` returned `404`
- UI result in this state: Quick Play buttons render disabled and the home page shows **"No uploads yet"**

## Real-device validation steps (Android-first)
1. Start the Papzin & Crew backend that serves `GET /tracks/` successfully on the intended local/dev URL.
2. Confirm at least one uploaded track exists and has a valid `file_path` / stream URL.
3. Open the frontend on the Android device using the exact origin you plan to validate.
4. On the home screen, verify the **Quick Play** section shows enabled **Play** / **Shuffle** buttons.
5. Tap **Play**.
6. Confirm audio starts within 3-5 seconds.
7. Confirm the active player UI updates with the selected track title/artwork.
8. Let playback run for at least 10 seconds and confirm progress time advances.
9. Pause and resume once.
10. Lock the phone briefly, unlock it, and confirm playback state is still sane.
11. Test one additional track from the song list, not only Quick Play.
12. If using a LAN frontend origin like `http://192.168.x.x:5173`, verify that B2 CORS includes that exact origin.
13. If direct `/tracks/{id}/stream` playback fails on mobile, retry using the proxy path and capture whether `/stream/proxy` succeeds.

## Evidence to capture for reviewer
- Screenshot of enabled Quick Play section on mobile
- Screenshot of active player UI while audio is playing
- Browser console/network error text if playback fails
- Exact frontend origin used
- Exact backend/API origin used
- Whether direct stream or proxy stream succeeded

## Pass criteria
- At least one uploaded track plays on Android from the intended frontend origin
- Progress advances
- Player UI reflects the active track
- No blocking CORS/range errors remain for the chosen playback path

## Fail signatures to note
- `GET /tracks/` fails or returns empty list
- Quick Play remains disabled
- Audio element gets a src but playback stalls forever
- CORS/range errors on direct stream URL
- Only proxy works on mobile
