# Contract: Task Capability Matrix

## Canonical defaults

| Capability | Admin | Collaborator with tasks module + same sector | Collaborator other sector | Client | System actor |
|---|---:|---:|---:|---:|---:|
| task.read | Yes | Yes | No | No | Scoped |
| task.create in own sector | Yes | Yes | No | No | Scoped |
| task.create in another sector | Yes | Yes, explicit destination | Yes, creation only | No | Scoped |
| task.update_content | Yes | Yes | No | No | Scoped |
| task.change_status | Yes | Yes | No | No | Scoped |
| task.assign | Yes | No | No | No | Scoped |
| task.change_sector | Yes | No | No | No | Scoped |
| task.change_client | Yes | No | No | No | Scoped |
| task.manage_subtasks | Yes | Yes | No | No | Scoped |
| task.comment | Yes | Yes | No | No | Scoped |
| task.relate | Yes | Yes on both tasks | No | No | Scoped |
| task.archive | Yes | No | No | No | Scoped job only |
| task.delete | Yes | No | No | No | Maintenance only |
| task.restore | Yes | No | No | No | Maintenance only |

All “Yes” entries still require active access, no pending review, same organization and valid input. System actors require allowlisted source, technical link and idempotency; they never receive tenant-global access implicitly.

## Secure reason codes

- `allowed`
- `access_inactive`
- `access_review_required`
- `module_not_granted`
- `task_not_available`
- `action_not_allowed`
- `invalid_transition`
- `invalid_assignment`
- `integration_scope_invalid`

External responses use `task_not_available` for missing and inaccessible resources to avoid existence disclosure.
