#!/bin/bash
# Builds WaterWorks-Promo.mp4 (about 129 s) from frames/square-*.png.
# Each slide gets a slow zoom, then slides crossfade into each other.
set -e
cd "$(dirname "$0")"
HOLD=8.0; FADE=0.8; FPS=30
CLIP=$(echo "$HOLD+$FADE" | bc); NF=$(echo "$CLIP*$FPS/1" | bc)
tmp=$(mktemp -d)
files=(frames/square-*.png); n=${#files[@]}
for ((i=0;i<n;i++)); do
  ffmpeg -y -loglevel error -loop 1 -i "${files[$i]}" -frames:v $NF -filter_complex \
    "scale=2160:2160:flags=lanczos,zoompan=z='1+0.05*on/$NF':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$NF:s=1080x1080:fps=$FPS" \
    -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p "$tmp/c$i.mp4"
done
inputs=(); for ((i=0;i<n;i++)); do inputs+=(-i "$tmp/c$i.mp4"); done
filter=""; prev="[0:v]"
for ((i=1;i<n;i++)); do
  off=$(echo "$i*$HOLD" | bc); out="[v$i]"; [ $i -eq $((n-1)) ] && out="[vout]"
  filter+="${prev}[$i:v]xfade=transition=fade:duration=$FADE:offset=$off${out};"; prev="[v$i]"
done
ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "${filter%;}" -map "[vout]" \
  -r $FPS -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -movflags +faststart WaterWorks-Promo.mp4
rm -r "$tmp"
