# Calendar App

This Calendar app is a standalone viewer for external calendars. It does not
create or own events; instead it renders events imported from external feeds.

Dependencies to copy if extracting:

- `features/dependencies/app-preferences.service.ts`
- `features/dependencies/app-types.ts`
- `features/dependencies/app-registry.ts`

The app expects events as JSON arrays of `{ title, start, end }` objects.
