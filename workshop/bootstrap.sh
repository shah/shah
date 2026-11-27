#!/bin/sh
# snshah bootstrap for Linux (any distribution), WSL and macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/shah/shah/main/workshop/bootstrap.sh | sh
#   sh workshop/bootstrap.sh              # from a checkout of github.com/shah/shah
#
# Safe to re-run. It makes sure Bun 1.4+ is present (a pinned release,
# checked by SHA-256, installed under ~/.bun without sudo), pins one
# shah/shah commit, and runs `snshah apply`. A second run reports
# "No changes needed." Set SNSHAH_REF to a branch, tag or commit to try
# something other than main. Arguments are passed to `snshah apply`.
set -eu

BUN_VERSION=1.4.4
OWNER=shah
REPO=shah
DIRECTORY=workshop

say() { printf 'snshah bootstrap: %s\n' "$*" >&2; }
die() { say "$*"; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

home=${HOME:?HOME must be set}
xdg() { # VARIABLE fallback -> an absolute XDG base, ignoring relative values as the spec says
  eval "value=\${$1-}"
  case $value in
    /*) printf '%s\n' "$value" ;;
    *) printf '%s/%s\n' "$home" "$2" ;;
  esac
}
cache_dir="$(xdg XDG_CACHE_HOME .cache)/snshah"
bun_dir=${BUN_INSTALL:-$home/.bun}

fetch() { # URL DEST [HEADER]
  if have curl; then
    if [ $# -gt 2 ]; then curl -fsSL --retry 3 -H "$3" -o "$2" "$1"; else curl -fsSL --retry 3 -o "$2" "$1"; fi
  elif have wget; then
    if [ $# -gt 2 ]; then wget -q --header="$3" -O "$2" "$1"; else wget -q -O "$2" "$1"; fi
  else
    die "needs curl or wget"
  fi
}

sha256() {
  if have sha256sum; then sha256sum "$1" | cut -d' ' -f1
  elif have shasum; then shasum -a 256 "$1" | cut -d' ' -f1
  elif have openssl; then openssl dgst -sha256 -r "$1" | cut -d' ' -f1
  else die "needs sha256sum, shasum or openssl to verify downloads"
  fi
}

version_ok() { # VERSION -> true when 1.4.0 or newer
  major=${1%%.*}
  rest=${1#*.}
  minor=${rest%%.*}
  case "$major$minor" in '' | *[!0-9]*) return 1 ;; esac
  [ "$major" -gt 1 ] || { [ "$major" -eq 1 ] && [ "$minor" -ge 4 ]; }
}

bun_target() {
  os=$(uname -s)
  arch=$(uname -m)
  case $os in
    Linux) os=linux ;;
    Darwin) os=darwin ;;
    *) die "unsupported OS $os (on Windows, use bootstrap.ps1)" ;;
  esac
  case $arch in
    x86_64 | amd64) arch=x64 ;;
    aarch64 | arm64) arch=aarch64 ;;
    *) die "unsupported CPU $arch" ;;
  esac
  target=$os-$arch
  if [ "$os" = linux ] && { [ -f /etc/alpine-release ] || ldd --version 2>&1 | grep -qi musl; }; then
    target=$target-musl
  fi
  if [ "$arch" = x64 ]; then
    if [ "$os" = linux ]; then
      grep -qw avx2 /proc/cpuinfo 2>/dev/null || target=$target-baseline
    else
      [ "$(sysctl -n hw.optional.avx2_0 2>/dev/null || echo 0)" = 1 ] || target=$target-baseline
    fi
  fi
  printf '%s\n' "$target"
}

bun_sha256() { # pinned checksums from the Bun v1.4.4 release SHASUMS256.txt
  case $1 in
    linux-x64) echo bf8ccbfb2b0b80159e0f9a6d15c55317add8077534dbc6130a3edb52fccb395c ;;
    linux-x64-baseline) echo e0446eb55995772eb9894bebae9a6be368d985a8b9271ee124486f9946eedd76 ;;
    linux-x64-musl) echo a5a8ccc5e74dcb883fe974f125a7bdb3b41e5195ed1b870e73f17effd3eb2b2d ;;
    linux-x64-musl-baseline) echo 6e9c37098b293920aed28bfb51ab240e26d23bfdd9bbfecb3ad428ac166549bc ;;
    linux-aarch64) echo baa6bb36f51d6e58561e02bbea825038a9df454f673d6d776e8bbf86f8c7850e ;;
    linux-aarch64-musl) echo 57f01b02ac7113c61c935f28f38c2eab849e3c970dab21f8b640a87b1ef65009 ;;
    darwin-x64) echo 50a3491f73abc2fe81673171a85762d3bc2cc1680ccecadd983de99adf77977e ;;
    darwin-x64-baseline) echo d4a155adfbfd09155eb3ba05c9e3a544f39297d7a68616d3c7759f67ab5c47dc ;;
    darwin-aarch64) echo c240d7f0ccb90c263a849fcdb09b7ee62630d921348ed6aafda86b9d577bc510 ;;
    *) return 1 ;;
  esac
}

ensure_bun() {
  for candidate in "$(command -v bun 2>/dev/null || true)" "$bun_dir/bin/bun"; do
    [ -n "$candidate" ] && [ -x "$candidate" ] || continue
    if version_ok "$("$candidate" --version 2>/dev/null || true)"; then
      BUN=$candidate
      return 0
    fi
  done
  have unzip || die "needs unzip to install Bun (install it with your package manager, then re-run)"
  target=$(bun_target)
  expected=$(bun_sha256 "$target") || die "no pinned checksum for bun-$target"
  mkdir -p "$cache_dir"
  zip=$cache_dir/bun-v$BUN_VERSION-$target.zip
  if [ ! -f "$zip" ] || [ "$(sha256 "$zip")" != "$expected" ]; then
    say "downloading Bun $BUN_VERSION ($target)"
    fetch "https://github.com/oven-sh/bun/releases/download/bun-v$BUN_VERSION/bun-$target.zip" "$zip.part"
    if [ "$(sha256 "$zip.part")" != "$expected" ]; then
      rm -f "$zip.part"
      die "Bun checksum mismatch; nothing was installed"
    fi
    mv -f "$zip.part" "$zip"
  fi
  unpack=$(mktemp -d "${TMPDIR:-/tmp}/snshah-bun-XXXXXX")
  unzip -q -o "$zip" -d "$unpack"
  mkdir -p "$bun_dir/bin"
  cp "$unpack/bun-$target/bun" "$bun_dir/bin/bun.snshah-new"
  chmod 755 "$bun_dir/bin/bun.snshah-new"
  mv -f "$bun_dir/bin/bun.snshah-new" "$bun_dir/bin/bun"
  rm -rf "$unpack"
  BUN=$bun_dir/bin/bun
  say "installed Bun $("$BUN" --version) at $BUN"
}

resolve_revision() { # REF -> 40-hex commit
  case $1 in
    [0-9a-f]*) if [ "${#1}" -eq 40 ] && ! printf '%s' "$1" | grep -q '[^0-9a-f]'; then printf '%s\n' "$1"; return 0; fi ;;
  esac
  sha=
  if have git; then
    sha=$(git ls-remote "https://github.com/$OWNER/$REPO.git" "refs/heads/$1" "refs/tags/$1" 2>/dev/null | head -n 1 | cut -f1)
  fi
  if [ -z "$sha" ]; then
    answer=$(mktemp "${TMPDIR:-/tmp}/snshah-ref-XXXXXX")
    fetch "https://api.github.com/repos/$OWNER/$REPO/commits/$1" "$answer" "Accept: application/vnd.github.sha" || true
    sha=$(cat "$answer" 2>/dev/null || true)
    rm -f "$answer"
  fi
  case $sha in
    '' | *[!0-9a-f]*) die "could not resolve $OWNER/$REPO@$1" ;;
  esac
  [ "${#sha}" -eq 40 ] || die "could not resolve $OWNER/$REPO@$1"
  printf '%s\n' "$sha"
}

main() {
  ensure_bun
  # From a checkout: run the snshah.ts next to this file.
  if [ -f "$0" ]; then
    here=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
    if [ -f "$here/snshah.ts" ]; then
      exec "$BUN" --no-env-file "$here/snshah.ts" apply --yes "$@"
    fi
  fi
  # Piped from the network: fetch exactly one commit, cached by its hash.
  have tar || die "needs tar"
  ref=${SNSHAH_REF:-main}
  revision=$(resolve_revision "$ref")
  mkdir -p "$cache_dir"
  archive=$cache_dir/$REPO-$revision.tar.gz
  if [ ! -s "$archive" ]; then
    say "downloading $OWNER/$REPO@$(printf '%.12s' "$revision")"
    fetch "https://codeload.github.com/$OWNER/$REPO/tar.gz/$revision" "$archive.part"
    mv -f "$archive.part" "$archive"
  fi
  scratch=$(mktemp -d "${TMPDIR:-/tmp}/snshah-src-XXXXXX")
  trap 'rm -rf -- "$scratch"' EXIT INT TERM
  if ! tar -xzf "$archive" -C "$scratch" "$REPO-$revision/$DIRECTORY"; then
    rm -f "$archive"
    die "could not unpack the download; removed it from the cache, re-run to try again"
  fi
  "$BUN" --no-env-file "$scratch/$REPO-$revision/$DIRECTORY/snshah.ts" apply --yes --revision "$revision" "$@"
}

main "$@"
