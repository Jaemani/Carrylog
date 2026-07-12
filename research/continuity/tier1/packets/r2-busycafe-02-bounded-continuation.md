## Objective

poll 중간 중단 전에 완료된 target 진행 수를 durable cycle finalization에 보존한다.

## Completed

- `run_poll_cycle`은 이미 `Exception`, `KeyboardInterrupt`, `SystemExit`를 잡아 failed로
  finalize하고 다시 throw한다.
- retry isolation, 정상 `PollReport`, 5회 연속 실패 circuit은 이미 구현되어 있다.

## Verification

- target 4개 중 2개 저장 후 중단되는 결정적 regression을 추가한다.
- focused poller/repository tests, 전체 backend tests, compileall, diff check를 실행한다.

## Decisions

- 기존 `poll_once` 호출자는 source-compatible해야 한다.
- materializer 실패도 완료된 poll counter를 보존하면서 cycle은 failed로 남겨야 한다.

## Risks

- schema, workflow, deadline, retry/circuit policy, canary 변경이나 실제 provider/production
  접근은 이 작업 범위가 아니다.

## Next action

`targets=4`, `saved=2`, `failed=2`, `status=failed`, non-null `completed_at`을 만족하는 최소
progress channel과 regression을 구현한다.
