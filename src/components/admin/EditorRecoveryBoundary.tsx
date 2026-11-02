import { Component, type ReactNode } from "react";

/** Keep a failed editor isolated while its parent retains the current draft. */
export default class EditorRecoveryBoundary extends Component<
  {
    children: ReactNode;
    draft: unknown;
    onReset: () => void;
  },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="admin-panel" role="alert">
        <h2>Urejevalnika ni mogoče prikazati.</h2>
        <p>
          Osnutek je ohranjen. Pred ponovnim odpiranjem lahko kopirate spodnji
          zapis.
        </p>
        <label className="admin-field">
          <span>Varnostna kopija trenutnega osnutka</span>
          <textarea
            readOnly
            rows={8}
            value={JSON.stringify(this.props.draft, null, 2)}
          />
        </label>
        <button
          type="button"
          className="admin-button"
          onClick={() => {
            this.props.onReset();
            this.setState({ failed: false });
          }}
        >
          Ponovno odpri objavljeno vsebino
        </button>
      </section>
    );
  }
}
