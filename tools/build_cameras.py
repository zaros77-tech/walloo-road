# Rebuild data/cameras.json from the official CSV (전국무인교통단속카메라표준데이터). Handles cp949/utf-8.
import csv, json, sys, io
raw = open(sys.argv[1], 'rb').read()
for enc in ('utf-8-sig', 'cp949'):
    try: text = raw.decode(enc); break
    except UnicodeDecodeError: pass
out = []
for x in csv.DictReader(io.StringIO(text)):
    try: lat, lon, lim = float(x['위도']), float(x['경도']), int(float(x['제한속도'] or 0))
    except (ValueError, KeyError): continue
    t = (x.get('단속구분') or '').split('.')[0].lstrip('0')
    if t not in ('1', '4') or lim <= 0 or not (33 < lat < 39 and 124 < lon < 132): continue
    out.append([round(lat, 6), round(lon, 6), lim, (x.get('도로노선명') or '').strip(), (x.get('설치장소') or '').strip(), (x.get('도로노선방향') or '').split('.')[0], t])
src = f"전국무인교통단속카메라표준데이터 (경찰청, data.go.kr/data/15028200) · {sys.argv[1]} · 단속구분 1/4만"
json.dump({"source": src, "fields": ["lat","lon","limit","road","place","dir","type"], "cameras": out}, open('data/cameras.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'cameras')
