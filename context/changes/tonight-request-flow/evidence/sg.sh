#!/bin/zsh
# usage: sg.sh <lang> <pattern> [paths...]; prints count and file:line (astro mirrors mapped back to .astro)
SP=${SP:?set SP to the directory holding the astro-fm mirror}
lang=$1; pat=$2; shift 2
paths=("$@"); [[ ${#paths} -eq 0 ]] && paths=(src $SP/astro-fm/src)
ast-grep run -l $lang -p "$pat" --json=stream "${paths[@]}" 2>/dev/null \
 | jq -r '"\(.file):\(.range.start.line+1)"' | sed "s#$SP/astro-fm/##; s#\.astro\.ts:#.astro:#" | sort -u > $SP/sg.out
echo "count=$(wc -l < $SP/sg.out | tr -d ' ')"; cat $SP/sg.out
