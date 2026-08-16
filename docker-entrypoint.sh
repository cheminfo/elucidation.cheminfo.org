#!/bin/sh
# Lay the built site into SERVER_ROOT and, when the deployment measures its
# audience, put the analytics snippet at the end of the <head> of every page.
# SERVER_ROOT is a tmpfs, so this is the one writable place in the container
# and the image itself stays read-only.
set -e

root="${SERVER_ROOT:-/public}"
mkdir -p "$root"
cp -R /app/dist/. "$root/"

if [ -n "$TRACKING_SCRIPT" ]; then
  # Every page, not only the root one: the build writes one file per address so
  # each is titled and described as itself, and a visitor arriving on any of
  # them must be counted the same way.
  find "$root" -name index.html -type f | while IFS= read -r page; do
    # Written with index()/substr() rather than sub(): the snippet is operator
    # input taken verbatim, and a `&` in it would otherwise be read as the match.
    awk '
      BEGIN { snippet = ENVIRON["TRACKING_SCRIPT"] }
      !injected {
        at = index($0, "</head>")
        if (at > 0) {
          printf "%s%s\n%s\n", substr($0, 1, at - 1), snippet, substr($0, at)
          injected = 1
          next
        }
      }
      { print }
    ' "$page" >"$page.new"
    mv "$page.new" "$page"
  done
fi

exec "$@"
