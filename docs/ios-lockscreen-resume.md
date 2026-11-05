# iPhone lock-screen resume acceptance — issue #100

DJ reported audible lock-screen Pause/Play working on DEV preview #101 on 5 November 2026. Production verification remains pending.

Reported on iPhone 14, Safari. DJ supplied iOS version `26..6.1`; exact normalized version is unconfirmed. Production resumes silently from lock-screen Play, while website Pause/Play restores sound.

On the DEV TEST SITE preview, play Guest 48, lock the phone, pause using lock-screen controls, wait at least ten seconds, then press lock-screen Play. Sound must return without opening the website and position must be preserved. Repeat three times, including a pause lasting one minute. Confirm ordinary app-switch playback still works. Timer movement alone is not acceptance.

The candidate reselects the optional audio-session category on an explicit paused iOS native resume and synchronizes MediaSession playback state. It does not replace or reload the audio element. Retain intentional mute. Device testing determines whether this mitigates the reported failure.

DJ authorized production promotion on 5 November 2026 after the DEV pass. A separate notification interruption then stopped music and lock-screen resume failed. DJ explicitly requested releasing the tested Pause/Play fix first, then debugging notification interruption separately. Do not count notification recovery as passed.
