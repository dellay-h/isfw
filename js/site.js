// Which version of ISFW this copy is. The GitHub Pages workflow
// (.github/workflows/pages.yml) replaces this file in the playable copy.
//   play:  the playable version (branch main), no dev pages
//   dev:   the development version (branch dev, at /dev/): dev pages are
//          read-only, or editable after a GitHub sign-in (token), with
//          commits to the dev branch and releases to main
export const SITE = { mode: 'dev', repo: 'dellay-h/isfw', branch: 'dev', release: 'main' };

// Browser storage names. Both online versions share one address
// (dellay-h.github.io), so the dev version keeps its game save, drafts and
// settings under separate names and never touches the playable save.
export const key = (name) => (SITE.mode === 'dev' ? name.replace(/^isfw\./, 'isfw.devsite.') : name);
