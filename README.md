# Walloo Road — Model Y L 주행 동반 PWA

정적 PWA(index.html + JS) + 선택형 Tesla Fleet API 백엔드(server/).

## 실행
- 데모/GPS만: 아무 정적 HTTPS 호스트에 폴더 그대로 업로드 (GitHub Pages, Cloudflare Pages, Netlify 등). 로컬: `python3 -m http.server 8787`
- Tesla 연동 포함: `cd server && cp .env.example .env && node server.js` (Node 18+, 의존성 없음). 서버가 앱도 함께 서빙합니다.

## 데이터 소스
| 소스 | 내용 |
|---|---|
| 데모 | data/demo_route.json (OSRM로 생성한 광화문→강남역 실제 경로)을 따라 주행 시뮬레이션. 카메라마다 번갈아 제한속도 초과/준수 → 차임 시연 |
| 휴대폰 GPS | watchPosition 속도/위치 + 목적지 검색(Nominatim) → OSRM 경로 |
| Tesla Fleet API | 백엔드 `/api/vehicle` 폴링 → drive_state.speed(mph), latitude/longitude, active_route_destination / active_route_latitude / active_route_longitude / active_route_miles_to_arrival. 목적지가 바뀌면 자동 경로 계산 |

## 단속 카메라 데이터 (data/cameras.json)
전국무인교통단속카메라표준데이터(경찰청, data.go.kr/data/15028200)의 **서울특별시 부분집합(데이터기준일자 2020-05~2021-03)**,
GitHub 미러 so02e/stop_kickrani_GIS `output/서울무인단속.csv` 경유. 단속구분 1(속도)·4(속도+신호), 제한속도>0만 → 378개.
data.go.kr이 빌드 환경(해외 IP)에서 접속 차단되어 최신 전국 파일을 받지 못했습니다.
최신 전국 데이터로 교체: data.go.kr에서 CSV를 받은 뒤 `python3 tools/build_cameras.py 전국무인교통단속카메라표준데이터.csv`.

## Tesla Fleet API 연결 절차
1. developer.tesla.com 에서 Tesla 계정으로 앱 등록 (OAuth grant: authorization code, scopes: vehicle_device_data, vehicle_location). Allowed origin = 내 도메인, Redirect URI = `https://내도메인/auth/callback`. 결제수단 + billing limit 설정 필요(기본 limit 0이면 호출 차단).
2. 공개 HTTPS 도메인 준비 (서버 배포: Fly.io/Render/Railway/VPS 등).
3. `server/gen-keys.sh` → `keys/public-key.pem` 이 `https://도메인/.well-known/appspecific/com.tesla.3p.public-key.pem` 으로 서빙됨(server.js가 처리).
4. `.env` 작성 후 `node register-partner.js` (partner_accounts 도메인 등록, 1회).
5. `https://도메인/auth/login` 에서 차량 소유자 계정 로그인/동의 → tokens.json 저장 (refresh 자동).
6. 앱 설정 → 데이터 소스 'Tesla', 백엔드 URL = `https://도메인` (APP_TOKEN 설정 시 `https://도메인?k=토큰`).
- vehicle_data 는 잠든 차를 깨우지 않음(408). 주행 중엔 깨어 있으므로 문제 없음.
- 비용: Device Data 500건/$1 (=$0.002/건), 월 $10 무료 할인. 5초 폴링 = 720건/시간 ≈ $1.44/시간 → 월 약 7시간 주행분이 무료 범위. 장기적으로는 Fleet Telemetry(150,000 signals/$1)가 훨씬 저렴. 레이트 리밋 60 req/min/차량.
