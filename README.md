# Book Loop 2026

현재 기능: 회원가입, 로그인, 공개 책 목록, 내 책장, 책 등록/삭제, 다른 독자의 책장 보기, 교환 신청/수락/거절/취소, 수락 후 배송 정보 공유.

1. Supabase SQL Editor에서 `supabase-profile-trigger.sql` 실행
2. Supabase SQL Editor에서 `supabase-exchange-requests.sql` 전체 실행
3. 이 폴더의 파일을 GitHub `Book-loop-2026` 저장소 최상단에 업로드
4. Netlify에서 GitHub 저장소 연결
   - Build command: 비워두기
   - Publish directory: `.`

주의: service_role, secret key, DB 비밀번호는 GitHub에 올리지 마세요.
