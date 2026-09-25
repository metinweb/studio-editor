import { inject } from 'vue'
import { useMedia } from './media'
import { mediaServiceKey } from '../lib/media-service'
export const useEditorMedia = () => inject(mediaServiceKey, null) || useMedia()
