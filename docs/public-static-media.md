# Public static media

Images, videos, audio files, and the contents of `public/assets/` and
`public/site-media/` are provisioned outside the Git code release. Their
relative paths stay unchanged, so existing `/assets/...`, `/site-media/...`,
and `/themes/...` URLs do not need database changes.

Set `PUBLIC_STATIC_ASSET_SOURCE_ROOT` to a local `public/` mirror and preview
the transfer with:

```sh
npm run sync:public-media
```

The command is a dry-run by default. Apply the transfer explicitly with:

```sh
npm run sync:public-media:apply
```

The command syncs in bounded batches, never deletes remote files, and targets
the shared static roots configured for `www.mydreamshoots.com`,
`aidreamshoots.eu`, and `aidreamcapes.eu`. A code release does not require
`public/assets/` to be present in the Git checkout; a media sync must be run
separately when new media is published.
