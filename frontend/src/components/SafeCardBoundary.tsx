import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export default class SafeCardBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Unable to render this section.',
    };
  }

  componentDidCatch(error: Error) {
    console.error(`Release candidate card failed: ${this.props.title}`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">
            Section Temporarily Unavailable
          </p>
          <h3 className="mt-2 text-xl font-black text-amber-950">{this.props.title}</h3>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            This section could not render cleanly, but the rest of the intelligence profile is still available.
          </p>
          {this.state.message && (
            <p className="mt-3 rounded-2xl bg-white/70 p-3 text-xs font-semibold text-amber-900">
              {this.state.message}
            </p>
          )}
        </section>
      );
    }

    return this.props.children;
  }
}
