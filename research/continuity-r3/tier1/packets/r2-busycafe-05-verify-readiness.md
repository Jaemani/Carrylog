## Objective

freshness checker의 상태 기계와 경계를 local fixture tests로만 검증한다.

## Completed

- freshness 기준은 최신 snapshot이나 일반 `last_ingest_at`이 아니라
  `last_complete_cycle_at`이다.
- stale 경계는 25분이고 2분을 넘는 미래 complete timestamp는 거부한다.

## Verification

- focused freshness tests와 compileall을 실행하고 실제 결과만 보고한다.
- absolute HTTPS가 아닌 URL은 opener 호출 전에 거부되며 기존 query는 보존하고 cache-busting
  parameter를 추가한다.

## Decisions

- fresh한 이전 complete cycle이 있으면 `complete`와 `running`은 통과할 수 있지만 `partial`과
  `failed`는 실패한다.

## Risks

- `.env`, URL, production health payload를 읽지 않는다.
- local test는 코드 동작만 증명하며 현재 production freshness를 증명하지 않는다.

## Next action

허용·거부 경계와 실행한 local checks를 보고하고 작업 트리를 변경하지 않는다.
