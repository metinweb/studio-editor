import type { DefineComponent, ComponentPublicInstance } from 'vue'

export interface StudioEditorApi {
  isComposing(): boolean
  subscribeTransactions(listener: (transaction: EditorTransaction) => void): () => void
  /** Local caret changes, for presence transports. */
  subscribeSelection(listener: (selection: PortableSelection | null) => void): () => void
  getSelectionAnchor(): PortableSelection | null
  /** Draws collaborators' carets and selections, and lists them in the status bar. */
  setRemoteSelections(users: RemoteSelection[]): void
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
  /** Snapshot supported computed presentation styles; not an email rendering guarantee. */
  getInlineHTML(): string
  /** Sanitizes the HTML and creates an undo step. Call after ready. */
  setHTML(html: string): void
  insertHTML(html: string): void
  focus(): void
  undo(): void
  redo(): void
  openSource(): void
  openMedia(): void
  openScience(): void
  /** Opens the Mermaid diagram dialog. Not available in studio-editor/lite. */
  openDiagram(): void
  openContentStyles(): void
  openAssistant(kind?: 'ai' | 'language'): void
  openPageEmbed(): void
  openUiElement(kind?: UiElementKind): void
  openVersionHistory(): void
  /** Wraps the selection in an editable region (inline in one block, otherwise block). */
  markEditableRegion(name?: string): boolean
  removeEditableRegion(): boolean
  getEditableRegions(): EditableRegion[]
  /** Restricted mode only: selects the next or previous editable region. */
  focusEditableRegion(backward?: boolean): boolean
  getTrackedChanges(): TrackedChange[]
  acceptChange(id: string): boolean
  rejectChange(id: string): boolean
  acceptAllChanges(): boolean
  rejectAllChanges(): boolean
  getDocument(): EditorDocument | undefined
  getHistoryStats(): HistoryStats | undefined
}
export interface TrackedChange {
  id: string
  type: 'insert' | 'delete' | 'replace' | 'split' | 'join'
  author: string
  authorName: string
  /** ISO time of the first edit in the change. */
  time: string
  inserted: string
  deleted: string
}
export interface EditableRegion {
  /** Empty for unnamed regions. */
  name: string
  kind: 'inline' | 'block'
  text: string
  html: string
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
  listVersions?(id: string): Promise<DocumentVersion[]>
  loadVersion?(id: string, version: string): Promise<StoredDocument>
}
export interface DocumentVersion {
  version: string
  title: string
  createdAt?: string
}
export interface AutosaveState {
  record: StoredDocument | null
  dirty: boolean
  status: 'idle' | 'loading' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error'
  error: Error | null
}
export interface AutosaveSession {
  readonly state: AutosaveState
  load(id: string): Promise<boolean>
  update(changes: Partial<Pick<StoredDocument, 'title' | 'html' | 'blockIds'>>): void
  save(): Promise<StoredDocument | null>
  retry(): Promise<StoredDocument | null>
  pause(): void
  resume(): void
  listVersions(): Promise<DocumentVersion[]>
  loadVersion(version: string): Promise<StoredDocument>
  dispose(): void
}
export function createAutosaveSession(
  adapter: DocumentStorageAdapter,
  options?: { delay?: number; onChange?: (state: AutosaveState) => void },
): AutosaveSession
export function bindDocumentSession(
  editor: StudioEditorApi,
  options: {
    adapter: DocumentStorageAdapter
    id: string
    delay?: number
    onChange?: (state: AutosaveState) => void
    warnOnUnload?: boolean
    signal?: AbortSignal
  },
): Promise<{ session: AutosaveSession; dispose(): void }>
export function createHttpDocumentAdapter(options: {
  baseUrl: string
  getToken?: () => string | Promise<string>
  fetch?: typeof fetch
  timeout?: number
}): DocumentStorageAdapter
export type FeatureName =
  | 'formatting'
  | 'lists'
  | 'tables'
  | 'media'
  | 'links'
  | 'review'
  | 'history'
  | 'science'
  | 'source'
  | 'ai'
  | 'language'
  | 'pageEmbed'
  | 'uiElements'
  /** Local DOCX import. Always false in studio-editor/lite. */
  | 'wordImport'
  /** Commands that create and remove editable regions and toggle restricted mode. */
  | 'restrictedEditing'
  /** Mermaid diagrams. Always false in studio-editor/lite. */
  | 'diagrams'
