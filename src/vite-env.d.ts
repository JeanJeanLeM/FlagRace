/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT_MENU?: string;
  readonly VITE_ADSENSE_SLOT_MENU_SECOND?: string;
  readonly VITE_ADSENSE_SLOT_MENU_BOTTOM?: string;
  readonly VITE_ADSENSE_SLOT_GAME_SIDEBAR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
