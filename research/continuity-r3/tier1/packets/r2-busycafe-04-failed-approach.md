## Objective

Production DB 접근을 보존하면서 Preview 접근만 제거하는 미래의 owner runbook을 작성한다.

## Completed

- `vercel env rm DATABASE_URL preview --yes`는 Preview binding만이 아니라 변수 전체를 삭제한
  인시던트가 있다.
- Vercel serverless는 Transaction pooler, GitHub worker는 Session pooler를 사용하며 direct
  IPv6 URL은 hosted runner에 부적합했다.

## Verification

- 현재 CLI help/docs 또는 owner UI에서 scope semantics를 확인하기 전에는 mutation하지 않는다.
- 변경 후 양쪽 binding, deliberate redeploy, `/api/health.data_mode`, rollback 가능성을 검증한다.

## Decisions

- 암호화된 값은 자동으로 다시 읽을 수 없으므로 destructive 작업 전에 recoverable한 올바른
  값이 존재해야 한다.

## Risks

- historical snapshot fallback은 현재 외부 상태나 live readiness를 증명하지 않는다.
- secret 값 자체를 채팅이나 로그로 요청·출력하지 않는다.

## Next action

실행 없는 stop-condition 중심 runbook만 작성하고 외부 검증은 승인된 maintenance window까지
deferred로 남긴다.
