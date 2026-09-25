import type { DefineComponent, ComponentPublicInstance } from 'vue'

export interface StudioEditorApi {
  isComposing(): boolean
  subscribeTransactions(listener: (transaction: EditorTransaction) => void): () => void
  setSharedHistory(
    history: Pick<SharedDocument, 'undo' | 'redo' | 'canUndo' | 'canRedo'> | null,
  ): void
  registerPlugin(plugin: EditorPlugin): () => void
  getCommands(): { id: string; title: string; enabled: boolean }[]
  executeCommand(id: string, argument?: unknown): boolean
  refreshMedia(): Promise<boolean> | undefined
  getModel(): SchemaDocument | undefined
  setModel(model: SchemaDocument): void
  applyOperations(transaction: ModelTransaction): boolean
  /** Includes internal review metadata. Use getPublicHTML for published content. */
  getHTML(): string
  getPublicHTML(): string
  /** Sanitizes the HTML and creates an undo step. Call after ready. */
  setHTML(html: string): void
  insertHTML(html: string): void
  focus(): void
  undo(): void
  redo(): void
  openSource(): void
  openMedia(): void
  getDocument(): EditorDocument | undefined
  getHistoryStats(): HistoryStats | undefined
}
export interface EditorDocument {
  schemaVersion: 1
  revision: number
  html: string
  blockIds: string[]
}
export interface EditorPlugin {
  id: string
  commands: {
    id: string
    title: string
    enabled?: (api: StudioEditorApi) => boolean
    execute: (api: StudioEditorApi, argument: unknown) => void
  }[]
}
export interface StoredDocument {
  id: string
  title: string
  html: string
  blockIds: string[]
  version: string
}
export interface DocumentStorageAdapter {
  load(id: string): Promise<StoredDocument>
  save(document: StoredDocument, options: { expectedVersion: string }): Promise<StoredDocument>
}
export interface DocumentSession {
  readonly record: StoredDocument | null
  readonly dirty: boolean
  load(id: string): Promise<boolean>
  update(changes: Partial<Pick<StoredDocument, 'title' | 'html' | 'blockIds'>>): void
  save(): Promise<StoredDocument | null>
  dispose(): void
}
export function createDocumentSession(
  adapter: DocumentStorageAdapter,
  onChange?: (state: { record: StoredDocument | null; dirty: boolean }) => void,
): DocumentSession
export interface SharedDocument {
  subscribe(listener: (model: SchemaDocument) => void): () => void
  getModel(): SchemaDocument
  setModel(model: SchemaDocument): void
  encode(): Uint8Array
  applyUpdate(update: Uint8Array): void
  undo(): void
  redo(): void
  checkpoint(): void
  destroy(): void
  readonly canUndo: boolean
  readonly canRedo: boolean
}
export function loadCollaboration(): Promise<{
  openSharedRoom(options: {
    url: string
    room: string
    getToken: () => string | Promise<string>
    initial?: SchemaDocument
    createSharedDocument: (options: {
      initial?: SchemaDocument
      update?: Uint8Array
    }) => SharedDocument
  }): Promise<{ shared: SharedDocument; role: 'editor' | 'viewer'; users: SharedUser[] }>
  connectSharedRoom(options: {
    url: string
    room: string
    getToken: () => string | Promise<string>
    shared: SharedDocument
    binding: { receive(update: Uint8Array): void }
    onStatus?: (status: string) => void
    onPresence?: (users: SharedUser[]) => void
    onRole?: (role: 'editor' | 'viewer') => void
  }): { dispose(): void }
  bindSharedDocument(
    editor: StudioEditorApi,
    shared: SharedDocument,
    options?: { onError?: (error: Error) => void },
  ): { receive(update: Uint8Array): void; dispose(): void }
  createSharedDocument(options?: {
    initial?: SchemaDocument
    update?: Uint8Array
    onChange?: (model: SchemaDocument) => void
    onUpdate?: (update: Uint8Array) => void
  }): SharedDocument
  persistSharedDocument(
    name: string,
    shared: SharedDocument,
  ): { whenSynced: Promise<unknown>; destroy(): Promise<void> }
}>
export interface SharedUser {
  id: string
  name: string
  role: 'editor' | 'viewer'
  lastSeen: number
}
export type DocumentNode =
  | { type: 'text'; text: string }
  | { type: 'element'; tag: string; attrs: Record<string, string>; children: DocumentNode[] }
export interface DocumentBlock {
  id: string
  node: DocumentNode
}
export interface SchemaDocument {
  schemaVersion: 2
  revision: number
  blocks: DocumentBlock[]
}
export type ModelOperation =
  | { type: 'insertBlock'; index: number; block: DocumentBlock }
  | { type: 'removeBlock'; blockId: string }
  | { type: 'moveBlock'; blockId: string; index: number }
  | {
      type: 'replaceText'
      blockId: string
      path: number[]
      from: number
      removed: string
      inserted: string
    }
  | { type: 'setAttributes'; blockId: string; path: number[]; attrs: Record<string, string> }
