import { useLocalStorage } from "@uidotdev/usehooks";

export function useAdminView() {
  const [isAdminView, setIsAdminView] = useLocalStorage("hq:admin-view", true);
  return { isAdminView, setIsAdminView };
}
