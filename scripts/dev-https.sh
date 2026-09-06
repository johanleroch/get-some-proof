#!/usr/bin/env bash

set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_dir"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is required. Run: bash scripts/setup-ios-https.sh" >&2
  exit 1
fi

dev_https_host=${DEV_HTTPS_HOST:-$(ipconfig getifaddr en0 2>/dev/null || true)}
if [[ -z "$dev_https_host" ]]; then
  echo "Unable to detect the Wi-Fi address. Set DEV_HTTPS_HOST explicitly." >&2
  exit 1
fi

certificate_dir="$project_dir/certificates"
certificate_path="$certificate_dir/local-development.pem"
key_path="$certificate_dir/local-development-key.pem"
root_ca_path="$(mkcert -CAROOT)/rootCA.pem"
iphone_root_ca_path="$certificate_dir/local-development-root-ca.cer"

mkdir -p "$certificate_dir"
mkcert \
  -key-file "$key_path" \
  -cert-file "$certificate_path" \
  localhost 127.0.0.1 ::1 "$dev_https_host" >/dev/null
openssl x509 -in "$root_ca_path" -outform der -out "$iphone_root_ca_path"

if [[ "${1:-}" == "--setup-only" ]]; then
  echo "HTTPS certificate ready for $dev_https_host"
  echo "iPhone root certificate: $iphone_root_ca_path"
  exit 0
fi

export DEV_ALLOWED_ORIGIN="$dev_https_host"
echo "Collection Form: https://$dev_https_host:3000/c/atrakt"
exec pnpm exec next dev \
  --experimental-https \
  --experimental-https-key "$key_path" \
  --experimental-https-cert "$certificate_path" \
  --experimental-https-ca "$root_ca_path" \
  --hostname 0.0.0.0 \
  "$@"