export interface ModelTransaction {
  baseRevision: number
  operations: ModelOperation[]
}
export function validateModel(model: SchemaDocument): SchemaDocument
export function renderModel(model: SchemaDocument): string
export function applyModelOperations(
  model: SchemaDocument,
  transaction: ModelTransaction,
): SchemaDocument
export interface HistoryStats {
  undo: number
  redo: number
  patchBytes: number
  documentBytes: number
}
export interface SelectionAnchor {
  id: string
  path: number[]
  offset: number
  textOffset: number
  affinity: -1 | 1
  mapped?: boolean
}
export interface SelectionBookmark {
  start: number[]
  startOffset: number
  end: number[]
  endOffset: number
  startAnchor: SelectionAnchor | null
  endAnchor: SelectionAnchor | null
}
export type SelectionChange =
  | { blockId: string; deleted: true }
  | { blockId: string; from: number; deleted: number; inserted: number }
export interface EditorTransaction {
  schemaVersion: 1
  id: string
  baseRevision: number
  revision: number
  origin: 'local' | 'undo' | 'redo'
  kind: string
  steps: { type: 'replaceHtml'; from: number; removed: string; inserted: string }[]
  selectionBefore: SelectionBookmark | null
  selectionAfter: SelectionBookmark | null
  blockIdsBefore: string[]
  blockIdsAfter: string[]
  mapping: SelectionChange[]
}
export interface MediaAsset {
  id: string
  name: string
  type: string
  size: number
  url: string
  alt?: string
  createdAt?: number
}
export interface MediaAdapter {
  resolve?(id: string): Promise<MediaAsset>
  label?: string
  list(): Promise<MediaAsset[]>
  upload(
    file: File,
    options: { signal: AbortSignal; alt: string; onProgress: (fraction: number) => void },
  ): Promise<MediaAsset>
  update(asset: MediaAsset): Promise<MediaAsset>
  remove(id: string): Promise<void>
}
export function createHttpMediaAdapter(options: {
  baseUrl: string
  getToken: () => string | Promise<string>
}): MediaAdapter
export function mapSelection(
  position: SelectionBookmark | null,
  changes: SelectionChange[],
): SelectionBookmark | null
export function mapOffset(
  offset: number,
  change: { from: number; deleted: number; inserted: number },
  affinity?: -1 | 1,
): number
export interface StudioEditorProps {
  /** Suggestions for @mention completion. IDs are stored in the document. */
  mentions?: { id: string; label: string }[]
  /** Allow new local mention labels; false by default in the Vue component. No notifications are sent. */
  allowCreateMention?: boolean
  /** Text direction inside the document; independent of interface language. */
  direction?: 'ltr' | 'rtl' | 'auto'
  /** Cell presentation for HTML table paste in keep mode; defaults to target. */
  tablePasteStyle?: TablePasteStyle
  'onUpdate:tablePasteStyle'?: (style: TablePasteStyle) => void
  pasteMode?: PasteMode
  'onUpdate:pasteMode'?: (mode: PasteMode) => void
  onPaste?: (info: PasteInfo) => void
  modelValue?: string
  /** Pixels, or a CSS height such as "70vh". Minimum 320px. */
  height?: number | string
  /** Blocks user editing while allowing selection, copy and external content updates. */
  readonly?: boolean
  /** Blocks user editing, focus and interaction. External content updates still work. */
  disabled?: boolean
  /** Plain text hint, never added to document HTML. */
  placeholder?: string
  /** Show all groups, hide the toolbar, or select groups in the standard order. */
  toolbar?: boolean | ToolbarGroup[]
  menubar?: boolean | MenuName[]
  /** Core editor UI locale. Advanced panels currently fall back to Turkish. */
  locale?: 'tr' | 'en'
  /** Plain-text overrides keyed by Turkish source message. Scoped to this editor. */
  messages?: Record<string, string>
  /** Instance-scoped adapter; remount with a new key to change provider or account. */
  mediaAdapter?: MediaAdapter
  'onUpdate:modelValue'?: (html: string) => void
  onChange?: (html: string) => void
  onSave?: (html: string) => void
  onReady?: (editor: StudioEditorApi) => void
  onTransaction?: (transaction: EditorTransaction) => void
  onUploadProgress?: (percent: number) => void
  onUploadError?: (message: string) => void
}
export type ToolbarGroup =
  'history' | 'typography' | 'format' | 'color' | 'align' | 'lists' | 'insert' | 'tools' | 'review'
export type MenuName = 'file' | 'edit' | 'view' | 'insert' | 'format' | 'table' | 'tools'
export type PasteMode = 'keep' | 'clean' | 'text'
export type TablePasteStyle = 'target' | 'source'
export interface PasteInfo {
  source: 'word' | 'excel' | 'google-docs' | 'html' | 'tsv' | 'text' | 'unknown'
  mode: PasteMode
  rows: number
  columns: number
  warnings: string[]
  inserted: boolean
}
export const toolbarGroups: readonly ToolbarGroup[]
export const menuNames: Readonly<Record<MenuName, string>>
export const englishMessages: Readonly<Record<string, string>>
export const StudioEditor: DefineComponent<StudioEditorProps> & {
  new (): ComponentPublicInstance<StudioEditorProps> & StudioEditorApi
}
export function cleanHtml(html: string): string
export interface PrintOptions {
  size?: 'A4' | 'Letter'
  landscape?: boolean
  margin?: number
  header?: string
  footer?: string
}
export function renderPrintDocument(html: string, options?: PrintOptions): string
export function printDocument(html: string, options?: PrintOptions): Promise<void>
export function exportDocx(html: string, options?: PrintOptions): Promise<Blob>
export function publicHtml(html: string): string
export function renderDocument(document: {
  title: string
  content: string
  locale?: 'en' | 'tr'
}): string
export const documentCss: string
