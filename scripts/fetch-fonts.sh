#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/fonts
base="https://raw.githubusercontent.com/google/fonts/main/ofl"
get() { curl -fsSL -o "assets/fonts/$2" "$base/$1"; }
get "fraunces/Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf" Fraunces.ttf
get "fraunces/OFL.txt" OFL-Fraunces.txt
get "bevietnampro/BeVietnamPro-Regular.ttf" BeVietnamPro-Regular.ttf
get "bevietnampro/BeVietnamPro-SemiBold.ttf" BeVietnamPro-SemiBold.ttf
get "bevietnampro/OFL.txt" OFL-BeVietnamPro.txt
get "patrickhand/PatrickHand-Regular.ttf" PatrickHand-Regular.ttf
get "patrickhand/OFL.txt" OFL-PatrickHand.txt
ls -l assets/fonts
