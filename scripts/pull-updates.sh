#!/usr/bin/env bash
# scripts/pull-updates.sh — b3nd-web-rig variant.
#
# Polls JSR for the latest versions of b3nd-{core,move,save}, bumps
# package.json to the exact published version when newer, runs
# install + typecheck + build, and optionally deploys to Pages.
#
# Why exact-version pins: see cf.demo.b3nd's equivalent script. The
# JSR npm-shim's encoded URL form stays cached on Cloudflare's edge
# for up to 24 h, so caret ranges ETARGET-fail after a recent publish.
#
# Usage:
#   bash scripts/pull-updates.sh             # bump + typecheck + build only
#   bash scripts/pull-updates.sh --deploy    # also wrangler pages deploy
#   bash scripts/pull-updates.sh --commit    # git commit (skip if clean)
#   bash scripts/pull-updates.sh --deploy --commit --push

set -euo pipefail
cd "$(dirname "$0")/.."

DEPLOY=0
COMMIT=0
PUSH=0
for arg in "$@"; do
  case "$arg" in
    --deploy) DEPLOY=1 ;;
    --commit) COMMIT=1 ;;
    --push)   PUSH=1 ;;
    --help|-h) sed -n '/^# Usage:/,/^$/p' "$0" | sed 's/^# \{0,1\}//' ; exit 0 ;;
    *) echo "unknown arg: $arg" >&2 ; exit 2 ;;
  esac
done

declare -A LIBS=(
  ["@jsr/bandeira-tech__b3nd-core"]="@bandeira-tech/b3nd-core"
  ["@jsr/bandeira-tech__b3nd-move"]="@bandeira-tech/b3nd-move"
  ["@jsr/bandeira-tech__b3nd-save"]="@bandeira-tech/b3nd-save"
)

latest_jsr() {
  curl -fsS "https://jsr.io/${1}/meta.json" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["latest"])'
}

# Compare two semver strings; print 1 if $1 > $2, 0 otherwise. Handles
# ranges like ^0.8.0 / ~0.8.0 and tarball URLs (extracts the last
# semver-like substring from the URL — workaround for CF-cached
# manifests that force a tarball-URL pin).
semver_gt() {
  python3 - "$1" "$2" <<'PY'
import sys, re
def parse(v):
  m = re.search(r'(\d+)\.(\d+)\.(\d+)', v)
  return tuple(int(x) for x in m.groups()) if m else (0, 0, 0)
print(1 if parse(sys.argv[1]) > parse(sys.argv[2]) else 0)
PY
}

current_pkg() {
  python3 -c "
import json
with open('package.json') as f:
  d = json.load(f)
print(d['dependencies'].get('$1',''))
"
}

bump_pkg() {
  python3 -c "
import json
with open('package.json') as f: d = json.load(f)
d['dependencies']['$1'] = '$2'
if 'overrides' in d and '$1' in d['overrides']:
  d['overrides']['$1'] = '$2'
with open('package.json','w') as f:
  json.dump(d, f, indent=2)
  f.write('\n')
"
}

needs_install=0
echo "→ checking JSR for the latest versions"
for key in "${!LIBS[@]}"; do
  slug="${LIBS[$key]}"
  cur="$(current_pkg "$key")"
  latest="$(latest_jsr "$slug")"
  cmp="$(semver_gt "$latest" "$cur")"
  if [[ "$cmp" == "1" ]]; then
    printf "  %-40s %s  →  %s\n" "$key" "$cur" "$latest"
    bump_pkg "$key" "$latest"
    needs_install=1
  elif [[ "$cur" == "$latest" ]]; then
    printf "  %-40s %s  ✓\n" "$key" "$cur"
  else
    printf "  %-40s %s  ✓ (jsr reports %s)\n" "$key" "$cur" "$latest"
  fi
done

if [[ "$needs_install" == "0" ]]; then
  echo "→ already up to date — nothing to do"
  exit 0
fi

echo "→ npm install"
npm install --silent

echo "→ npm run build (tsc -b && vite build)"
npm run --silent build

if [[ "$DEPLOY" == "1" ]]; then
  echo "→ wrangler pages deploy"
  env -u CLOUDFLARE_API_TOKEN sh -c '\
    npx wrangler pages deploy dist \
      --project-name b3nd-web-rig \
      --branch main \
      --commit-dirty=true'
fi

if [[ "$COMMIT" == "1" ]]; then
  if git diff --quiet package.json package-lock.json 2>/dev/null; then
    echo "→ nothing to commit"
  else
    msg="chore: pull updates from JSR"
    for key in "${!LIBS[@]}"; do
      v=$(current_pkg "$key")
      short="${key#@jsr/bandeira-tech__}"
      msg+=$'\n'"  - $short → $v"
    done
    git add package.json package-lock.json
    git commit -m "$msg" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>" >/dev/null
    echo "→ committed: $(git log --oneline -1)"
    if [[ "$PUSH" == "1" ]]; then
      git push origin HEAD
      echo "→ pushed"
    fi
  fi
fi

echo "✓ done"
