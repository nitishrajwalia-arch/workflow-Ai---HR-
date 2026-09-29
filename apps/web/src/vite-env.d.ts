/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Where the API lives. Leave unset and the app calls the same origin it was
   * served from, which is what both the dev proxy and the production reverse
   * proxy arrange. Set it only when the API is on a different host — and then
   * that host must allow this origin in CORS_ORIGINS.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