export type EditorFeatures = Partial<Record<FeatureName, boolean>>
export type UiElementKind = 'form' | 'slider' | 'accordion'
export type UiFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'range'
export interface UiField {
  type: UiFieldType
  name: string
  label: string
  help?: string
  placeholder?: string
  required?: boolean
  fullWidth?: boolean
  options?: string[]
  min?: number
  max?: number
  step?: number
}
export interface UiElementBase {
  version: 1
  id: string
  title: string
  description?: string
  accent?: string
}
export interface UiForm extends UiElementBase {
  kind: 'form'
  action?: string
  submitLabel?: string
  columns?: 1 | 2
  fields: UiField[]
}
export interface UiSlide {
  title: string
  text?: string
  image?: string
  alt?: string
  link?: string
  linkLabel?: string
}
export interface UiSlider extends UiElementBase {
  kind: 'slider'
  cards?: 1 | 2 | 3
  ratio?: '16/9' | '4/3' | '1/1'
  items: UiSlide[]
}
export interface UiAccordion extends UiElementBase {
  kind: 'accordion'
  items: { title: string; text?: string; open?: boolean }[]
}
export type UiElement = UiForm | UiSlider | UiAccordion
export const uiFieldTypes: readonly UiFieldType[]
export function newUiElement(kind: 'form', locale?: 'en' | 'tr'): UiForm
export function newUiElement(kind: 'slider', locale?: 'en' | 'tr'): UiSlider
export function newUiElement(kind: 'accordion', locale?: 'en' | 'tr'): UiAccordion
export function newUiElement(kind: UiElementKind, locale?: 'en' | 'tr'): UiElement
export function normalizeUiElement(value: unknown): UiElement
/** portable stores definitions, editor renders non-submitting cards, public renders native controls. */
export function uiElementHtml(
  value: UiElement,
  mode?: 'portable' | 'editor' | 'public' | 'preview',
): string
export interface AssistanceInput {
  text: string
  language: string
}
export interface AiInput extends AssistanceInput {
  action: 'rewrite' | 'summarize' | 'translate' | 'shorten' | 'expand'
  instruction: string
}
export interface LanguageIssue {
  offset: number
  length: number
  message: string
  replacements: string[]
}
export interface AssistanceAdapter {
  label?: string
  /** Call `onText` with the accumulated text to stream it into the review dialog. */
  generate?(
    input: AiInput,
    context: { signal: AbortSignal; onText?: (text: string) => void },
  ): Promise<{ text: string }>
  check?(
    input: AssistanceInput,
    context: { signal: AbortSignal },
  ): Promise<{ issues: LanguageIssue[] }>
}
export function createHttpAssistanceAdapter(options: {
  baseUrl: string
  getToken?: () => string | Promise<string>
  label?: string
  /** Ask the AI endpoint for text/event-stream; JSON replies keep working. */
  stream?: boolean
  fetch?: typeof fetch
}): AssistanceAdapter
/**
 * Reads Server-Sent Events: data lines with {"delta"}, {"text"} or {"error"} JSON, ending with
 * [DONE] or the end of the stream. Use it inside a custom adapter's generate().
 */
