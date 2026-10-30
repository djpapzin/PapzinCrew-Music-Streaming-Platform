"""Free, transport-independent support replies from approved help and public mixes.

No message sending, external model calls, URL fetching, or message persistence.
A WhatsApp transport must be separately approved and verified before connecting.
"""
import re
import unicodedata

SITE = 'https://crew.djpapzin.com'
STOP = set('a an and any are available by can could dj do find for from get give got have hello hey hi how howzit i is it link listen listening me mix mixes music of on play please pls send share song songs stream thanks the there this to want where with you your'.split())


def normalized(value):
    text = ''.join(c for c in unicodedata.normalize('NFKD', value.casefold()) if not unicodedata.combining(c))
    return re.sub(r'\b(tpw|guest|friday)\s*(\d+)\b', r'\1 \2', text)


def reply(intent, answer, links=(), needs_owner=False):
    return {'intent': intent, 'answer': answer,
            'links': [{'label': label, 'url': url} for label, url in links],
            'needs_owner': needs_owner, 'delivery': 'draft_only'}


def public_mixes(mixes):
    # Accept only known public catalog records. Never reveal source storage URLs.
    return [m for m in mixes if (m.get('availability') or 'public') == 'public'
            and isinstance(m.get('id'), int) and not isinstance(m['id'], bool)
            and m['id'] > 0 and isinstance(m.get('title'), str) and m['title'].strip()]


