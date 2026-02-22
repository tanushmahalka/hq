import { Component, type ReactNode } from "react";

interface Props {
  pageId: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class CustomPageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-5 text-center">
          <p className="text-sm font-medium text-destructive mb-2">
            Custom page "{this.props.pageId}" crashed
          </p>
          <p className="text-xs text-muted-foreground max-w-md font-mono">
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
