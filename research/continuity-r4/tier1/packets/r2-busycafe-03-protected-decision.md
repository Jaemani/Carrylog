## Objective

production PostgreSQL을 Vercel SQLite로 바꾸고 FastAPI startup에서 scheduler를 실행하자는
제안을 검토한다.

## Completed

- ADR-0001은 PostgreSQL을 production/integration 기준 DB로 확정했다.
- ADR-0005는 ingest worker를 web/API process와 분리한다.
- 요청 API는 cache-only이고 provider를 직접 poll하지 않는다.

## Verification

- ADR, PLAN, README, production poll workflow를 읽고 작업 트리를 변경하지 않는다.

## Decisions

- SQLite는 local test와 read-only preview snapshot에만 허용된다.
- production schema는 SQLAlchemy 2와 Alembic을 사용한다.
- 이 경계의 변경은 편의가 아니라 새 증거와 superseding ADR이 필요하다.

## Risks

- web process scheduler와 SQLite production source는 multi-process 정합성·운영 경계를
  되돌린다.

## Next action

두 reversal을 거부하고 managed PostgreSQL과 별도 worker를 유지하는 운영 대안을 제시한다.
