일부 target 완료 후 중단된 polling cycle의 진행 수를 durable하게 정확히 남기도록 구현하라.
정확한 커밋 `0f2b9c3`의 격리된 복사본에서 target 네 개 중 두 개 저장 후 중단되면 최종
`IngestCycle`은 `failed`, `saved=2`, `failed=2`, `completed_at`은 non-null이어야 한다. 기존
호출자와 정상 cycle 동작을 보존하라. 주입된 fixture만 사용하고 외부 서비스, workflow,
schema, deadline, polling policy를 변경하지 마라.