def answer_question(question, mixes=(), downloads_enabled=False, uploads_enabled=True):
    if not isinstance(question, str) or not 1 <= len(question.strip()) <= 1500:
        raise ValueError('Add a question with 1–1500 characters.')
    text = normalized(question)
    records = public_mixes(mixes)
    # Conversational filler should not prevent exact public mix matching.
    text = re.sub(r'\b(can you|could you|send me|please send|give me|i want|i would like|the mix|a link to|for me)\b', ' ', text)
    if re.fullmatch(r'\s*(help|menu|hello|hi)\s*', text):
        return reply('help', 'I’m Crew Helper, Papzin & Crew’s beta assistant. Try a mix name, music won’t play, downloads, uploading a mix, or feedback. Just tell me what you need in normal words. DJ Papzin handles release and website decisions.', [('Browse mixes', SITE+'/search')])
    if re.search(r'who are you|your name|are you.*bot', text):
        return reply('identity', 'I’m Crew Helper, Papzin & Crew’s automated assistant. I help with public DJ mixes and using the website. DJ Papzin owns the site and handles approvals. I’ll say when I cannot confirm something.')
    if re.search(r'when.*(next|new).*mix|when.*release|next.*mix.*(coming|out|release)', text):
        return reply('release_check', 'I don’t have a confirmed date for the next mix. DJ Papzin will confirm new releases; I won’t guess a date. You can enjoy the mixes already available here:', [('Browse mixes', SITE+'/search')], True)
    if re.search(r'full player|minimi[sz]|collapse|swipe|keep.*brows|next mix', text):
        return reply('mobile_player', 'On mobile, tapping Play on a mix opens the full player. Collapse it or swipe down to keep browsing while music plays. Resuming or moving to the next mix should not reopen it. If this behaves differently, tap Feedback → Something broke and include your phone/browser.', [('Browse mixes', SITE+'/search')])
    if re.search(r'track.?list|identify.*(song|track)|what.*(song|track).*mix', text):
        return reply('tracklists', 'Open the mix page to check its DJ-supplied tracklist. Automatic matches, where available, are private suggestions until reviewed; they do not overwrite existing tracklists. If a tracklist is missing, ask DJ Papzin or send Feedback with the mix name.', [('Browse mixes', SITE+'/search')])
    if re.search(r'analytics|tracking|privacy|listening time|visitor stats', text):
        return reply('privacy', 'The site uses anonymous visitor and playback statistics to spot problems and understand listening. Stats and feedback are visible only to DJ Papzin in admin. You do not need a listener account. Do not include sensitive information in feedback.')
    if re.search(r'\b(password|owner key|api key|token|private messages|admin key)\b', text):
        return reply('private_access', 'I can help with public mixes and using the website. Never share passwords or owner keys in the group. Ask DJ Papzin privately about owner access.', needs_owner=True)
    # Route upload questions before generic errors; "uploading" contains "loading".
    if re.search(r'\b(upload(?:s|ing|ed)?|submit(?:ting|ted)?|my mix|my mixes)\b', text):
        if not uploads_enabled:
            return reply('uploads', 'Website uploads are temporarily paused while DJ Papzin prepares the DJ upload flow. You can still listen to and download ready public mixes. I cannot upload audio files or publish releases for you. To contact DJ Papzin, say “I have feedback”.', [('Browse mixes', SITE+'/search')])
        return reply('uploads', 'Use Upload Music to submit a DJ mix. Uploads stay unlisted until checked; solo songs and test uploads do not go into the public catalog. DJ Papzin handles release approval.', [('Upload a DJ mix', SITE+'/upload')])
    if re.search(r'\b(download|downloads|offline|save.*(music|mix|song))\b', text):
        if not downloads_enabled:
            return reply('downloads', 'Downloads are coming soon. For now, open a mix and tap Play to stream it. No account is needed.', [('Browse mixes', SITE+'/search')])
        return reply('downloads', 'Open the mix page. If its DJ allows downloads and the download is ready, use Download mix. Otherwise you can stream it.', [('Browse mixes', SITE+'/search')])
    if re.search(r"no sound|can.?t hear|cannot hear|silent|muted|volume", text):
        return reply('no_sound', 'Try these steps:\n1. Tap Play, then check the player and phone volume.\n2. Check whether sound is going to Bluetooth headphones or another speaker.\n3. Try a different mix. If it still has no sound, tap Feedback, choose Something broke, and tell DJ Papzin which mix and what phone/browser you used.', [('Browse mixes', SITE+'/search')])
    if re.search(r"won.?t play|can.?t play|cannot play|not playing|not working|doesn.?t work|\b(stuck|buffer(?:ing)?|loading|slow|failed|error|broken)\b", text):
        return reply('playback', 'Try these steps:\n1. Pause the mix, check your connection, then tap Play once.\n2. Try another mix. If possible, try Wi-Fi instead of mobile data, or the other way around.\n3. Refresh the page once. If it still fails, tap Feedback → Something broke and include the mix name and what happened. Your report goes privately to DJ Papzin.', [('Browse mixes', SITE+'/search')])
    if re.search(r'\b(feedback|suggestion|suggest|improve|idea|remove|complaint|report)\b', text):
        return reply('feedback', 'Tap Feedback at the top of the website. Choose Something broke, An idea, Improve something, Remove something, or Something else, then send one short message. Your name is optional, no account is needed, and only DJ Papzin can read it.', [('Open the website', SITE+'/')])
    if re.search(r'what is.*papzin|about.*(site|website)|how.*(site|website).*work', text):
        return reply('about', 'Papzin & Crew is a beta home for DJ mixes. Browse a mix and tap Play; listening is free and needs no account. Uploads are checked before they go public, and Feedback lets you send problems or ideas privately to DJ Papzin.', [('Open the website', SITE+'/')])
    if re.search(r'\b(sign.?up|sign.?in|log.?in|account|register|free|cost|pay)\b', text):
        return reply('access', 'The beta is free to listen to. You do not need an account: open a mix and tap Play. Your own mobile-data charges can still apply.', [('Browse mixes', SITE+'/search')])
    if re.search(r'\b(spam|rules|moderate|ban|kick|members|group admin)\b', text):
        return reply('group_admin', 'Keep group posts relevant to DJ mixes and site help. Flag suspected spam to a group admin for review. I cannot remove members, change group settings or publish group announcements.', needs_owner=True)
    if re.search(r'\b(install|app|home screen)\b', text):
        return reply('install', 'Open the install guide for steps to add Papzin & Crew to your phone’s home screen. You can also keep listening in your browser.', [('Install guide', SITE+'/install')])
    if re.search(r'\b(latest|newest|recent|new mixes|new mix)\b', text) and not re.search(r'\d', text):
        recent = sorted(records, key=lambda m: (str(m.get('created_at') or ''), m['id']), reverse=True)[:3]
        if not recent:
            return reply('catalog_unavailable', 'I cannot confirm the public mix list right now. Open Browse mixes, or ask DJ Papzin to check it.', [('Browse mixes', SITE+'/search')], True)
        return reply('recently_added', 'These are recently added to the website; they may be older mixes, not new releases:\n'+'\n'.join(m['title'] for m in recent), [(m['title'], SITE+'/track/'+str(m['id'])) for m in recent])
    tokens = set(re.findall(r'[a-z0-9]+', text)) - STOP
    if tokens:
        scored = []
        for m in records:
            title_tokens = set(re.findall(r'[a-z0-9]+', normalized(m['title'])))
            artist_tokens = set(re.findall(r'[a-z0-9]+', normalized(str(m.get('artist_name') or ''))))
            if tokens <= title_tokens | artist_tokens:
                scored.append((len(tokens & title_tokens), m['id'], m))
        found = [item[2] for item in sorted(scored, key=lambda x: (-x[0], x[1]))[:3]]
        if found:
            return reply('mix_links', 'Here are the matching public mixes. Open a link and tap Play:\n'+'\n'.join(m['title'] for m in found), [(m['title'], SITE+'/track/'+str(m['id'])) for m in found])
    if re.search(r'\b(announce|announcement|release|tomorrow|guest)\b', text):
        return reply('release_check', 'I cannot confirm an unpublished release or its time. Ask DJ Papzin to confirm the mix and share its public mix-page link when it is ready.', needs_owner=True)
    return reply('clarify', 'What would you like help with: finding a mix, playing music, uploading a DJ mix, or sending feedback? For a mix link, send its name, number or DJ. If I cannot answer, DJ Papzin can help.', [('Browse mixes', SITE+'/search')], True)
