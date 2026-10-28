#!/usr/bin/env python3
"""Gabungkan index.html + css/ + js/ menjadi SATU file HTML:  python3 build-single.py [output.html]"""
import re, sys, pathlib
root = pathlib.Path(__file__).parent
h = (root / 'index.html').read_text(encoding='utf-8')
h = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', lambda m: '<style>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</style>', h)
h = re.sub(r'<script src="(js/[^"]+)"></script>', lambda m: '<script>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</script>', h)
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'fx-quant-single.html'
out.write_text(h, encoding='utf-8'); print('OK ->', out, f'({len(h)//1024} KB)')
