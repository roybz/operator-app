# Dependencies

This folder contains shared, portable dependencies that apps can opt into when
copying a standalone application out of the Operator App codebase.

Currently included:

- `app-types.ts`: shared app ids and dialog rect typing.
- `app-registry.ts`: app metadata (label keys, icons, default dialog sizes).
- `app-preferences.service.ts`: lightweight wrapper for app-facing preferences.
- `instance-state-storage.ts`: shared instance-scoped keying/clone/clear helpers.

Apps inside `features/applications` should prefer these dependencies over
reaching into `core` when possible, so that extracting an app only requires
copying its folder plus the specific dependencies it uses.

Note:

- Some cross-app sync/persistence behavior now lives in `core/realtime/` (for example
  `instance-persist-queue.ts`) because it depends on app-wide storage/realtime services.
