
import PocketBase from 'pocketbase';

/**
 * PocketBase Service Client
 * Initialized with environment variables for multi-stage support (Dev/Prod).
 */

const PB_URL = (import.meta as any).env?.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);

// Standardized Auth state helper
export const isAuthenticated = () => pb.authStore.isValid;
export const currentUser = () => pb.authStore.model;

/**
 * Utility to refresh session if needed
 */
export const refreshAuth = async () => {
  if (pb.authStore.isValid) {
    try {
      await pb.collection('users').authRefresh();
    } catch (e) {
      pb.authStore.clear();
    }
  }
};
