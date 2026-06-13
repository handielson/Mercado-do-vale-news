import { vpsClient } from './vpsClient';

export interface SystemBackupConfig {
  enabled: boolean;
  scheduleTime: string;
  timezone: string;
}

export interface SystemBackupStatus {
  state: 'idle' | 'running' | 'success' | 'partial' | 'failed';
  startedAt?: string | null;
  finishedAt?: string | null;
  name?: string | null;
  trigger?: string | null;
  message?: string | null;
  error?: string | null;
  progress?: number | null;
  step?: string | null;
  vpsPackage?: string | null;
  synologyMirror?: {
    ok: boolean;
    path?: string | null;
    error?: string | null;
  } | null;
}

export interface SystemBackupSnapshot {
  ok: boolean;
  config: SystemBackupConfig;
  status: SystemBackupStatus;
  nextRunAt: string | null;
  locations: {
    vps: string;
    synology: string;
    localManifest: string;
  };
  coverage: string[];
}

export async function getSystemBackupSnapshot(): Promise<SystemBackupSnapshot> {
  return vpsClient.get<SystemBackupSnapshot>('/admin/system-backup');
}

export async function saveSystemBackupSchedule(scheduleTime: string, enabled: boolean): Promise<SystemBackupSnapshot> {
  return vpsClient.patch<SystemBackupSnapshot>('/admin/system-backup', { scheduleTime, enabled });
}

export async function runSystemBackupNow(): Promise<SystemBackupSnapshot> {
  return vpsClient.post<SystemBackupSnapshot>('/admin/system-backup/run', {});
}
