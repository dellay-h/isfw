// Which version of ISFW this copy is. This file is for local use (start.bat):
// the GitHub Pages workflow (.github/workflows/pages.yml) replaces it in each
// online copy.
//   local: full dev pages, saving to the files through server.py
//   play:  the playable version (branch main), no dev pages
//   dev:   the development version (branch dev, at /dev/): dev pages are
//          read-only, or editable after a GitHub sign-in (token), with
//          commits to the dev branch and releases to main
export const SITE = { mode: 'local', repo: 'dellay-h/isfw', branch: 'dev', release: 'main' };

// Browser storage names. Both online versions share one address
// (dellay-h.github.io), so the dev version keeps its game save, drafts and
// settings under separate names and never touches the playable save.
export const key = (name) => (SITE.mode === 'dev' ? name.replace(/^isfw\./, 'isfw.devsite.') : name);
