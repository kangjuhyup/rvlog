# Shared Agents

이 디렉토리는 Claude, Cursor, Codex가 공통으로 참고할 역할 문서를 둡니다.

원칙:
- 역할별 책임과 우선순위를 분명히 적습니다.
- 도구별 문서에 같은 내용을 중복 작성하지 않습니다.
- 공통 역할 원본은 이 디렉토리에서만 관리합니다.

권장 역할:
- `delivery-orchestrator.md`
- `reviewer.md`
- `release-manager.md`
- `docs-writer.md`
- `project-architect.md`
- `code-writer.md`

Codex 매핑:
- Codex용 역할 인덱스는 `../.codex/agents.toml`에서 관리합니다.
- 역할 문서에서 스킬을 참조할 때는 운영체제별 절대경로가 아니라 `../.skills/.../SKILL.md` 상대경로를 사용합니다.
