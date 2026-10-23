# Contributing

Each installable skill lives in `skills/<name>/` with one `SKILL.md` entry point. Keep core instructions concise; move conditional operations, criteria, and examples into references that are loaded only when relevant.

```text
skills/
  design-vault/
    SKILL.md
    vault.example.json
    agents/openai.yaml
    references/
    scripts/
```

Start from [the template](templates/SKILL.template.md) for a new skill. Do not add empty skill directories or installable stubs for future features. Choose a real scope and verify discovery and invocation.

Possible additions, **not implemented today**:

| Possible name | Scope that could justify a separate skill |
| --- | --- |
| `component-vault` | Retrieve and adapt component patterns with their states. |
| `motion-vault` | Design and verify choreography from actual motion references. |
| `brand-vault` | Work with identity, typography, and a brand's own material. |

Design Vault already handles component decisions and motion guidance within its flow. Separate skills make sense when they have their own resources or procedures. Avoid duplicating the same rules; a static screenshot cannot prove an animation.

## Before submitting a change

- Use synthetic test data. Never publish references, notes, credentials, sessions, or personal paths.
- Keep example configuration in Git; real `vault.json` files stay ignored.
- Run the development checks in the README and inspect the complete diff.
- Document observable behavior and limitations without untested compatibility claims.
- Explain the concrete benefit and installation impact of any new dependency.
- Keep public documentation, skill instructions, CLI output, and extension UI in English. Multilingual search vocabulary and explicit language-coverage fixtures are intentional.

CI runs `scripts/check-public.py` against tracked files. This does not replace reviewing what is being published, especially when adding binaries or third-party material.
