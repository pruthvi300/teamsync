// ============================================================================
// TeamSync — Auth store (Zustand)
// ============================================================================
// isInitializing is true until initAuth() has tried to restore the session
// from the stored refresh token, so protected routes don't flash /login.
// ============================================================================

import { create } from "zustand";
import toast from "react-hot-toast";
import {
  authAPI,
  clearTokens,
  errorMessage,
  getStoredRefreshToken,
  refreshSession,
  setSessionExpiredHandler,
  setTokens,
} from "../services/api.js";

const useAuthStore = create((set) => {
  const signedIn = (data) => {
    setTokens(data.access_token, data.refresh_token);
    set({ user: data.user, isAuthenticated: true });
  };
  const signedOut = () => set({ user: null, isAuthenticated: false });

  setSessionExpiredHandler(() => {
    signedOut();
    toast.error("Your session expired. Please sign in again.");
  });

  return {
    user: null,
    isAuthenticated: false,
    isInitializing: true,
    isLoading: false,

    initAuth: async () => {
      if (!getStoredRefreshToken()) {
        set({ isInitializing: false });
        return;
      }
      try {
        signedIn(await refreshSession());
      } catch {
        clearTokens();
        signedOut();
      } finally {
        set({ isInitializing: false });
      }
    },

    login: async (email, password) => {
      set({ isLoading: true });
      try {
        const { data } = await authAPI.login({ email, password });
        signedIn(data);
        toast.success(`Welcome back, ${data.user.username}!`);
        return true;
      } catch (error) {
        toast.error(errorMessage(error, "Login failed"));
        return false;
      } finally {
        set({ isLoading: false });
      }
    },

    register: async (email, username, password) => {
      set({ isLoading: true });
      try {
        const { data } = await authAPI.register({ email, username, password });
        signedIn(data);
        toast.success(`Welcome to TeamSync, ${data.user.username}!`);
        return true;
      } catch (error) {
        toast.error(errorMessage(error, "Registration failed"));
        return false;
      } finally {
        set({ isLoading: false });
      }
    },

    logout: () => {
      clearTokens();
      signedOut();
      toast.success("Logged out successfully");
    },
  };
});

export default useAuthStore;
