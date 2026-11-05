# Notification lock-screen resume — issue #104

DJ reported on 5 November 2026 that DEV preview #105 resumes music audibly from the lock screen after a notification and preserves position. DJ explicitly authorized production promotion. The production phone retest remains pending after publication.

Open the DEV TEST SITE preview for PR #105 in Safari on the iPhone and play Guest 48. Lock the screen and allow a real notification with sound to arrive. Once it finishes, press lock-screen Play. Sound must return without opening the website, at the preserved mix position. Repeat with another notification. Also check ordinary Pause/Play, a longer pause, and app switching.

Record the notification app, exact iOS version from Settings, whether the timeline stopped or advanced silently, and whether sound resumed. Do not send notification message contents or personal information. Timer movement alone is not a pass.

The candidate cycles the same iOS native element through pause/resume on explicit system Play even if it reports unpaused, then uses the existing session reacquisition. No reload or seek, and no automatic notification-triggered playback. Intentional Pause and mute must be preserved.

Use PR #105 into dev for implementation review. A temporary unmerged main base may be used to generate Netlify's preview; restore dev afterwards. Production remains the earlier approved release c37016b until separately authorized.
