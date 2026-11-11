import { errorMessage } from "../../lib/api";

/* Saves go to the server (which audits them); the directory is then reloaded, so every module
   sees the change. A save resolves true when done, so its dialog can close. */
export function useAdminSave(onChanged: () => Promise<void>, notify: (msg: string, kind?: "ok" | "error") => void) {
  return async (work: () => Promise<unknown>, msg: string) => {
    try {
      await work();
      await onChanged();
      notify(msg);
      return true;
    } catch (err) {
      notify(errorMessage(err), "error");
      return false;
    }
  };
}
