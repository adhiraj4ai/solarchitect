import type { AppSettings, SettingsReadResult } from '../settings/settings';
import type { DocumentType } from './documentType';
export type { AppSettings, SettingsReadResult };

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
}

/** The content of a document as it was at a git ref. `ok` is false (with an
 *  empty `content`) when the path did not exist at that ref — e.g. a brand-new,
 *  never-committed document — which the diff view treats as "no prior version". */
export interface GitShowResult {
  ok: boolean;
  content: string;
  message?: string;
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
  /** Read a document's content as it was at a git ref (e.g. 'HEAD'), for the
   *  diff/review view. Not-present-at-ref returns ok:false, never throws. */
  readDocumentAtRef(projectDir: string, fileName: string, ref: string): Promise<GitShowResult>;
  /** Create a new auto-named document of the given type; returns its file name. */
  createDocument(projectDir: string, type: DocumentType): Promise<string>;
  readTemplates(projectDir: string): Promise<string>;
  writeTemplates(projectDir: string, yamlText: string): Promise<void>;
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
