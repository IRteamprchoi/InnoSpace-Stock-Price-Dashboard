# 이노스페이스 주가 및 매매 동향 대시보드

Next.js 기반으로 만든 이노스페이스(462350) IR 내부용 대시보드입니다.
데이터는 구글시트(Apps Script로 자동 수집됨)에서 가져오며, 15분(현재 시세는 5분) 이내 최신 정보를 반영합니다.

## 1. 구글시트를 CSV로 게시하기

1. 데이터가 쌓이고 있는 구글시트를 엽니다.
2. 상단 메뉴 **파일 > 공유 > 웹에 게시**
3. "게시할 항목"에서 **daily_data** 시트를 선택, 형식은 **쉼표로 구분된 값(.csv)** 선택 후 게시
4. 생성된 링크를 복사 (`.../pub?gid=...&output=csv` 형태)
5. 같은 방식으로 **intraday_price** 시트도 게시해서 링크를 하나 더 만듭니다
6. 두 링크를 잘 보관해두세요 (3단계에서 사용)

> 참고: "웹에 게시"는 링크를 아는 사람은 누구나 데이터를 열람할 수 있는 방식입니다.
> 더 민감하게 다루고 싶다면 추후 구글 서비스 계정 방식으로 전환할 수 있습니다 (코드 구조는 거의 동일).

## 2. 로컬에서 실행해보기 (선택)

```bash
npm install
cp .env.example .env.local
# .env.local 파일을 열어 DAILY_CSV_URL, INTRADAY_CSV_URL 값을 1번에서 복사한 링크로 교체
npm run dev
```

브라우저에서 http://localhost:3000 접속해서 확인합니다.

## 3. GitHub에 올리기

```bash
git init
git add .
git commit -m "이노스페이스 대시보드 초기 버전"
```
GitHub에 새 저장소를 만들고, 안내에 따라 push 합니다.

## 4. Vercel에 배포하기

1. https://vercel.com 접속, GitHub 계정으로 로그인
2. "Add New..." > "Project" > 방금 만든 저장소 선택 > "Import"
3. 배포 전 **"Environment Variables"** 섹션에서 아래 2개 추가:
   - `DAILY_CSV_URL` = 1번에서 만든 daily_data CSV 링크
   - `INTRADAY_CSV_URL` = 1번에서 만든 intraday_price CSV 링크
4. "Deploy" 클릭 → 몇 분 후 완료되면 `xxx.vercel.app` 주소가 생성됩니다

이후 구글시트 데이터가 갱신되면(Apps Script가 자동으로 채워줌), 사이트도 최대 5분(현재 시세) / 5분(일별 데이터, revalidate 300초) 안에 자동으로 최신 내용을 보여줍니다. 재배포할 필요 없습니다.

## 나중에 하면 좋은 것

- 사이트 접근 제한 (비밀번호 또는 구글 로그인 화이트리스트)
- 구글시트 → 서비스 계정 방식으로 전환 (비공개 유지)
- 참고했던 사내 다른 대시보드(isd-innospc.vercel.app) 메뉴에 통합
