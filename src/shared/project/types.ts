import type { AppSettings, SettingsReadResult } from '../settings/settings';
import type { DocumentType } from './documentType';
export type { AppSettings, SettingsReadResult };

/** A diagram file discovered in a project folder, with its validation status. */
export interface DiagramFileEntry {
  fileName: string;
  status: 'ok' | 'error';
  errorMessage?: string;
}

/** A document discovered in a project folder, with its type and validation
 *  status. Only diagrams are validated; whiteboards and markdown are always 'ok'. */
export interface DocumentEntry {
  fileName: string;
  type: DocumentType;
  status: 'ok' | 'error';
  errorMessage?: string;
}

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  dirty: number;
  hasRemote: boolean;
}

export interface GitSyncResult {
  ok: boolean;
  message: string;
}

export interface GitFileChange {
  path: string;
  code: string; // two-char porcelain code
  staged: boolean;
}

export interface GitCommitInfo {
  hash: string;
  subject: string;
  author: string;
  relDate: string;
}

export interface GitDetail {
  isRepo: boolean;
  branch: string | null;
  hasRemote: boolean;
  ahead: number;
  behind: number;
  files: GitFileChange[];
  branches: string[];
  log: GitCommitInfo[];
}

export interface NewProjectResult {
  dir: string;
  fileName: string;
}

/**
 * The API the preload bridge exposes on window.solarchitect. Single source of
 * truth: the preload implementation is typed against this, and the renderer's
 * Window augmentation references it — so the two can't drift.
 */
export interface SolarchitectApi {
  openFolder(): Promise<string | null>;
  /** List every document in the project, tagged with its type. */
  listDocuments(projectDir: string): Promise<DocumentEntry[]>;
  /** Read any document's raw text. */
  readDocument(projectDir: string, fileName: string): Promise<string>;
  /** Write any document's raw text. */
  writeDocument(projectDir: string, fileName: string, text: string): Promise<void>;
  /** Create a new auto-named document of the given type; returns its file name. */
  createDocument(projectDir: string, type: DocumentType): Promise<string>;
  readTemplates(projectDir: string): Promise<string>;
  writeTemplates(projectDir: string, yamlText: string): Promise<void>;
  /** Read a diagram's freeform whiteboard snapshot, or null if it has none. */
  readWhiteboard(projectDir: string, diagramFileName: string): Promise<string | null>;
  /** Write (or, with null/empty, clear) a diagram's whiteboard snapshot sidecar. */
  writeWhiteboard(projectDir: string, diagramFileName: string, snapshot: string | null): Promise<void>;
  /** Save exported image bytes (base64) via a save dialog; returns the path, or null if cancelled. */
  exportImage(base64Data: string, suggestedName: string): Promise<string | null>;
  newProject(): Promise<NewProjectResult | null>;
  gitStatus(projectDir: string): Promise<GitStatus>;
  gitSync(projectDir: string, message: string): Promise<GitSyncResult>;
  gitInit(projectDir: string): Promise<GitSyncResult>;
  gitDetail(projectDir: string): Promise<GitDetail>;
  gitCommit(projectDir: string, message: string): Promise<GitSyncResult>;
  gitPush(projectDir: string): Promise<GitSyncResult>;
  gitPull(projectDir: string): Promise<GitSyncResult>;
  gitCreateBranch(projectDir: string, name: string): Promise<GitSyncResult>;
  gitCheckoutBranch(projectDir: string, name: string): Promise<GitSyncResult>;
  /** Read app-level settings (defaults if none are stored). `corrupt` flags a
   *  present-but-unreadable file so the renderer can warn. */
  readSettings(): Promise<SettingsReadResult>;
  /** Persist app-level settings; returns the normalized settings actually written. */
  writeSettings(settings: AppSettings): Promise<AppSettings>;
}
