#!/bin/sh
# Lay the built site into SERVER_ROOT, tell it where it is mounted and, when
# the deployment measures its
# audience, put the analytics snippet at the end of the <head> of every page.
# SERVER_ROOT is a tmpfs, so this is the one writable place in the container
# and the image itself stays read-only.
set -e

root="${SERVER_ROOT:-/public}"
mkdir -p "$root"
cp -R /app/dist/. "$root/"

# Where this deployment answers: `/` on a host of its own, `/<tool>/` as one
# tool among several on a shared one. The build carries no mount, so this is
# the only thing that differs between the two — one image, one tag, two
# addresses, no rebuild.
base_path="${BASE_PATH:-/}"
case "$base_path" in
  /*) ;;
  *) base_path="/$base_path" ;;
esac
case "$base_path" in
  */) ;;
  *) base_path="$base_path/" ;;
esac

if [ "$base_path" != "/" ]; then
  # Every page, because each address the build wrote is a file of its own and
  # any of them can be the one a visitor opens first.
  find "$root" -name index.html -type f | while IFS= read -r page; do
    awk -v href="$base_path" '
      !stamped && index($0, "<base href=\"/\" />") > 0 {
        at = index($0, "<base href=\"/\" />")
        printf "%s<base href=\"%s\" />%s\n", substr($0, 1, at - 1), href, substr($0, at + length("<base href=\"/\" />"))
        stamped = 1
        next
      }
      { print }
    ' "$page" >"$page.new"
    mv "$page.new" "$page"
  done
fi

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
