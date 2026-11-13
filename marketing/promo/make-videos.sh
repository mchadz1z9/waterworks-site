#!/bin/bash
# Builds the single rotating promo video (WaterWorks-Promo.mp4) from frames/*.png (run after rendering slides.html).
set -e
cd "$(dirname "$0")"
HOLD=3.5; FADE=0.7
for fmt in square; do
  files=(frames/$fmt-*.png); n=${#files[@]}
  inputs=(); for f in "${files[@]}"; do inputs+=(-loop 1 -framerate 30 -t 4.2 -i "$f"); done
  filter=""; prev="[0:v]"
  for ((i=1;i<n;i++)); do
    off=$(echo "$i*$HOLD" | bc)
    out="[v$i]"; [ $i -eq $((n-1)) ] && out="[vout]"
    filter+="${prev}[$i:v]xfade=transition=fade:duration=$FADE:offset=$off${out};"; prev="[v$i]"
  done
  ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "${filter%;}" -map "[vout]" \
    -r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p -crf 21 -movflags +faststart "WaterWorks-Promo.mp4"
done
