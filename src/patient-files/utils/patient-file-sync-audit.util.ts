export interface PatientFileSyncAuditEntry {
  event: string;
  source: 'app' | 'drive';
  occurredAt: string;
  details: Record<string, unknown>;
}

export function appendPatientFileSyncAudit(
  metadata: Record<string, unknown> | null | undefined,
  entry: Omit<PatientFileSyncAuditEntry, 'occurredAt'> & {
    occurredAt?: string;
  },
): Record<string, unknown> {
  const existing = Array.isArray(metadata?.syncAudit)
    ? metadata.syncAudit.filter(isAuditEntry)
    : [];
  return {
    ...metadata,
    syncAudit: [
      ...existing,
      {
        ...entry,
        occurredAt: entry.occurredAt ?? new Date().toISOString(),
      },
    ].slice(-50),
  };
}

function isAuditEntry(value: unknown): value is PatientFileSyncAuditEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'event' in value &&
    'source' in value &&
    'occurredAt' in value &&
    'details' in value
  );
}
