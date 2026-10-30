# Listener and test activity

New activity is categorized as listener or test. In private admin, choose Listeners, Tests, or Earlier activity. Earlier anonymous aggregates include tests and cannot be reliably reconstructed; they are retained without subtraction or guessed attribution. Listener totals mean activity not marked as tests, not verified unique humans.

Before QA, unlock admin on the testing browser and turn on Test mode on this device. The local preference persists until switched off. Enable separately on every test browser/device; pause playback before changing mode. Reload establishes fresh download links. Do Not Track, GPC and analytics opt-out still apply. Muting alone does not identify tests.

Playback daily aggregates remain anonymous and expire after 30 days, separately in listener/ and test/ directories under ANONYMOUS_STATS_DIR. The old root daily files are the Earlier activity bucket. Downloads retain their total lifetime DB counter; a locked private downloads.json records classified lifetime starts. Earlier download counts equal the DB total less classified starts. Back up the entire stats directory with the database to preserve classification. Never reset or remove this ledger independently.

Test downloads reserve exactly the same bytes against existing egress limits. HEAD, redirects and nonzero byte-range resumes do not add starts. No provider plans, resource sizes or caps change.

Release: feature PR into dev, then approved promotion into main and matched VPS backend deployment. Deploy backend before frontend; otherwise the older API cannot separate categories. Update the launch monitor helper to read all three categories with explicit labels; do not replace historical totals with listener-only values. Read-only monitoring and HEAD checks should not fabricate analytics. Verify owner-only access, category switching, QA playback muted and paused, and download HEAD/range behavior without a full test download.