export function readAssistanceStream(
  response: Response,
  options?: { onText?: (text: string) => void; signal?: AbortSignal },
): Promise<{ text: string }>
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
    /** Sent with every sync so peers can draw this user's caret. */
    getSelection?: () => PortableSelection | null
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
  selection?: PortableSelection | null
}
/** A caret or selection addressed by top-level block id and text offset. */
export interface PortableSelection {
  start: { block: string; offset: number }
  end: { block: string; offset: number }
}
export interface RemoteSelection {
  id: string
  name: string
  /** CSS color; derived from the id when omitted. */
  color?: string
  selection?: PortableSelection | null
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
export type EditorTheme = 'light' | 'dark' | 'auto'
export interface StudioEditorProps {
  /** Interface theme: menus, toolbars, panels and dialogs. 'auto' follows the system. Default light. */
  theme?: EditorTheme
  /**
   * Only regions marked with data-studio-editable can change; structure, source editing and
   * other content stay locked. Users cannot leave a host-enforced restricted mode.
   */
  restricted?: boolean
  /**
   * Record insertions, deletions and paragraph breaks as suggestions. Formatting and structure
   * commands are refused while tracking. Users cannot turn off a host-enforced mode.
   */
  trackChanges?: boolean
  /** Author of tracked changes. */
  user?: { id: string; name?: string }
  features?: EditorFeatures
  assistanceAdapter?: AssistanceAdapter
  documentSession?: AutosaveSession
  bodyClass?: string
  'onUpdate:bodyClass'?: (classes: string) => void
  /** Trusted stylesheet URLs, applied only to the content iframe and its preview. */
  contentCss?: string | string[]
  /** Show content CSS settings; does not prevent host-provided styles. Defaults true. */
  allowContentCss?: boolean
  'onUpdate:contentCss'?: (urls: string[]) => void
  onContentCssStatus?: (status: ContentCssStatus) => void
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
  /**
   * The editor failed and was rebuilt from its last HTML (`recovered: true`), or stopped after
   * more than three failures within a minute (`recovered: false`, with a restart button).
   */
  onCrash?: (crash: EditorCrash) => void
}
export interface EditorCrash {
  error: unknown
  recovered: boolean
  /** Last readable document HTML, also used for the restarted editor. */
  html: string
}
export type ToolbarGroup =
  'history' | 'typography' | 'format' | 'color' | 'align' | 'lists' | 'insert' | 'tools' | 'review'
export type MenuName = 'file' | 'edit' | 'view' | 'insert' | 'format' | 'table' | 'tools' | 'help'
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
export interface ContentCssStatus {
  url: string
  status: 'loading' | 'loaded' | 'error'
  message?: string
}
export type MountedEditorOptions = Pick<
  StudioEditorProps,
  | 'direction'
  | 'height'
  | 'mentions'
  | 'allowCreateMention'
  | 'readonly'
  | 'disabled'
  | 'placeholder'
  | 'toolbar'
  | 'menubar'
  | 'locale'
  | 'messages'
  | 'pasteMode'
  | 'tablePasteStyle'
  | 'contentCss'
  | 'allowContentCss'
  | 'features'
  | 'bodyClass'
  | 'documentSession'
  | 'theme'
  | 'restricted'
  | 'trackChanges'
  | 'user'
>
export interface MountedEditor extends StudioEditorApi {
  isDirty(): boolean
  /** Call only after your server confirms a successful save. */
  markClean(): void
  setOptions(options: MountedEditorOptions): void
  /** Restores the textarea with its latest HTML. Safe to call more than once. */
  destroy(): void
}
export interface MountStudioEditorOptions extends MountedEditorOptions {
  assistanceAdapter?: AssistanceAdapter
  onBodyClassChange?: (classes: string) => void
  onContentCssChange?: (urls: string[]) => void
  onContentCssStatus?: (status: ContentCssStatus) => void
  mediaAdapter?: MediaAdapter
  onChange?: (html: string, editor: MountedEditor | undefined) => void
  onSave?: (html: string, editor: MountedEditor | undefined) => void
  onCrash?: (crash: EditorCrash) => void
}
/** Browser only. Resolves when one existing textarea has become an editor. */
export function mountStudioEditor(
  target: string | HTMLTextAreaElement,
  options?: MountStudioEditorOptions,
): Promise<MountedEditor>
/** `<studio-editor>`: a form-associated custom element. Its HTML is submitted under `name`. */
export interface StudioEditorElement extends HTMLElement {
  /** Current HTML. Setting it replaces the document and creates an undo step once ready. */
  value: string
  readonly editor: StudioEditorApi | null
  readonly form: HTMLFormElement | null
  readonly name: string | null
  readonly validity: ValidityState
  readonly validationMessage: string
  features: EditorFeatures
  mentions?: { id: string; label: string }[]
  messages?: Record<string, string>
  contentCss?: string | string[]
  /** Read when the element is connected; set it before inserting the element. */
  mediaAdapter?: MediaAdapter
  assistanceAdapter?: AssistanceAdapter
  documentSession?: AutosaveSession
  /** Author of tracked changes. */
  user?: { id: string; name?: string }
  whenReady(): Promise<StudioEditorElement>
  getHTML(): string
  getPublicHTML(): string
  focus(): void
  checkValidity(): boolean
  reportValidity(): boolean
}
/**
 * Registers the custom element and returns its constructor. Attributes: value, name, locale, theme,
 * placeholder, direction, readonly, disabled, required, height, toolbar, menubar, content-css,
 * body-class, paste-mode, table-paste-style, allow-create-mention, restricted, track-changes and
 * disable-features.
 * Events: input, change, studio-ready, studio-save and studio-transaction.
 */
export function defineStudioEditorElement(tagName?: string): {
  new (): StudioEditorElement
  prototype: StudioEditorElement
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
