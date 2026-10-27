#!/bin/zsh
# Mirror each .astro frontmatter into <out>/<path>.ts keeping line numbers (fence lines blanked, template dropped).
out=$1; shift
for f in "$@"; do
  mkdir -p "$out/$(dirname $f)"
  awk 'NR==1 && $0=="---" {print ""; infm=1; next} infm && $0=="---" {print ""; exit} infm {print}' "$f" > "$out/$f.ts"
done
