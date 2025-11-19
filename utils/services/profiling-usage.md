# Table Profiling Usage

## Simple Pattern

```typescript
const fullTableName = `${database}.${schema}.${table}`;

if (await TableProfiler.needsProfiling(fullTableName)) {
  const metadata = await TableProfiler.profileTable(client, fullTableName, 10000);
  await metadataStore.saveTableMetadata(metadata);
}
```

**Profile once, cache forever.** No expiration for demo purposes.

**Profiles are automatically saved to IndexedDB after:**
- New table materialization
- First time streaming configuration

**To force re-profile:**
```typescript
await metadataStore.deleteTableMetadata(fullTableName);
// Then profile again
```
