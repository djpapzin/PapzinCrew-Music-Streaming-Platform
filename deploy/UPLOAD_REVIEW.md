# Upload review policy

All upload routes save new records as `unlisted`, regardless of requested visibility
or duplicate override. Uploads do not automatically enter discovery. Existing public
mixes are unchanged. No extra Backblaze copies or paid settings are required.

Public release is a separate catalog-owner action, not part of the upload form.
Before changing a specific record from unlisted to public:

1. Confirm the uploaded ID, original file and artist; check for duplicates.
2. Verify that the content is a DJ mix using archive/source context, series,
   metadata and duration. Duration alone is not proof. Keep uncertain items unlisted.
3. Verify muted playback at the beginning, middle and ending; check for errors.
4. Exclude solo songs and test/probe/synthetic uploads. Tests remain unlisted,
   clearly named as tests, and must never be promoted into the public mix catalog.
5. Save the previous catalog state, then update only the reviewed ID after checking
   its title and file hash. Verify public search and leave other records unchanged.

Catalog owners currently perform this guarded database operation through existing VPS
administration access. There is no public approval endpoint. Do not expose credentials
or add a client-side shortcut for publication. Backblaze storage/download caps stay $0.
