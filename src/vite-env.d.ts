/// <reference types="vite/client" />

/**
 * Vite turns a side-effect CSS import into a stylesheet link; TypeScript needs
 * telling that the module exists at all.
 */
declare module "*.css";
