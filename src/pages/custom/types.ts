export interface CustomPageEntry {
  id: string;
  label: string;
  icon: string;
  component: () => Promise<{ default: React.ComponentType }>;
}
