#!/bin/sh
# jif installer:
#   curl -fsSL https://raw.githubusercontent.com/jrpat/jif/main/install.sh | sh
#
# Environment overrides:
#   JIF_VERSION      version to install (e.g. 0.2.0 or v0.2.0); default: latest release
#   JIF_INSTALL_DIR  install directory; default: $XDG_BIN_HOME or ~/.local/bin
#   JIF_BASE_URL     asset base URL, for testing; default: GitHub release downloads
set -eu

REPO="jrpat/jif"
BASE_URL="${JIF_BASE_URL:-https://github.com/$REPO/releases/download}"

fail() {
  echo "install.sh: $1" >&2
  exit 1
}

command -v curl > /dev/null 2>&1 || fail "curl is required"
command -v tar > /dev/null 2>&1 || fail "tar is required"

os=$(uname -s)
case "$os" in
  Darwin) os="darwin" ;;
  Linux) os="linux" ;;
  MINGW* | MSYS* | CYGWIN*)
    fail "Windows is not supported"
    ;;
  *) fail "unsupported operating system: $os" ;;
esac

arch=$(uname -m)
case "$arch" in
  arm64 | aarch64) arch="arm64" ;;
  x86_64 | amd64) arch="x64" ;;
  *) fail "unsupported architecture: $arch" ;;
esac

if [ "$os" = "linux" ] && ldd --version 2>&1 | grep -qi musl; then
  fail "musl-based Linux is not supported yet; build from source (see https://github.com/$REPO#developing)"
fi

tag="${JIF_VERSION:-}"
if [ -z "$tag" ]; then
  latest_url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest") \
    || fail "could not resolve the latest release"
  tag="${latest_url##*/}"
  { [ -n "$tag" ] && [ "$tag" != "latest" ]; } || fail "could not determine the latest version (no releases yet?)"
fi
case "$tag" in
  v*) ;;
  *) tag="v$tag" ;;
esac

asset="jif-$tag-$os-$arch.tar.gz"
install_dir="${JIF_INSTALL_DIR:-${XDG_BIN_HOME:-$HOME/.local/bin}}"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

echo "Downloading $asset ..."
curl -fsSL -o "$tmpdir/$asset" "$BASE_URL/$tag/$asset" || fail "download failed: $BASE_URL/$tag/$asset"
curl -fsSL -o "$tmpdir/SHA256SUMS" "$BASE_URL/$tag/SHA256SUMS" || fail "download failed: $BASE_URL/$tag/SHA256SUMS"

expected=$(awk -v file="$asset" '$2 == file { print $1 }' "$tmpdir/SHA256SUMS")
[ -n "$expected" ] || fail "$asset is not listed in SHA256SUMS"
if command -v sha256sum > /dev/null 2>&1; then
  actual=$(sha256sum "$tmpdir/$asset" | awk '{ print $1 }')
else
  actual=$(shasum -a 256 "$tmpdir/$asset" | awk '{ print $1 }')
fi
[ "$actual" = "$expected" ] || fail "checksum mismatch for $asset (expected $expected, got $actual)"

tar -xzf "$tmpdir/$asset" -C "$tmpdir" jif
mkdir -p "$install_dir"
install -m 0755 "$tmpdir/jif" "$install_dir/jif"

case ":$PATH:" in
  *":$install_dir:"*) ;;
  *) echo "warning: $install_dir is not on your PATH" >&2 ;;
esac

echo "Installed $("$install_dir/jif" --version) to $install_dir/jif"
